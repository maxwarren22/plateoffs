import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EPOCH_ZERO_UNIX = new Date('2025-06-01T00:00:00Z').getTime() / 1000

const ANCHOR_INTERVAL_SEC = 432000  // 5 days
const BRACKET_SIZE        = 8       // minimum recipes needed to play a division
const ANCHOR_WINDOW_SIZE  = 40      // recipes shown per anchor epoch
const MAX_BANK_SIZE       = 250     // mirrors curate-division-recipes

// Lobby order per spec: R1=1, A1=2, R2=3, A2=4, R3=5, A3=6, R4=7, A4=8
const SLOTS = [
  { key: 'r1', intervalSec: 259200, category: 'cuisine',  displayBase: 1 },
  { key: 'r2', intervalSec: 604800, category: 'seasonal', displayBase: 3 },
  { key: 'r3', intervalSec: 432000, category: 'wildcard', displayBase: 5 },
  { key: 'r4', intervalSec: 345600, category: 'dessert',  displayBase: 7 },
] as const

// ── Epoch helpers ─────────────────────────────────────────────────────────────

function currentEpoch(intervalSec: number): number {
  return Math.floor((Date.now() / 1000 - EPOCH_ZERO_UNIX) / intervalSec)
}

function nextRotationAt(epoch: number, intervalSec: number): string {
  return new Date((EPOCH_ZERO_UNIX + (epoch + 1) * intervalSec) * 1000).toISOString()
}

// ── App config helpers ────────────────────────────────────────────────────────

async function getStoredEpochs(
  supabase: ReturnType<typeof createClient>
): Promise<Record<string, number>> {
  const keys = [...SLOTS.map(s => `${s.key}_epoch`), 'anchor_epoch']
  const { data } = await supabase.from('app_config').select('key, value').in('key', keys)
  return Object.fromEntries((data ?? []).map(r => [r.key, Number(r.value)]))
}

async function updateAppConfig(
  supabase: ReturnType<typeof createClient>,
  rows: { key: string; value: string }[]
): Promise<void> {
  await supabase.from('app_config').upsert(
    rows.map(r => ({ ...r, updated_at: new Date().toISOString() })),
    { onConflict: 'key' }
  )
}

// ── Bank helpers ──────────────────────────────────────────────────────────────

async function getBankRecipeIds(
  supabase: ReturnType<typeof createClient>,
  catalogId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('division_recipe_bank')
    .select('recipe_id')
    .eq('catalog_id', catalogId)
    .order('sort_order', { ascending: true })
  return (data ?? []).map((r: { recipe_id: string }) => r.recipe_id)
}

// ── Division selection ────────────────────────────────────────────────────────

async function selectDivisionForSlot(
  supabase: ReturnType<typeof createClient>,
  category: string,
  epoch: number,
  currentMonth: number
): Promise<{ id: string; slug: string; name: string; cover_image_url: string | null } | null> {
  // ORDER BY display_order ensures deterministic pool ordering — the same epoch always
  // picks the same division regardless of Postgres row storage order.
  const { data: pool } = await supabase
    .from('division_catalog')
    .select('id, slug, name, active_months, cover_image_url')
    .eq('category', category)
    .order('display_order', { ascending: true })

  if (!pool?.length) return null

  const eligible = category === 'seasonal'
    ? pool.filter((e: { active_months: number[] | null }) =>
        !e.active_months || e.active_months.includes(currentMonth)
      )
    : pool

  if (!eligible.length) return null
  return eligible[epoch % eligible.length]
}

// ── Slot rotation ─────────────────────────────────────────────────────────────

async function rotateSlot(
  supabase: ReturnType<typeof createClient>,
  slot: typeof SLOTS[number],
  epoch: number,
  currentMonth: number
): Promise<{ slug: string } | null> {
  const entry = await selectDivisionForSlot(supabase, slot.category, epoch, currentMonth)
  if (!entry) {
    console.error(`No eligible entry for slot ${slot.key} (category: ${slot.category})`)
    return null
  }

  // Deactivate previous division in this slot's category
  await supabase
    .from('plateoffs_divisions')
    .update({ is_active: false })
    .eq('division_type', 'rotating')
    .eq('catalog_id', await getActiveSlotCatalogId(supabase, slot.key))

  const recipeIds = await getBankRecipeIds(supabase, entry.id)

  await supabase.from('plateoffs_divisions').upsert(
    {
      name:             entry.name,
      slug:             entry.slug,
      category:         slot.category,
      catalog_id:       entry.id,
      division_type:    'rotating',
      is_active:        true,
      display_order:    slot.displayBase,
      recipe_ids:       recipeIds,
      cover_image_url:  entry.cover_image_url ?? null,
      active_from:      new Date().toISOString(),
      active_until:     nextRotationAt(epoch, slot.intervalSec),
      // Mark for curation if bank still has room to grow
      curation_pending: recipeIds.length < MAX_BANK_SIZE,
    },
    { onConflict: 'slug' }
  )

  console.log(`[${slot.key}] Activated: ${entry.slug} (bank: ${recipeIds.length}, curation_pending: ${recipeIds.length < MAX_BANK_SIZE})`)
  return { slug: entry.slug }
}

async function getActiveSlotCatalogId(
  supabase: ReturnType<typeof createClient>,
  slotKey: string
): Promise<string | null> {
  const slotDef = SLOTS.find(s => s.key === slotKey)!
  const { data } = await supabase
    .from('plateoffs_divisions')
    .select('catalog_id')
    .eq('division_type', 'rotating')
    .eq('is_active', true)
    .eq('category', slotDef.category)
    .maybeSingle()
  return data?.catalog_id ?? null
}

