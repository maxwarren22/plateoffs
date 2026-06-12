/**
 * One-time fix: translate non-English recipe names and shorten long ones
 * for all cuisine-category divisions (international divisions).
 *
 * Modes:
 *   --dry-run          Preview changes via Gemini; saves results to fix-results.json
 *   --apply            Apply saved fix-results.json to the DB (no Gemini calls)
 *   (no flags)         Run Gemini + write to DB in one shot
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   deno run --allow-net --allow-env --allow-read --allow-write scripts/fix-international-recipe-names.ts --dry-run
 *   deno run --allow-net --allow-env --allow-read --allow-write scripts/fix-international-recipe-names.ts --apply
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY')!

const DRY_RUN    = Deno.args.includes('--dry-run')
const APPLY_ONLY = Deno.args.includes('--apply')

const RESULTS_FILE = new URL('./fix-results.json', import.meta.url).pathname
const BATCH_SIZE   = 20
const DB_CHUNK     = 100
const MAX_WORDS    = 5
const MAX_CHARS    = 40

// ── Types ─────────────────────────────────────────────────────────────────────

interface NameFix {
  original: string
  fixed: string | null
  reason: string | null
}

interface SavedResult {
  id: string
  original: string
  fixed: string
}

// ── Supabase ──────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Apply saved results ───────────────────────────────────────────────────────

if (APPLY_ONLY) {
  console.log('=== APPLY from fix-results.json ===\n')

  let saved: SavedResult[]
  try {
    saved = JSON.parse(await Deno.readTextFile(RESULTS_FILE))
  } catch {
    console.error(`Could not read ${RESULTS_FILE} — run --dry-run first`)
    Deno.exit(1)
  }

  console.log(`Applying ${saved.length} rename(s)...\n`)
  let succeeded = 0
  let failed = 0

  for (const item of saved) {
    const { error } = await supabase
      .from('recipes')
      .update({ name: item.fixed })
      .eq('id', item.id)

    if (error) {
      console.error(`  ✗ "${item.original}" → "${item.fixed}": ${error.message}`)
      failed++
    } else {
      console.log(`  ✓ "${item.original}" → "${item.fixed}"`)
      succeeded++
    }
  }

  console.log(`\n═══════════════════════════════`)
  console.log(`Applied: ${succeeded}`)
  console.log(`Failed:  ${failed}`)
  Deno.exit(failed > 0 ? 1 : 0)
}

// ── Gemini ────────────────────────────────────────────────────────────────────

if (!GEMINI_KEY) {
  console.error('Missing GEMINI_API_KEY env var')
  Deno.exit(1)
}

async function geminiFixNames(names: string[], divisionName: string): Promise<NameFix[]> {
  const prompt = `You are a culinary editor for a food tournament app. You are reviewing recipe names from the "${divisionName}" division.

For each name below, determine if it needs to be fixed. A name needs fixing if:
1. It is not in English (e.g. "Murgh Makhani", "Bacalhau à Brás", "Τζατζίκι")
2. It is longer than ${MAX_WORDS} words OR longer than ${MAX_CHARS} characters
3. Both of the above

Rules for fixed names:
- Must be in English (use the common English name, e.g. "Butter Chicken" not "Murgh Makhani")
- Must be 1–${MAX_WORDS} words and ≤ ${MAX_CHARS} characters
- Must NOT include dietary descriptors ("Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free")
- Must remain an authentic, recognizable name for the dish

Input names:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY a JSON array with one object per name, in the same order:
[{
  "original": string,
  "fixed": string | null,
  "reason": string | null
}]
Set "fixed" to null and "reason" to null if the name is already correct English and within length limits.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    }
  )

  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'

  let parsed: NameFix[]
  try {
    parsed = JSON.parse(text)
  } catch {
    const lastBrace = text.lastIndexOf('}')
    if (lastBrace === -1) throw new Error('No valid JSON objects in Gemini response')
    const recovered = text.slice(0, lastBrace + 1) + ']'
    parsed = JSON.parse(recovered)
    console.warn(`  ⚠ Recovered partial JSON (${parsed.length}/${names.length} entries)`)
  }
  return parsed
}

// ── Gemini + collect phase ────────────────────────────────────────────────────

console.log(DRY_RUN ? '=== DRY RUN — saving results to fix-results.json ===' : '=== LIVE RUN ===')
console.log()

const { data: catalogs, error: catErr } = await supabase
  .from('division_catalog')
  .select('id, slug, name, category')
  .eq('category', 'cuisine')

if (catErr) { console.error('Failed to fetch division catalogs:', catErr.message); Deno.exit(1) }
if (!catalogs?.length) { console.log('No cuisine divisions found.'); Deno.exit(0) }

console.log(`Found ${catalogs.length} cuisine division(s):`)
for (const c of catalogs) console.log(`  • ${c.name} (${c.slug})`)
console.log()

const allCatalogIds = catalogs.map((c: { id: string }) => c.id)
const catalogIdToName = Object.fromEntries(
  catalogs.map((c: { id: string; name: string }) => [c.id, c.name])
)

const { data: bankRows, error: bankErr } = await supabase
  .from('division_recipe_bank')
  .select('recipe_id, catalog_id')
  .in('catalog_id', allCatalogIds)

if (bankErr) { console.error('Failed to fetch bank rows:', bankErr.message); Deno.exit(1) }
if (!bankRows?.length) { console.log('No recipes in these division banks.'); Deno.exit(0) }

const recipeToCatalog = new Map<string, string>()
for (const row of bankRows) recipeToCatalog.set(row.recipe_id, row.catalog_id)

const allRecipeIds = [...new Set(bankRows.map((r: { recipe_id: string }) => r.recipe_id))]
console.log(`Total recipes in banks: ${allRecipeIds.length}`)

const recipes: { id: string; name: string }[] = []
for (let i = 0; i < allRecipeIds.length; i += DB_CHUNK) {
  const chunk = allRecipeIds.slice(i, i + DB_CHUNK)
  const { data, error } = await supabase.from('recipes').select('id, name').in('id', chunk)
  if (error) { console.error('Recipes fetch error:', error.message); Deno.exit(1) }
  if (data) recipes.push(...data)
}
console.log(`Fetched ${recipes.length} recipe names\n`)

const byDivision = new Map<string, typeof recipes>()
for (const r of recipes) {
  const catId = recipeToCatalog.get(r.id) ?? 'unknown'
  if (!byDivision.has(catId)) byDivision.set(catId, [])
  byDivision.get(catId)!.push(r)
}

const pendingFixes: SavedResult[] = []
let totalSkipped = 0
let totalFailed = 0

for (const [catalogId, divRecipes] of byDivision) {
  const divisionName = catalogIdToName[catalogId] ?? catalogId
  console.log(`\n── ${divisionName} (${divRecipes.length} recipes) ──`)

  for (let i = 0; i < divRecipes.length; i += BATCH_SIZE) {
    const batch = divRecipes.slice(i, i + BATCH_SIZE)
    const names = batch.map(r => r.name)

    let fixes: NameFix[]
    try {
      fixes = await geminiFixNames(names, divisionName)
    } catch (err) {
      console.error(`  Gemini error on batch ${Math.floor(i / BATCH_SIZE) + 1}:`, err)
      totalFailed += batch.length
      continue
    }

    for (let j = 0; j < batch.length; j++) {
      const recipe = batch[j]
      const fix = fixes[j]

      if (!fix || fix.fixed === null) {
        totalSkipped++
        continue
      }

      console.log(`  RENAME: "${recipe.name}" → "${fix.fixed}"`)
      if (fix.reason) console.log(`         (${fix.reason})`)

      pendingFixes.push({ id: recipe.id, original: recipe.name, fixed: fix.fixed })
    }
  }
}

console.log()
console.log('═══════════════════════════════')
console.log(`To rename: ${pendingFixes.length}`)
console.log(`Skipped:   ${totalSkipped} (already correct)`)
console.log(`Failed:    ${totalFailed}`)

if (DRY_RUN) {
  await Deno.writeTextFile(RESULTS_FILE, JSON.stringify(pendingFixes, null, 2))
  console.log(`\nSaved to ${RESULTS_FILE}`)
  console.log('Run with --apply to write to the database.')
  Deno.exit(0)
}

// ── Live write phase (no --dry-run, no --apply) ───────────────────────────────

console.log('\nWriting to database...\n')
let succeeded = 0
let writeFailed = 0

for (const item of pendingFixes) {
  const { error } = await supabase
    .from('recipes')
    .update({ name: item.fixed })
    .eq('id', item.id)

  if (error) {
    console.error(`  ✗ "${item.original}": ${error.message}`)
    writeFailed++
  } else {
    succeeded++
  }
}

console.log(`\nDone. ${succeeded} renamed, ${writeFailed} failed.`)
