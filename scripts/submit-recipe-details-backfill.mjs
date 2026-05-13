/**
 * submit-recipe-details-backfill.mjs
 *
 * Collects all recipes in active divisions that are missing ingredients or
 * instructions, submits them as a single Gemini batch job, and saves the job file.
 *
 * Run:
 *   GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node scripts/submit-recipe-details-backfill.mjs
 *
 * Options:
 *   --all       Include ALL ai-sourced recipes missing details (not just active divisions)
 *   --limit N   Cap number of recipes submitted (default: 500)
 *
 * After submitting, poll for completion:
 *   GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node scripts/poll-recipe-details-backfill.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'output')
const JOB_FILE  = join(__dirname, 'output', 'recipe-details-backfill-job.json')

const GEMINI_API_KEY       = process.env.GEMINI_API_KEY
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Required: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

if (existsSync(JOB_FILE)) {
  console.error(`A job file already exists at ${JOB_FILE}`)
  console.error('Run poll-recipe-details-backfill.mjs to process it, or delete it to start fresh.')
  process.exit(1)
}

const args     = process.argv.slice(2)
const ALL      = args.includes('--all')
const limitIdx = args.indexOf('--limit')
const LIMIT    = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 500

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const TEXT_MODEL  = 'gemini-2.5-flash'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function buildDetailsPrompt(recipeName) {
  return `You are a professional chef. Provide the full recipe for "${recipeName}".

Return ONLY a JSON object with no markdown or prose:
{
  "description": "Short, appetizing 1-2 sentence description of the dish",
  "ingredients": ["quantity unit item", "quantity unit item", ...],
  "instructions": ["Step 1 description.", "Step 2 description.", ...]
}`
}

// ── Collect target recipe IDs ─────────────────────────────────────────────────

let targetIds

if (ALL) {
  console.log('\nMode: ALL ai-sourced recipes missing ingredients or instructions')
  const { data, error } = await supabase
    .from('recipes')
    .select('id, ingredients, instructions')
    .eq('source', 'ai')
    .limit(LIMIT)
  if (error) { console.error(error.message); process.exit(1) }
  targetIds = (data ?? [])
    .filter(r =>
      r.ingredients == null || r.ingredients.length === 0 ||
      r.instructions == null || r.instructions.length === 0
    )
    .map(r => r.id)
} else {
  console.log('\nMode: active division recipes missing ingredients or instructions')
  const { data: divisions, error: divErr } = await supabase
    .from('plateoffs_divisions')
    .select('name, recipe_ids')
    .eq('is_active', true)
  if (divErr) { console.error(divErr.message); process.exit(1) }

  const allIds = [...new Set((divisions ?? []).flatMap(d => d.recipe_ids ?? []))]
  console.log(`Active divisions  : ${divisions?.length ?? 0}`)
  console.log(`Total recipe IDs  : ${allIds.length}`)

  const { data: candidates, error: missErr } = await supabase
    .from('recipes')
    .select('id, ingredients, instructions')
    .in('id', allIds)
  if (missErr) { console.error(missErr.message); process.exit(1) }
  targetIds = (candidates ?? [])
    .filter(r =>
      r.ingredients == null || r.ingredients.length === 0 ||
      r.instructions == null || r.instructions.length === 0
    )
    .map(r => r.id)
    .slice(0, LIMIT)
}

if (!targetIds.length) {
  console.log('\nNo recipes are missing details. Nothing to submit.')
  process.exit(0)
}

// ── Fetch names ───────────────────────────────────────────────────────────────

const { data: recipes, error: recipeErr } = await supabase
  .from('recipes')
  .select('id, name')
  .in('id', targetIds)
if (recipeErr) { console.error(recipeErr.message); process.exit(1) }

console.log(`\nSubmitting batch for ${recipes.length} recipes...\n`)

// ── Submit batch ──────────────────────────────────────────────────────────────

const requests = recipes.map(r => ({
  request: {
    contents: [{ parts: [{ text: buildDetailsPrompt(r.name) }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  },
  metadata: { key: r.id },
}))

const res = await fetch(
  `${GEMINI_BASE}/models/${TEXT_MODEL}:batchGenerateContent?key=${GEMINI_API_KEY}`,
  {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      batch: {
        display_name: 'recipe-details-backfill',
        input_config: { requests: { requests } },
      },
    }),
  }
)

if (!res.ok) {
  const body = await res.text()
  console.error(`Batch submission failed ${res.status}:\n${body}`)
  process.exit(1)
}

const job = await res.json()
const jobName = job.name

writeFileSync(JOB_FILE, JSON.stringify({
  jobName,
  recipes,   // [{id, name}] — needed by poll script to match responses
  submittedAt: new Date().toISOString(),
}, null, 2))

console.log(`✓ Batch job submitted: ${jobName}`)
console.log(`  ${recipes.length} recipes queued`)
console.log(`  Job saved to: ${JOB_FILE}`)
console.log(`\nWhen ready, poll for completion:`)
console.log(`  GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \\`)
console.log(`    node scripts/poll-recipe-details-backfill.mjs`)
