import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY        = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GEMINI_BASE   = 'https://generativelanguage.googleapis.com/v1beta'
const TEXT_MODEL    = 'gemini-2.5-flash'
const IMAGE_MODEL   = 'gemini-2.5-flash'
const IMAGE_BUCKET  = 'recipe-images'
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
  description: string
  ingredients: string[]
  instructions: string[]
}

interface CatalogEntry {
  id: string
  slug: string
  name: string
  description: string | null
  category: string
  recipe_ids: string[] | null
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

// ── Gemini: image generation ──────────────────────────────────────────────────

async function geminiImage(prompt: string): Promise<Uint8Array | null> {
  const res = await fetch(
    `${GEMINI_BASE}/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 1,
        },
      }),
    }
  )
  if (!res.ok) {
    console.error(`Image generation failed ${res.status}: ${await res.text()}`)
    return null
  }
  const json = await res.json()
  const parts = json.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inlineData?: { mimeType?: string } }) =>
    p.inlineData?.mimeType?.startsWith('image/')
  )
  if (!imagePart) return null
  return Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0))
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPass1Prompt(division: CatalogEntry): string {
  return `You are a culinary curator for a food tournament app called Plateoffs.

Division: "${division.name}" — ${division.description ?? division.category}

Propose up to 20 recipes that would compete in this bracket. All recipes MUST be main meals or substantial complete dishes (no dips, sauces, sides, snacks, or condiments — every entry should be something you'd order as a full meal at a restaurant). The set MUST also include:
- At least 8 that are vegetarian
- At least 8 that are vegan
- At least 8 that are gluten-free
- At least 8 that contain no pork
- At least 8 that are dairy-free
(Many recipes will satisfy multiple criteria simultaneously — optimize for overlap.)

Each recipe must be iconic within the theme, visually striking, varied in technique, and a real named dish.

Return ONLY a JSON array (no markdown prose):
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

The current recipe pool is short on ${profile.replace('_', '-')} options. Generate exactly ${need} more recipes for this division that are strictly ${profile.replace('_', '-')}.
All recipes must be main meals or substantial complete dishes (no dips, sauces, sides, snacks, or condiments).
They must feel authentic to the division theme — be creative within the constraint.

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

function buildRecipeDetailPrompt(recipeName: string, divisionName: string): string {
  return `You are a professional chef. Provide the full recipe for "${recipeName}" in the context of a "${divisionName}" tournament.

The recipe should be high-quality, authentic, and delicious.

Return ONLY a JSON object:
{
  "description": "Short, appetizing 1-2 sentence description",
  "ingredients": ["1 unit item", "2 units item", ...],
  "instructions": ["Step 1...", "Step 2...", ...]
}`
}

function buildImagePrompt(recipeName: string): string {
  const surfaces = ['marble', 'dark wood', 'rustic concrete', 'slate', 'linen']
  const surface = surfaces[Math.floor(Math.random() * surfaces.length)]
  return `Professional food photography of ${recipeName}. Top-down shot on a ${surface} surface. Natural window light. Garnished and plated for a high-end restaurant menu. Photorealistic, high resolution, appetizing, vibrant colors.`
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

// ── Recipe DB operations ──────────────────────────────────────────────────────

async function findExistingRecipe(
  supabase: any,
  name: string
): Promise<string | null> {
  const { data } = await supabase
    .from('recipes')
    .select('id')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

async function tagExistingRecipe(
  supabase: any,
  id: string,
  name: string,
  tags: DietaryTag[]
): Promise<void> {
  const { data } = await supabase.from('recipes').select('dietary_tags, image_path').eq('id', id).single()
  const existing: string[] = data?.dietary_tags ?? []
  const merged = Array.from(new Set([...existing, ...tags]))

  const updates: Record<string, unknown> = { dietary_tags: merged }

  // If the matched recipe has no image, generate one now
  if (!data?.image_path) {
    const imageBytes = await geminiImage(buildImagePrompt(name))
    if (imageBytes) {
      const path = await uploadImage(supabase, id, imageBytes)
      if (path) updates.image_path = path
    }
  }

  await supabase.from('recipes').update(updates).eq('id', id)
}

async function uploadImage(
  supabase: any,
  recipeId: string,
  imageBytes: Uint8Array
): Promise<string | null> {
  const path = `ai-generated/${recipeId}.png`
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, imageBytes, { contentType: 'image/png', upsert: true })
  if (error) {
    console.error(`Image upload failed for ${recipeId}:`, error.message)
    return null
  }
  return path
}

async function insertRecipe(
  supabase: any,
  proposed: ProposedRecipe,
  divisionName: string
): Promise<string | null> {
  // Generate details and image in parallel
  console.log(`Generating details and image for: ${proposed.name}`)
  const [details, imageBytes] = await Promise.all([
    geminiJSON(buildRecipeDetailPrompt(proposed.name, divisionName)) as Promise<RecipeDetails>,
    geminiImage(buildImagePrompt(proposed.name))
  ])

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      name:               proposed.name,
      description:        details.description,
      cook_time:          proposed.cook_time_minutes,
      skill_level:        proposed.skill_level,
      tags:               proposed.tags,
      meal_type_tags:     proposed.meal_type_tags,
      dietary_tags:       proposed.dietary_tags,
      source:             'ai',
      is_public:          true,
      ingredients:        details.ingredients,
      instructions:       details.instructions,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(`Failed to insert recipe "${proposed.name}":`, error?.message)
    return null
  }

  if (imageBytes) {
    const imagePath = await uploadImage(supabase, data.id, imageBytes)
    if (imagePath) {
      await supabase.from('recipes').update({ image_path: imagePath }).eq('id', data.id)
    }
  }

  return data.id
}

// ── Main curation orchestrator ────────────────────────────────────────────────

async function curateDivision(
  supabase: any,
  division: CatalogEntry
): Promise<{ total: number; inserted: number; matched: number; skipped: number; coverage: Coverage }> {
  // Load any IDs already persisted so a re-run can resume where it left off
  const { data: existing } = await supabase
    .from('division_catalog')
    .select('recipe_ids')
    .eq('id', division.id)
    .single()
  const resolvedIds: string[] = existing?.recipe_ids ?? []
  const resolvedSet = new Set(resolvedIds)

  const pool: ProposedRecipe[] = []
  let inserted = 0
  let matched = 0
  let skipped = 0

  // Pass 1: broad generation
  console.log(`[${division.slug}] Pass 1: broad generation`)
  const proposed1 = await geminiJSON(buildPass1Prompt(division)) as ProposedRecipe[]
  pool.push(...proposed1)

  // Gap fill passes (up to 3 rounds)
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

  // Resolve all proposed recipes in parallel. Promise.allSettled ensures one
  // failure (e.g. a Gemini image error) doesn't abort the rest of the batch.
  const results = await Promise.allSettled(
    pool.map(async (proposed) => {
      const existingId = await findExistingRecipe(supabase, proposed.name)
      if (existingId) {
        await tagExistingRecipe(supabase, existingId, proposed.name, proposed.dietary_tags)
        return { id: existingId, kind: 'matched' as const }
      }
      const newId = await insertRecipe(supabase, proposed, division.name)
      if (!newId) throw new Error(`Failed to insert "${proposed.name}"`)
      return { id: newId, kind: 'inserted' as const }
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && !resolvedSet.has(result.value.id)) {
      resolvedIds.push(result.value.id)
      resolvedSet.add(result.value.id)
      if (result.value.kind === 'matched') matched++
      else inserted++
    } else if (result.status === 'rejected') {
      console.error('Recipe resolution failed:', result.reason)
    }
  }

  const finalCoverage = computeCoverage(pool)

  // Final write — marks curation complete with timestamp
  await supabase
    .from('division_catalog')
    .update({ recipe_ids: resolvedIds, last_curated_at: new Date().toISOString() })
    .eq('id', division.id)

  return { total: resolvedIds.length, inserted, matched, skipped, coverage: finalCoverage }
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

    const query = supabase.from('division_catalog').select('*')
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
      JSON.stringify({ success: true, division: division.name, ...result, resumable: true }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Curation error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
