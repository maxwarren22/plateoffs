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

const SLOTS = [
  { key: 'r1', intervalSec: 259200, category: 'cuisine',  displayBase: 5  },
  { key: 'r2', intervalSec: 604800, category: 'seasonal', displayBase: 10 },
  { key: 'r3', intervalSec: 432000, category: 'wildcard', displayBase: 15 },
  { key: 'r4', intervalSec: 345600, category: 'dessert',  displayBase: 20 },
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

// Fetches all recipe_ids for a catalog entry in rotation order.
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
  const { data: pool } = await supabase
    .from('division_catalog')
    .select('id, slug, name, active_months, cover_image_url')
    .eq('category', category)

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
): Promise<{ slug: string; needsCuration: boolean } | null> {
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

  // Fetch the full bank for this division to populate the active slot
  const recipeIds = await getBankRecipeIds(supabase, entry.id)

  await supabase.from('plateoffs_divisions').upsert(
    {
      name:            entry.name,
      slug:            entry.slug,
      category:        slot.category,
      catalog_id:      entry.id,
      division_type:   'rotating',
      is_active:       true,
      display_order:   slot.displayBase,
      recipe_ids:      recipeIds,
      cover_image_url: entry.cover_image_url ?? null,
      active_from:     new Date().toISOString(),
      active_until:    nextRotationAt(epoch, slot.intervalSec),
    },
    { onConflict: 'slug' }
  )

  const needsCuration = recipeIds.length < BRACKET_SIZE
  console.log(`[${slot.key}] Activated: ${entry.slug} (bank: ${recipeIds.length}, needs curation: ${needsCuration})`)
  return { slug: entry.slug, needsCuration }
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

// Each epoch, advance rotation_index by ANCHOR_WINDOW_SIZE through the bank,
// write the new window to plateoffs_divisions, and persist the updated index.
async function refreshAnchorWindows(
  supabase: ReturnType<typeof createClient>
): Promise<{ slugs: string[]; needsCuration: string[] }> {
  const { data: anchors } = await supabase
    .from('plateoffs_divisions')
    .select('slug, catalog_id')
    .eq('division_type', 'anchor')
    .eq('is_active', true)

  if (!anchors?.length) return { slugs: [], needsCuration: [] }

  const slugs: string[] = []
  const needsCuration: string[] = []

  await Promise.all(
    anchors.map(async (anchor: { slug: string; catalog_id: string }) => {
      slugs.push(anchor.slug)

      // Load bank in rotation order and current index together
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
        // Bank empty — curation will fill it and sync plateoffs_divisions
        needsCuration.push(anchor.slug)
        return
      }

      const currentIndex: number = catalogData?.rotation_index ?? 0
      const windowSize = Math.min(ANCHOR_WINDOW_SIZE, bank.length)
      const nextIndex = (currentIndex + windowSize) % bank.length

      // Slice the window, wrapping around the end of the bank
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
          .update({ recipe_ids: window })
          .eq('slug', anchor.slug),
      ])

      console.log(
        `[anchor] ${anchor.slug}: index ${currentIndex}→${nextIndex}, ` +
        `window size ${windowSize}, bank size ${bank.length}`
      )

      // Keep growing until capped
      if (bank.length < MAX_BANK_SIZE) needsCuration.push(anchor.slug)
    })
  )

  return { slugs, needsCuration }
}

// ── Incomplete division check ─────────────────────────────────────────────────

async function findIncompleteDivisions(
  supabase: ReturnType<typeof createClient>
): Promise<string[]> {
  const { data } = await supabase
    .from('plateoffs_divisions')
    .select('slug, recipe_ids')
    .eq('is_active', true)

  return (data ?? [])
    .filter((d: { recipe_ids: string[] | null }) =>
      !d.recipe_ids || d.recipe_ids.length < BRACKET_SIZE
    )
    .map((d: { slug: string }) => d.slug)
}

// ── Curation trigger ──────────────────────────────────────────────────────────

async function triggerCuration(slug: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/curate-division-recipes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ slug }),
    }
  )
  if (!res.ok) {
    console.error(`Curation failed for ${slug}: ${res.status} ${await res.text()}`)
  } else {
    console.log(`Curation triggered for: ${slug}`)
  }
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
    const curationSlugs: string[] = []

    for (const slot of SLOTS) {
      const epoch = currentEpoch(slot.intervalSec)
      const stored = storedEpochs[`${slot.key}_epoch`] ?? -1

      if (epoch > stored) {
        console.log(`Slot ${slot.key} advanced: epoch ${stored} → ${epoch}`)
        const result = await rotateSlot(supabase, slot, epoch, currentMonth)
        if (result) {
          activated.push(result.slug)
          if (result.needsCuration) curationSlugs.push(result.slug)
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
      const { needsCuration: anchorCuration } = await refreshAnchorWindows(supabase)
      curationSlugs.push(...anchorCuration)
      configUpdates.push(
        { key: 'anchor_epoch',            value: String(anchorEpoch) },
        { key: 'next_anchor_rotation_at', value: nextRotationAt(anchorEpoch, ANCHOR_INTERVAL_SEC) }
      )
    } else {
      console.log(`Anchor unchanged (epoch ${anchorEpoch})`)
    }

    if (configUpdates.length) await updateAppConfig(supabase, configUpdates)

    // Retry active divisions still below the playable threshold
    const incompleteSlugs = await findIncompleteDivisions(supabase)
    for (const slug of incompleteSlugs) {
      if (!curationSlugs.includes(slug)) curationSlugs.push(slug)
    }

    for (const slug of curationSlugs) {
      triggerCuration(slug).catch(err => console.error(`Curation error for ${slug}:`, err))
    }

    return new Response(
      JSON.stringify({ ok: true, activated, curationTriggered: curationSlugs, slotsChecked: SLOTS.length + 1 }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('rotate-divisions error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
