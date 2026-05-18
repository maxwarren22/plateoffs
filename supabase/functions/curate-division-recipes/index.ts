import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const TEXT_MODEL  = 'gemini-2.5-flash'

// Once a division bank reaches MAX_BANK_SIZE rows in division_recipe_bank,
// curation stops permanently — the window just rotates through what's there.
const MAX_BANK_SIZE      = 250
const INITIAL_BANK_TARGET = 40   // fill to this on the very first run
const GROWTH_BATCH        = 10   // recipes added per subsequent call
const RESOLVE_BATCH_SIZE  = 20   // parallel within each batch — larger is fine now

const MIN_PER_PROFILE = 8

const DIETARY_PROFILES = ['vegetarian', 'vegan', 'gluten_free', 'no_pork', 'dairy_free'] as const
type DietaryTag = typeof DIETARY_PROFILES[number]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProposedRecipe {
  name: string
  cook_time_minutes: number
  skill_level: 'beginner' | 'intermediate' | 'advanced'
  tags: string[]
  meal_type_tags: string[]
  dietary_tags: DietaryTag[]
}

interface RecipeDetails {
  ingredients: string[]
  instructions: string[]
}

interface CatalogEntry {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
}

type Coverage = Record<DietaryTag, number>

// ── Gemini: text generation ───────────────────────────────────────────────────

