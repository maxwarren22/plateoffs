import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EPOCH_ZERO_UNIX = new Date('2025-06-01T00:00:00Z').getTime() / 1000

const ANCHOR_INTERVAL_SEC = 432000  // 5 days — recipes refresh, divisions stay
const BRACKET_SIZE = 8             // minimum recipes needed to play a division

// Slot intervals in seconds
const SLOTS = [
  { key: 'r1', intervalSec: 259200, category: 'cuisine',  displayBase: 5  },  // 3 days
  { key: 'r2', intervalSec: 604800, category: 'seasonal', displayBase: 10 },  // 7 days
  { key: 'r3', intervalSec: 432000, category: 'wildcard', displayBase: 15 },  // 5 days
  { key: 'r4', intervalSec: 345600, category: 'dessert',  displayBase: 20 },  // 4 days
] as const

type SlotKey = typeof SLOTS[number]['key']

// Display order interleave: R1=5, A1=1, R2=10, A2=2, R3=15, A3=3, R4=20, A4=4
// Anchors are fixed; rotating slots use displayBase above

// ── Epoch helpers ─────────────────────────────────────────────────────────────

function currentEpoch(intervalSec: number): number {
  return Math.floor((Date.now() / 1000 - EPOCH_ZERO_UNIX) / intervalSec)
}

function nextRotationAt(epoch: number, intervalSec: number): string {
  const unix = EPOCH_ZERO_UNIX + (epoch + 1) * intervalSec
  return new Date(unix * 1000).toISOString()
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

// ── Division selection ────────────────────────────────────────────────────────

async function selectDivisionForSlot(
  supabase: ReturnType<typeof createClient>,
  category: string,
  epoch: number,
  currentMonth: number
): Promise<{ id: string; slug: string; name: string; recipe_ids: string[] | null; cover_image_url: string | null } | null> {
  let query = supabase
    .from('division_catalog')
    .select('id, slug, name, recipe_ids, active_months, cover_image_url')
    .eq('category', category)

  const { data: pool } = await query
  if (!pool?.length) return null

  // For seasonal, filter to entries eligible this month
  const eligible = category === 'seasonal'
    ? pool.filter(e => !e.active_months || e.active_months.includes(currentMonth))
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

  // Deactivate current rotating division for this slot
  await supabase
    .from('plateoffs_divisions')
    .update({ is_active: false })
    .eq('division_type', 'rotating')
    .eq('catalog_id', await getActiveSlotCatalogId(supabase, slot.key))

  // Upsert the new active division
  await supabase.from('plateoffs_divisions').upsert(
    {
      name:             entry.name,
      slug:             entry.slug,
      category:         slot.category,
      catalog_id:       entry.id,
      division_type:    'rotating',
      is_active:        true,
      display_order:    slot.displayBase,
      recipe_ids:       entry.recipe_ids ?? [],
      cover_image_url:  entry.cover_image_url ?? null,
      active_from:      new Date().toISOString(),
      active_until:     nextRotationAt(epoch, slot.intervalSec),
    },
    { onConflict: 'slug' }
  )

  const needsCuration = !entry.recipe_ids || entry.recipe_ids.length < BRACKET_SIZE
  console.log(`[${slot.key}] Activated: ${entry.slug} (needs curation: ${needsCuration})`)
  return { slug: entry.slug, needsCuration }
}

async function getActiveSlotCatalogId(
  supabase: ReturnType<typeof createClient>,
  slotKey: string
): Promise<string | null> {
  // Find the currently active rotating division for this slot's category
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

// ── Anchor recipe refresh ─────────────────────────────────────────────────────

async function refreshAnchorRecipes(
  supabase: ReturnType<typeof createClient>
): Promise<string[]> {
  const { data } = await supabase
    .from('plateoffs_divisions')
    .select('slug')
    .eq('division_type', 'anchor')
    .eq('is_active', true)

  const slugs = (data ?? []).map((r: { slug: string }) => r.slug)
  console.log(`Refreshing recipes for ${slugs.length} anchor divisions`)
  return slugs
}

// ── Incomplete division check ─────────────────────────────────────────────────

// Finds active divisions that haven't reached the minimum recipe count yet.
// Runs every hourly tick so a curation that timed out mid-run keeps being retried.
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
  // Call curate-division-recipes as a background subrequest
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
    console.log(`Curation queued for: ${slug}`)
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
    const currentMonth = new Date().getMonth() + 1 // 1-indexed
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
          { key: `${slot.key}_epoch`,          value: String(epoch) },
          { key: `next_${slot.key}_rotation_at`, value: nextRotationAt(epoch, slot.intervalSec) }
        )
      } else {
        console.log(`Slot ${slot.key} unchanged (epoch ${epoch})`)
      }
    }

    // Check anchor recipe refresh (5-day cycle)
    const anchorEpoch = currentEpoch(ANCHOR_INTERVAL_SEC)
    const storedAnchorEpoch = storedEpochs['anchor_epoch'] ?? -1
    if (anchorEpoch > storedAnchorEpoch) {
      console.log(`Anchor epoch advanced: ${storedAnchorEpoch} → ${anchorEpoch}`)
      const anchorSlugs = await refreshAnchorRecipes(supabase)
      curationSlugs.push(...anchorSlugs)
      configUpdates.push(
        { key: 'anchor_epoch',           value: String(anchorEpoch) },
        { key: 'next_anchor_rotation_at', value: nextRotationAt(anchorEpoch, ANCHOR_INTERVAL_SEC) }
      )
    } else {
      console.log(`Anchor unchanged (epoch ${anchorEpoch})`)
    }

    if (configUpdates.length) {
      await updateAppConfig(supabase, configUpdates)
    }

    // Also retry any already-active divisions that still lack enough recipes
    // (handles curation jobs that timed out mid-run in a previous cycle)
    const incompleteSlugs = await findIncompleteDivisions(supabase)
    for (const slug of incompleteSlugs) {
      if (!curationSlugs.includes(slug)) curationSlugs.push(slug)
    }

    // Trigger curation for each newly activated / refreshed / incomplete division
    // Fire-and-forget — don't await so we don't block the response
    for (const slug of curationSlugs) {
      triggerCuration(slug).catch(err => console.error(`Curation error for ${slug}:`, err))
    }

    return new Response(
      JSON.stringify({
        ok: true,
        activated,
        curationTriggered: curationSlugs,
        slotsChecked: SLOTS.length + 1,  // +1 for anchor
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('rotate-divisions error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
