/**
 * submit-recipe-image-backfill.mjs
 *
 * Collects all recipes in active divisions with image_path IS NULL,
 * submits them as a single Gemini batch job, and saves the job file.
 *
 * Run:
 *   GEMINI_API_KEY=... node scripts/submit-recipe-image-backfill.mjs
 *
 * Options:
 *   --all       Include ALL ai-sourced recipes with null image_path (not just active divisions)
 *   --limit N   Cap number of recipes submitted (default: 500)
 *
 * After submitting, poll for completion:
 *   GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node scripts/poll-recipe-image-backfill.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'output')
const JOB_FILE  = join(__dirname, 'output', 'recipe-image-backfill-job.json')

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
  console.error('Run poll-recipe-image-backfill.mjs to process it, or delete it to start fresh.')
  process.exit(1)
}

const args    = process.argv.slice(2)
const ALL     = args.includes('--all')
const limitIdx = args.indexOf('--limit')
const LIMIT   = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 500

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const IMAGE_MODEL = 'gemini-2.5-flash-image'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const PHOTO_STYLES = [
  { surface: 'white Carrara marble',  angle: 'top-down overhead',     lighting: 'soft diffused natural window light',    mood: 'clean minimalist fine-dining' },
  { surface: 'dark walnut wood',      angle: 'top-down overhead',     lighting: 'warm golden-hour sunlight',             mood: 'rustic farmhouse' },
  { surface: 'aged grey concrete',    angle: '45-degree three-quarter', lighting: 'moody dramatic side lighting',         mood: 'urban bistro' },
  { surface: 'polished black slate',  angle: 'top-down overhead',     lighting: 'soft diffused studio light',            mood: 'modern fine dining' },
  { surface: 'warm beige linen cloth', angle: 'slight elevated angle', lighting: 'gentle afternoon light',               mood: 'cozy home kitchen' },
  { surface: 'terracotta tile',       angle: '45-degree three-quarter', lighting: 'warm Mediterranean sunlight',         mood: 'rustic trattoria' },
  { surface: 'reclaimed barn wood',   angle: 'top-down overhead',     lighting: 'soft candlelit warm glow',              mood: 'cozy dinner setting' },
  { surface: 'white ceramic tile',    angle: 'top-down overhead',     lighting: 'bright airy even lighting',             mood: 'fresh modern kitchen' },
  { surface: 'brushed copper sheet',  angle: '45-degree three-quarter', lighting: 'dramatic directional spotlight',      mood: 'bold high-end restaurant' },
  { surface: 'weathered oak plank',   angle: 'slight elevated angle', lighting: 'dappled natural forest light',          mood: 'farm-to-table rustic' },
]

function buildImagePrompt(recipeName) {
  const style = PHOTO_STYLES[Math.floor(Math.random() * PHOTO_STYLES.length)]
  return `Professional food photography of ${recipeName}. ${style.angle} shot on a ${style.surface} surface. ${style.lighting}. ${style.mood} presentation style. Garnished and plated for a high-end restaurant menu. Photorealistic, high resolution, appetizing, vibrant colors.`
}

// ── Collect target recipe IDs ─────────────────────────────────────────────────

let targetIds

if (ALL) {
  console.log('\nMode: ALL ai-sourced recipes with null image_path')
  const { data, error } = await supabase
    .from('recipes')
    .select('id')
    .eq('source', 'ai')
    .is('image_path', null)
    .limit(LIMIT)
  if (error) { console.error(error.message); process.exit(1) }
  targetIds = (data ?? []).map(r => r.id)
} else {
  console.log('\nMode: active division recipes with null image_path')
  const { data: divisions, error: divErr } = await supabase
    .from('plateoffs_divisions')
    .select('name, recipe_ids')
    .eq('is_active', true)
  if (divErr) { console.error(divErr.message); process.exit(1) }

  const allIds = [...new Set((divisions ?? []).flatMap(d => d.recipe_ids ?? []))]
  console.log(`Active divisions  : ${divisions?.length ?? 0}`)
  console.log(`Total recipe IDs  : ${allIds.length}`)

  const { data: missing, error: missErr } = await supabase
    .from('recipes')
    .select('id')
    .in('id', allIds)
    .is('image_path', null)
  if (missErr) { console.error(missErr.message); process.exit(1) }
  targetIds = (missing ?? []).map(r => r.id).slice(0, LIMIT)
}

if (!targetIds.length) {
  console.log('\nNo recipes need images. Nothing to submit.')
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
    contents: [{ parts: [{ text: buildImagePrompt(r.name) }] }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 1,
    },
  },
  metadata: { key: r.id },
}))

const res = await fetch(
  `${GEMINI_BASE}/models/${IMAGE_MODEL}:batchGenerateContent?key=${GEMINI_API_KEY}`,
  {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      batch: {
        display_name: 'recipe-image-backfill',
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
console.log(`    node scripts/poll-recipe-image-backfill.mjs`)