async function geminiJSON(prompt: string): Promise<unknown> {
  const res = await fetch(
    `${GEMINI_BASE}/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json',
        },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini text error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
  return JSON.parse(text)
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPass1Prompt(division: CatalogEntry): string {
  return `You are a culinary curator for a food tournament app called Plateoffs.

Division: "${division.name}" — ${division.description ?? division.category}

Propose up to 20 recipes that would compete in this bracket. All recipes MUST be main meals or substantial complete dishes (no dips, sauces, sides, snacks, or condiments). The set MUST include:
- At least 8 that are vegetarian
- At least 8 that are vegan
- At least 8 that are gluten-free
- At least 8 that contain no pork
- At least 8 that are dairy-free
(Many recipes will satisfy multiple criteria simultaneously — optimize for overlap.)

Each recipe must be iconic within the theme, visually striking, varied in technique, and a real named dish.

Return ONLY a JSON array:
[{
  "name": string,
  "cook_time_minutes": number,
  "skill_level": "beginner"|"intermediate"|"advanced",
  "tags": string[],
  "meal_type_tags": string[],
  "dietary_tags": subset of ["vegetarian","vegan","gluten_free","no_pork","dairy_free"]
}]`
}

function buildGapFillPrompt(division: CatalogEntry, profile: DietaryTag, need: number): string {
  return `You are a culinary curator for Plateoffs.

Division: "${division.name}" — ${division.description ?? division.category}

The current pool is short on ${profile.replace(/_/g, '-')} options. Generate exactly ${need} more recipes that are strictly ${profile.replace(/_/g, '-')} and authentic to this division. Main meals only — no sides or snacks.

Return ONLY a JSON array:
[{
  "name": string,
  "cook_time_minutes": number,
  "skill_level": "beginner"|"intermediate"|"advanced",
  "tags": string[],
  "meal_type_tags": string[],
  "dietary_tags": ["${profile}", ...any others that also apply]
}]`
}

function buildGrowthPrompt(division: CatalogEntry, existingNames: string[]): string {
  const nameList = existingNames.slice(-40).map(n => `- ${n}`).join('\n')
  return `You are a culinary curator for Plateoffs.

Division: "${division.name}" — ${division.description ?? division.category}

This division already has these recipes — do NOT repeat them or close variants:
${nameList}

Add ${GROWTH_BATCH} fresh recipes. Vary technique, origin, and style while staying authentic to the theme. Main meals only. Include dietary tags wherever authentic.

Return ONLY a JSON array:
[{
  "name": string,
  "cook_time_minutes": number,
  "skill_level": "beginner"|"intermediate"|"advanced",
  "tags": string[],
  "meal_type_tags": string[],
  "dietary_tags": subset of ["vegetarian","vegan","gluten_free","no_pork","dairy_free"]
}]`
}

function buildRecipeDetailPrompt(recipeName: string, divisionName: string): string {
  return `You are a professional chef. Provide the full recipe for "${recipeName}" as it would appear in a "${divisionName}" tournament.

Return ONLY a JSON object:
{
  "ingredients": ["1 unit item", ...],
  "instructions": ["Step 1...", ...]
}`
}

// ── Coverage helpers ──────────────────────────────────────────────────────────

function computeCoverage(pool: ProposedRecipe[]): Coverage {
  const counts = Object.fromEntries(DIETARY_PROFILES.map(p => [p, 0])) as Coverage
  for (const r of pool) {
    for (const tag of r.dietary_tags ?? []) {
      if (tag in counts) counts[tag]++
    }
  }
  return counts
}

function gapsBelow(coverage: Coverage, min: number): DietaryTag[] {
  return DIETARY_PROFILES.filter(p => coverage[p] < min)
}

// ── Bank helpers ──────────────────────────────────────────────────────────────

async function getBankState(supabase: any, catalogId: string): Promise<{
  size: number
  recipeIds: Set<string>
  nextSortOrder: number
}> {
  const { data } = await supabase
    .from('division_recipe_bank')
    .select('recipe_id, sort_order')
    .eq('catalog_id', catalogId)
    .order('sort_order', { ascending: true })

  const rows = data ?? []
  const recipeIds = new Set<string>(rows.map((r: { recipe_id: string }) => r.recipe_id))
  const nextSortOrder = rows.length > 0
    ? rows[rows.length - 1].sort_order + 1
    : 0

  return { size: rows.length, recipeIds, nextSortOrder }
}

async function getBankRecipeNames(supabase: any, catalogId: string): Promise<string[]> {
  const { data: bankRows } = await supabase
    .from('division_recipe_bank')
    .select('recipe_id')
    .eq('catalog_id', catalogId)

  if (!bankRows?.length) return []

  const { data: recipes } = await supabase
    .from('recipes')
    .select('name')
    .in('id', bankRows.map((r: { recipe_id: string }) => r.recipe_id))

  return (recipes ?? []).map((r: { name: string }) => r.name)
}

async function addToBank(
  supabase: any,
  catalogId: string,
  recipeId: string,
  sortOrder: number
): Promise<void> {
  await supabase
    .from('division_recipe_bank')
    .insert({ catalog_id: catalogId, recipe_id: recipeId, sort_order: sortOrder })
}

// ── Recipe lookup / insert ────────────────────────────────────────────────────

async function findExistingRecipe(supabase: any, name: string): Promise<string | null> {
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function tagExistingRecipe(supabase: any, id: string, tags: DietaryTag[]): Promise<void> {
  const { data } = await supabase.from('recipes').select('dietary_tags').eq('id', id).single()
  const existing: string[] = data?.dietary_tags ?? []
  const merged = Array.from(new Set([...existing, ...tags]))
  await supabase.from('recipes').update({ dietary_tags: merged }).eq('id', id)
}

async function insertRecipe(
  supabase: any,
  proposed: ProposedRecipe,
  divisionName: string
): Promise<string | null> {
  console.log(`Generating details for: ${proposed.name}`)
  const details = await geminiJSON(
    buildRecipeDetailPrompt(proposed.name, divisionName)
  ) as RecipeDetails

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      name:           proposed.name,
      cook_time:      proposed.cook_time_minutes,
      skill_level:    proposed.skill_level,
      tags:           proposed.tags,
      meal_type_tags: proposed.meal_type_tags,
      dietary_tags:   proposed.dietary_tags,
      source:         'ai',
      is_public:      true,
      ingredients:    details.ingredients,
      instructions:   details.instructions,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(`Failed to insert recipe "${proposed.name}":`, error?.message)
    return null
  }
  return data.id
}

// ── Batch resolution ──────────────────────────────────────────────────────────

async function resolveBatch(
  supabase: any,
  batch: ProposedRecipe[],
  division: CatalogEntry,
  bankState: { recipeIds: Set<string>; nextSortOrder: number }
): Promise<{ inserted: number; matched: number; newInsertedIds: string[] }> {
  // Phase 1: look up all recipes in parallel
  const lookups = await Promise.all(
    batch.map(async (proposed) => {
      try {
        const existingId = await findExistingRecipe(supabase, proposed.name)
        return { proposed, existingId }
      } catch (err) {
        console.error(`Lookup failed for "${proposed.name}":`, err)
        return { proposed, existingId: null as string | null }
      }
    })
  )

  const needsInsert = lookups.filter(({ existingId }) => existingId === null)
  const alreadyExists = lookups.filter(({ existingId }) => existingId !== null)

  // Phase 2: generate details and insert new recipes in parallel (the Gemini bottleneck)
  const insertedMap = new Map<string, string>()
  await Promise.all(
    needsInsert.map(async ({ proposed }) => {
      try {
        const newId = await insertRecipe(supabase, proposed, division.name)
        if (newId) insertedMap.set(proposed.name, newId)
      } catch (err) {
        console.error(`Insert failed for "${proposed.name}":`, err)
      }
    })
  )

  // Phase 3: tag existing recipes in parallel
  await Promise.all(
    alreadyExists.map(({ proposed, existingId }) =>
      tagExistingRecipe(supabase, existingId!, proposed.dietary_tags).catch(err =>
        console.error(`Tag failed for "${proposed.name}":`, err)
      )
    )
  )

  // Phase 4: add to bank sequentially to maintain deterministic sort_order
  let inserted = 0
  let matched = 0
  const newInsertedIds: string[] = []

  for (const { proposed, existingId } of lookups) {
    if (existingId) {
      if (!bankState.recipeIds.has(existingId)) {
        await addToBank(supabase, division.id, existingId, bankState.nextSortOrder++)
        bankState.recipeIds.add(existingId)
        matched++
      }
    } else {
      const newId = insertedMap.get(proposed.name)
      if (newId && !bankState.recipeIds.has(newId)) {
        await addToBank(supabase, division.id, newId, bankState.nextSortOrder++)
        bankState.recipeIds.add(newId)
        newInsertedIds.push(newId)
        inserted++
      }
    }
  }

  return { inserted, matched, newInsertedIds }
}

// ── Image backfill trigger ────────────────────────────────────────────────────

function triggerImageBackfill(recipeIds: string[]): void {
  if (recipeIds.length === 0) return
  fetch(`${SUPABASE_URL}/functions/v1/backfill-recipe-images`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({ recipe_ids: recipeIds }),
  }).catch(err => console.error('Image backfill trigger failed:', err))
}

// ── Main curation orchestrator ────────────────────────────────────────────────

async function curateDivision(
  supabase: any,
  division: CatalogEntry
): Promise<{
  mode: 'full' | 'initial' | 'growth'
  bankSize: number
  inserted: number
  matched: number
}> {
  const bankState = await getBankState(supabase, division.id)

  // Bank is full — rotation handles everything from here, no generation needed
  if (bankState.size >= MAX_BANK_SIZE) {
    console.log(`[${division.slug}] Bank full (${bankState.size}/${MAX_BANK_SIZE}), skipping`)
    return { mode: 'full', bankSize: bankState.size, inserted: 0, matched: 0 }
  }

  const pool: ProposedRecipe[] = []
  let inserted = 0
  let matched = 0
  const newInsertedIds: string[] = []

  if (bankState.size < INITIAL_BANK_TARGET) {
    // First run: broad generation + gap-fill until all dietary profiles have ≥ 8
    console.log(`[${division.slug}] Initial fill (bank: ${bankState.size}/${INITIAL_BANK_TARGET})`)

    const proposed1 = await geminiJSON(buildPass1Prompt(division)) as ProposedRecipe[]
    pool.push(...proposed1)

    for (let round = 0; round < 3; round++) {
      const coverage = computeCoverage(pool)
      const gaps = gapsBelow(coverage, MIN_PER_PROFILE)
      if (gaps.length === 0) break
      console.log(`[${division.slug}] Gap fill round ${round + 1}: ${gaps.join(', ')}`)
      await Promise.all(
        gaps.map(async (profile) => {
          const need = MIN_PER_PROFILE - computeCoverage(pool)[profile]
          const extras = await geminiJSON(buildGapFillPrompt(division, profile, need)) as ProposedRecipe[]
          pool.push(...extras)
        })
      )
    }
  } else {
    // Bank exists but isn't full — add a small fresh batch
    console.log(`[${division.slug}] Growth (bank: ${bankState.size}/${MAX_BANK_SIZE})`)
    const existingNames = await getBankRecipeNames(supabase, division.id)
    const proposed = await geminiJSON(buildGrowthPrompt(division, existingNames)) as ProposedRecipe[]
    pool.push(...proposed)
  }

  // Resolve in sequential batches to stay well within Edge Function timeout
  for (let i = 0; i < pool.length; i += RESOLVE_BATCH_SIZE) {
    const batch = pool.slice(i, i + RESOLVE_BATCH_SIZE)
    const counts = await resolveBatch(supabase, batch, division, bankState)
    inserted += counts.inserted
    matched += counts.matched
    newInsertedIds.push(...counts.newInsertedIds)
  }

  // Stamp the catalog row and sync full bank to any active plateoffs_divisions row.
  // For anchors the next epoch's refreshAnchorWindows will re-slice to the window;
  // for rotating divisions the full bank is immediately playable.
  const { data: allBankRows } = await supabase
    .from('division_recipe_bank')
    .select('recipe_id')
    .eq('catalog_id', division.id)
    .order('sort_order')

  const fullBank = (allBankRows ?? []).map((r: { recipe_id: string }) => r.recipe_id)

  await Promise.all([
    supabase
      .from('division_catalog')
      .update({ last_curated_at: new Date().toISOString() })
      .eq('id', division.id),
    supabase
      .from('plateoffs_divisions')
      .update({ recipe_ids: fullBank })
      .eq('catalog_id', division.id)
      .eq('is_active', true),
  ])

  triggerImageBackfill(newInsertedIds)

  const mode = bankState.size < INITIAL_BANK_TARGET ? 'initial' : 'growth'
  return { mode, bankSize: fullBank.length, inserted, matched }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const { slug, catalog_id } = await req.json()
    if (!slug && !catalog_id) {
      return new Response(JSON.stringify({ error: 'Provide slug or catalog_id' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const query = supabase.from('division_catalog').select('id, slug, name, description, category')
    const { data: division, error } = await (slug ? query.eq('slug', slug) : query.eq('id', catalog_id))
      .single()

    if (error || !division) {
      return new Response(JSON.stringify({ error: 'Division not found' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Starting curation for: ${division.name}`)
    const result = await curateDivision(supabase, division)

    return new Response(
      JSON.stringify({ success: true, division: division.name, ...result }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Curation error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
