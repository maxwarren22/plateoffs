/**
 * backfill-recipe-details-retry.mjs
 *
 * Sequentially fetches and writes ingredients + instructions for any active
 * division recipes that still have empty arrays. Use this to handle stragglers
 * after the batch job completes (e.g. recipes whose responses failed to parse).
 *
 * Run:
 *   GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node scripts/backfill-recipe-details-retry.mjs
 *
 * Options:
 *   --all   Include ALL ai-sourced recipes with empty ingredients/instructions
 */

import { createClient } from '@supabase/supabase-js'

const GEMINI_API_KEY       = process.env.GEMINI_API_KEY
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Required: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const ALL = process.argv.includes('--all')

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const TEXT_MODEL  = 'gemini-2.5-flash'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function buildDetailsPrompt(recipeName) {
  return `You are a professional chef. Provide the full recipe for "${recipeName}".

Return ONLY a valid JSON object. No markdown, no code fences, no prose outside the JSON:
{
  "ingredients": ["quantity unit item", "quantity unit item"],
  "instructions": ["Step 1 description.", "Step 2 description."]
}`
}

async function fetchDetails(recipeName) {
  const res = await fetch(
    `${GEMINI_BASE}/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildDetailsPrompt(recipeName) }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return JSON.parse(text)
}

// ── Collect targets ───────────────────────────────────────────────────────────

let recipes

if (ALL) {
  console.log('\nMode: ALL ai-sourced recipes with empty ingredients or instructions')
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, ingredients, instructions')
    .eq('source', 'ai')
  if (error) { console.error(error.message); process.exit(1) }
  recipes = (data ?? []).filter(r =>
    r.ingredients == null || r.ingredients.length === 0 ||
    r.instructions == null || r.instructions.length === 0
  )
} else {
  console.log('\nMode: active division recipes with empty ingredients or instructions')
  const { data: divs, error: divErr } = await supabase
    .from('plateoffs_divisions')
    .select('recipe_ids')
    .eq('is_active', true)
  if (divErr) { console.error(divErr.message); process.exit(1) }

  const allIds = [...new Set((divs ?? []).flatMap(d => d.recipe_ids ?? []))]
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, ingredients, instructions')
    .in('id', allIds)
  if (error) { console.error(error.message); process.exit(1) }
  recipes = (data ?? []).filter(r =>
    r.ingredients == null || r.ingredients.length === 0 ||
    r.instructions == null || r.instructions.length === 0
  )
}

if (!recipes.length) {
  console.log('\nNo recipes need details. Nothing to do.')
  process.exit(0)
}

console.log(`\nProcessing ${recipes.length} recipes sequentially...\n`)

let success = 0
let failed  = 0
const failedNames = []

for (let i = 0; i < recipes.length; i++) {
  const { id, name } = recipes[i]
  const prefix = `[${i + 1}/${recipes.length}]`
  process.stdout.write(`${prefix} ${name} ... `)

  try {
    const { ingredients, instructions } = await fetchDetails(name)

    if (!Array.isArray(ingredients) || !Array.isArray(instructions)) {
      throw new Error('Response missing ingredients or instructions arrays')
    }

    const { error } = await supabase
      .from('recipes')
      .update({ ingredients, instructions })
      .eq('id', id)

    if (error) throw new Error(error.message)

    console.log(`✓  (${ingredients.length} ingredients, ${instructions.length} steps)`)
    success++
  } catch (err) {
    console.log(`✗  ${err.message}`)
    failedNames.push(name)
    failed++
  }
}

console.log(`\n── Summary ───────────────────────────────────────`)
console.log(`  Success: ${success}`)
console.log(`  Failed : ${failed}`)
if (failedNames.length) {
  console.log(`\n  Failed:`)
  failedNames.forEach(n => console.log(`    - ${n}`))
}
