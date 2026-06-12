/**
 * One-time fix: translate non-English recipe names in the Taco Tuesday
 * Forever division bank (category 'wildcard' — not covered by
 * fix-international-recipe-names.ts, which only targets 'cuisine' divisions).
 *
 * Run:
 *   set -a && source .env.local && set +a
 *   deno run --allow-net --allow-env scripts/fix-taco-tuesday-names.ts --dry-run
 *   deno run --allow-net --allow-env scripts/fix-taco-tuesday-names.ts --apply
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('EXPO_PUBLIC_SUPABASE_URL')!
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_KEY   = Deno.env.get('GEMINI_API_KEY')!

const CATALOG_ID = 'a338bf18-b1df-4e8a-8ccb-cbc977bcde5f' // Taco Tuesday Forever
const DRY_RUN = Deno.args.includes('--dry-run')
const APPLY   = Deno.args.includes('--apply')

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

interface NameFix {
  original: string
  fixed: string | null
  reason: string | null
}

async function geminiFixNames(names: string[]): Promise<NameFix[]> {
  const prompt = `You are a culinary editor for a food tournament app. You are reviewing recipe names from the "Taco Tuesday Forever" division (Mexican/Tex-Mex themed).

For each name below, determine if it needs to be fixed. A name needs fixing if it is written as a Spanish phrase/description rather than a recognizable dish name (e.g. "Camarones a la Diabla con Arroz Blanco" should become "Camarones a la Diabla" or "Diabla Shrimp with White Rice").

Rules for fixed names:
- Prefer the common English name where one exists (e.g. "Steak Tacos" not "Tacos de Carne Asada")
- For dishes where the Spanish name IS the common name used in English (e.g. "Pozole", "Chilaquiles", "Tlacoyos", "Mole Poblano", "Caldo Tlalpeño", "Horchata"), keep the Spanish dish name but translate any extra Spanish descriptive words around it into English
- Must be 1-5 words, 40 characters max
- Do NOT include dietary descriptors ("Vegan", "Vegetarian", "Gluten-Free", "Dairy-Free")
- Must remain an authentic, recognizable name for the dish

Input names:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

Return ONLY a JSON array with one object per name, in the same order:
[{
  "original": string,
  "fixed": string | null,
  "reason": string | null
}]
Set "fixed" to null and "reason" to null if the name is already correct and within length limits.`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
  return JSON.parse(text)
}

const { data: bank, error: bankErr } = await supabase
  .from('division_recipe_bank')
  .select('recipe_id')
  .eq('catalog_id', CATALOG_ID)
if (bankErr) { console.error(bankErr.message); Deno.exit(1) }

const ids = (bank ?? []).map((r: { recipe_id: string }) => r.recipe_id)
const { data: recipes, error: recErr } = await supabase.from('recipes').select('id, name').in('id', ids)
if (recErr) { console.error(recErr.message); Deno.exit(1) }

console.log(`Checking ${recipes!.length} recipe names...\n`)

const BATCH = 15
const fixes: { id: string; original: string; fixed: string }[] = []

for (let i = 0; i < recipes!.length; i += BATCH) {
  const batch = recipes!.slice(i, i + BATCH)
  const result = await geminiFixNames(batch.map(r => r.name))
  for (let j = 0; j < batch.length; j++) {
    const fix = result[j]
    if (!fix || fix.fixed === null) continue
    console.log(`  RENAME: "${batch[j].name}" → "${fix.fixed}"${fix.reason ? ` (${fix.reason})` : ''}`)
    fixes.push({ id: batch[j].id, original: batch[j].name, fixed: fix.fixed })
  }
}

console.log(`\nTo rename: ${fixes.length}`)

if (DRY_RUN) {
  console.log('\nDry run — re-run with --apply to write to the database.')
  Deno.exit(0)
}

if (APPLY) {
  let succeeded = 0
  for (const fix of fixes) {
    const { error } = await supabase.from('recipes').update({ name: fix.fixed }).eq('id', fix.id)
    if (error) console.error(`  ✗ "${fix.original}": ${error.message}`)
    else succeeded++
  }
  console.log(`\nApplied ${succeeded}/${fixes.length} renames.`)
}
