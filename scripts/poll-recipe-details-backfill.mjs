/**
 * poll-recipe-details-backfill.mjs
 *
 * Checks the saved batch job once. If complete, parses ingredients and
 * instructions from each response and writes them to the recipes table.
 * If still running, prints status and exits cleanly — re-run to check again.
 *
 * Run:
 *   GEMINI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
 *     node scripts/poll-recipe-details-backfill.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JOB_FILE  = join(__dirname, 'output', 'recipe-details-backfill-job.json')

const GEMINI_API_KEY       = process.env.GEMINI_API_KEY
const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Required: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

if (!existsSync(JOB_FILE)) {
  console.error(`No job file found at ${JOB_FILE}`)
  console.error('Run submit-recipe-details-backfill.mjs first.')
  process.exit(1)
}

const saved = JSON.parse(readFileSync(JOB_FILE, 'utf8'))
const { jobName, recipes, submittedAt } = saved

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const elapsed = Math.round((Date.now() - new Date(submittedAt).getTime()) / 60000)
console.log(`\nJob      : ${jobName}`)
console.log(`Submitted: ${submittedAt} (${elapsed} min ago)`)
console.log(`Recipes  : ${recipes.length}`)
console.log(`\nChecking status...`)

// ── Poll once ─────────────────────────────────────────────────────────────────

const res = await fetch(`${GEMINI_BASE}/${jobName}?key=${GEMINI_API_KEY}`)
if (!res.ok) {
  console.error(`Poll failed ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const status = await res.json()

if (status.error) {
  console.error('\nJob failed:', JSON.stringify(status.error, null, 2))
  process.exit(1)
}

const rawResponses = status.metadata?.output?.inlinedResponses?.inlinedResponses ?? []

if (rawResponses.length === 0) {
  console.log('\nStatus: still running — check back in a few minutes.')
  console.log('  Re-run: node scripts/poll-recipe-details-backfill.mjs')
  process.exit(0)
}

console.log(`\nStatus: COMPLETE ✓  (${rawResponses.length} responses)\n`)

// ── Build response map: recipeId → response ───────────────────────────────────

const responseMap = {}
for (const r of rawResponses) {
  const key = r.metadata?.key ?? r.key
  if (key) responseMap[key] = r.response ?? r
}

// ── Process each recipe ───────────────────────────────────────────────────────

let success = 0
let failed  = 0
const failedNames = []

for (let i = 0; i < recipes.length; i++) {
  const { id, name } = recipes[i]
  const response = responseMap[id] ?? rawResponses[i]
  const prefix   = `[${i + 1}/${recipes.length}]`

  const parts    = response?.candidates?.[0]?.content?.parts ?? []
  const textPart = parts.find(p => p.text)

  if (!textPart) {
    console.log(`${prefix} ✗  ${name} — no text response`)
    failedNames.push(name)
    failed++
    continue
  }

  let details
  try {
    const raw = textPart.text.trim()
    // Strip markdown code fences if the model included them
    const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    details = JSON.parse(cleaned)
  } catch {
    console.log(`${prefix} ✗  ${name} — JSON parse failed: ${textPart.text.slice(0, 80)}`)
    failedNames.push(name)
    failed++
    continue
  }

  const { ingredients, instructions } = details

  if (!Array.isArray(ingredients) || !Array.isArray(instructions)) {
    console.log(`${prefix} ✗  ${name} — missing ingredients or instructions in response`)
    failedNames.push(name)
    failed++
    continue
  }

  const updates = { ingredients, instructions }

  const { error: updateErr } = await supabase
    .from('recipes')
    .update(updates)
    .eq('id', id)

  if (updateErr) {
    console.log(`${prefix} ✗  ${name} — DB update failed: ${updateErr.message}`)
    failedNames.push(name)
    failed++
    continue
  }

  console.log(`${prefix} ✓  ${name}  (${ingredients.length} ingredients, ${instructions.length} steps)`)
  success++
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n── Summary ───────────────────────────────────────`)
console.log(`  Success: ${success}`)
console.log(`  Failed : ${failed}`)

if (failedNames.length) {
  console.log(`\n  Failed:`)
  failedNames.forEach(n => console.log(`    - ${n}`))
}

// Clean up job file on completion (even partial — job is done either way)
try { unlinkSync(JOB_FILE) } catch {}
console.log(`\nJob file cleaned up.`)
