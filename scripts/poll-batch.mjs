/**
 * poll-batch.mjs
 *
 * Checks the status of the saved batch job once and exits.
 * If complete, saves all images to scripts/output/division-covers/.
 * If still running, prints the current state and exits cleanly.
 *
 * Run whenever you want to check:
 *   GEMINI_API_KEY=your_key node scripts/poll-batch.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'output', 'division-covers')
const JOB_FILE  = join(__dirname, 'output', 'batch-job.json')
const API_KEY   = process.env.GEMINI_API_KEY || ''
const BASE_URL  = 'https://generativelanguage.googleapis.com/v1beta'

if (!API_KEY) { console.error('Set GEMINI_API_KEY env var.'); process.exit(1) }
if (!existsSync(JOB_FILE)) {
  console.error(`No saved job found at ${JOB_FILE}`)
  console.error('Run generate-division-images.mjs first to submit the batch.')
  process.exit(1)
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const saved   = JSON.parse(readFileSync(JOB_FILE, 'utf8'))
const { jobName, slugs, submittedAt } = saved

const elapsed = Math.round((Date.now() - new Date(submittedAt).getTime()) / 60000)
console.log(`\nJob     : ${jobName}`)
console.log(`Submitted: ${submittedAt} (${elapsed} min ago)`)
console.log(`Checking status...\n`)

const res = await fetch(`${BASE_URL}/${jobName}?key=${API_KEY}`)

if (!res.ok) {
  console.error(`Poll failed ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const status = await res.json()

// Gemini batch API signals completion via output data, not a state field
const rawResponses = status.metadata?.output?.inlinedResponses?.inlinedResponses ?? []

if (status.error) {
  console.log('Job failed:', JSON.stringify(status.error, null, 2))
  process.exit(1)
}

if (rawResponses.length === 0) {
  console.log('Status: still running — check back in a few minutes.')
  console.log(`  GEMINI_API_KEY=your_key node scripts/poll-batch.mjs`)
  process.exit(0)
}

console.log(`Status: COMPLETE ✓ — saving ${rawResponses.length} images...\n`)

const responseMap = {}
for (const r of rawResponses) {
  const key = r.metadata?.key ?? r.key
  if (key) responseMap[key] = r.response ?? r
}

let saved_count  = 0
let failed_count = 0
const failed_slugs = []

for (let i = 0; i < slugs.length; i++) {
  const slug     = slugs[i]
  const response = responseMap[slug] ?? rawResponses[i]
  const outPath  = join(OUT_DIR, `${slug}.png`)

  if (existsSync(outPath)) {
    console.log(`  skip  ${slug} (already saved)`)
    saved_count++
    continue
  }

  const parts     = response?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))

  if (!imagePart) {
    const textPart = parts.find(p => p.text)
    console.log(`  ✗  ${slug} — no image. Model: ${textPart?.text?.slice(0, 100) ?? 'no response'}`)
    failed_slugs.push(slug)
    failed_count++
    continue
  }

  const buf = Buffer.from(imagePart.inlineData.data, 'base64')
  writeFileSync(outPath, buf)
  console.log(`  ✓  ${slug}  (${Math.round(buf.length / 1024)} KB)`)
  saved_count++
}

console.log(`\n── Summary ──────────────────────────────`)
console.log(`  Saved  : ${saved_count}`)
console.log(`  Failed : ${failed_count}`)

if (failed_slugs.length) {
  console.log(`\n  Retry failed slugs individually:`)
  failed_slugs.forEach(s =>
    console.log(`    GEMINI_API_KEY=your_key node scripts/generate-single-image.mjs ${s}`)
  )
}

// Clean up job file on success
try { unlinkSync(JOB_FILE) } catch {}

console.log(`\nNext step: SUPABASE_SERVICE_KEY=your_key node scripts/upload-division-images.mjs`)