// ── Anchor window rotation ────────────────────────────────────────────────────

async function refreshAnchorWindows(
  supabase: ReturnType<typeof createClient>
): Promise<{ slugs: string[] }> {
  const { data: anchors } = await supabase
    .from('plateoffs_divisions')
    .select('slug, catalog_id')
    .eq('division_type', 'anchor')
    .eq('is_active', true)

  if (!anchors?.length) return { slugs: [] }

  const slugs: string[] = []

  await Promise.all(
    anchors.map(async (anchor: { slug: string; catalog_id: string }) => {
      slugs.push(anchor.slug)

      const [bank, catalogData] = await Promise.all([
        getBankRecipeIds(supabase, anchor.catalog_id),
        supabase
          .from('division_catalog')
          .select('rotation_index')
          .eq('id', anchor.catalog_id)
          .single()
          .then(({ data }) => data),
      ])

      if (bank.length === 0) {
        // Bank empty — flag for curation; curate will sync recipe_ids when done
        await supabase
          .from('plateoffs_divisions')
          .update({ curation_pending: true })
          .eq('slug', anchor.slug)
        return
      }

      const currentIndex: number = catalogData?.rotation_index ?? 0
      const windowSize = Math.min(ANCHOR_WINDOW_SIZE, bank.length)
      const nextIndex = (currentIndex + windowSize) % bank.length

      const window: string[] = Array.from(
        { length: windowSize },
        (_, i) => bank[(currentIndex + i) % bank.length]
      )

      await Promise.all([
        supabase
          .from('division_catalog')
          .update({ rotation_index: nextIndex })
          .eq('id', anchor.catalog_id),
        supabase
          .from('plateoffs_divisions')
          .update({
            recipe_ids:       window,
            // Flag for growth if bank hasn't reached the cap
            curation_pending: bank.length < MAX_BANK_SIZE,
          })
          .eq('slug', anchor.slug),
      ])

      console.log(
        `[anchor] ${anchor.slug}: index ${currentIndex}→${nextIndex}, ` +
        `window ${windowSize}, bank ${bank.length}, curation_pending: ${bank.length < MAX_BANK_SIZE}`
      )
    })
  )

  return { slugs }
}

// ── Incomplete division safety net ────────────────────────────────────────────

// Flags any active division that is below the minimum playable threshold.
// curate-scheduler will pick these up within 5 minutes.
async function markIncompleteDivisions(
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  const { data } = await supabase
    .from('plateoffs_divisions')
    .select('slug, recipe_ids')
    .eq('is_active', true)

  const incomplete = (data ?? []).filter(
    (d: { recipe_ids: string[] | null }) => !d.recipe_ids || d.recipe_ids.length < BRACKET_SIZE
  )

  if (incomplete.length === 0) return 0

  await supabase
    .from('plateoffs_divisions')
    .update({ curation_pending: true })
    .in('slug', incomplete.map((d: { slug: string }) => d.slug))

  console.log(`Marked ${incomplete.length} incomplete division(s) for curation: ${incomplete.map((d: { slug: string }) => d.slug).join(', ')}`)
  return incomplete.length
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const storedEpochs = await getStoredEpochs(supabase)
    const currentMonth = new Date().getMonth() + 1
    const configUpdates: { key: string; value: string }[] = []
    const activated: string[] = []
    let pendingCount = 0

    for (const slot of SLOTS) {
      const epoch = currentEpoch(slot.intervalSec)
      const stored = storedEpochs[`${slot.key}_epoch`] ?? -1

      if (epoch > stored) {
        console.log(`Slot ${slot.key} advanced: epoch ${stored} → ${epoch}`)
        const result = await rotateSlot(supabase, slot, epoch, currentMonth)
        if (result) {
          activated.push(result.slug)
          pendingCount++
        }
        configUpdates.push(
          { key: `${slot.key}_epoch`,            value: String(epoch) },
          { key: `next_${slot.key}_rotation_at`, value: nextRotationAt(epoch, slot.intervalSec) }
        )
      } else {
        console.log(`Slot ${slot.key} unchanged (epoch ${epoch})`)
      }
    }

    const anchorEpoch = currentEpoch(ANCHOR_INTERVAL_SEC)
    const storedAnchorEpoch = storedEpochs['anchor_epoch'] ?? -1

    if (anchorEpoch > storedAnchorEpoch) {
      console.log(`Anchor epoch advanced: ${storedAnchorEpoch} → ${anchorEpoch}`)
      await refreshAnchorWindows(supabase)
      configUpdates.push(
        { key: 'anchor_epoch',            value: String(anchorEpoch) },
        { key: 'next_anchor_rotation_at', value: nextRotationAt(anchorEpoch, ANCHOR_INTERVAL_SEC) }
      )
    } else {
      console.log(`Anchor unchanged (epoch ${anchorEpoch})`)
    }

    if (configUpdates.length) await updateAppConfig(supabase, configUpdates)

    // Safety net: flag any active division still below playable threshold
    const incompleteCount = await markIncompleteDivisions(supabase)
    pendingCount += incompleteCount

    return new Response(
      JSON.stringify({
        ok: true,
        activated,
        curationPendingSet: pendingCount,
        slotsChecked: SLOTS.length + 1,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('rotate-divisions error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
