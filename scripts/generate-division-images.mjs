/**
 * generate-division-images.mjs
 *
 * Submits all division cover image prompts as a single Gemini batch job
 * (50% cheaper than real-time requests). Polls for completion and saves
 * each result as a PNG in scripts/output/division-covers/.
 *
 * The job ID is saved to scripts/output/batch-job.json so you can
 * re-run this script to resume polling if it's interrupted.
 *
 * Model: gemini-2.5-flash-image (Nano Banana — recommended for batch;
 *        gemini-3.1-flash-image-preview has known batch stall issues)
 *
 * Run:
 *   GEMINI_API_KEY=your_key node scripts/generate-division-images.mjs
 *
 * Resume polling after interruption (re-run the same command):
 *   GEMINI_API_KEY=your_key node scripts/generate-division-images.mjs
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DIVISION_PROMPTS } from './prompts/division-covers.mjs'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const OUT_DIR    = join(__dirname, 'output', 'division-covers')
const JOB_FILE   = join(__dirname, 'output', 'batch-job.json')

const API_KEY    = process.env.GEMINI_API_KEY || ''
const MODEL      = 'gemini-2.5-flash-image'
const BASE_URL   = 'https://generativelanguage.googleapis.com/v1beta'

const POLL_INTERVAL_MS = 30_000   // poll every 30 seconds
const MAX_POLLS        = 360      // give up after 3 hours (360 × 30s)

if (!API_KEY) {
  console.error('Set GEMINI_API_KEY env var before running.')
  process.exit(1)
}

if (!existsSync(join(__dirname, 'output'))) mkdirSync(join(__dirname, 'output'), { recursive: true })
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Step 1: Submit batch (or resume existing job) ─────────────────────────────

const slugs = Object.keys(DIVISION_PROMPTS)
let jobName

if (existsSync(JOB_FILE)) {
  const saved = JSON.parse(readFileSync(JOB_FILE, 'utf8'))
  jobName = saved.jobName
  console.log(`\nResuming existing batch job: ${jobName}`)
  console.log(`Submitted at: ${saved.submittedAt}`)
} else {
  console.log(`\nSubmitting batch job with ${slugs.length} image requests...`)

  const requests = slugs.map(slug => ({
    request: {
      contents: [{ parts: [{ text: DIVISION_PROMPTS[slug].trim() }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        temperature: 1,
      },
    },
    metadata: { key: slug },
  }))

  const res = await fetch(
    `${BASE_URL}/models/${MODEL}:batchGenerateContent?key=${API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        batch: {
          display_name: 'division-covers',
          input_config: {
            requests: { requests },
          },
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
  jobName = job.name

  writeFileSync(JOB_FILE, JSON.stringify({
    jobName,
    slugs,
    submittedAt: new Date().toISOString(),
  }, null, 2))

  console.log(`✓ Batch job submitted: ${jobName}`)
  console.log(`  Job ID saved to: ${JOB_FILE}`)
  console.log(`  Polling every ${POLL_INTERVAL_MS / 1000}s (max 3 hours)...`)
}

// ── Step 2: Poll for completion ───────────────────────────────────────────────

console.log()
let polls = 0

while (polls < MAX_POLLS) {
  await sleep(POLL_INTERVAL_MS)
  polls++

  const statusRes = await fetch(`${BASE_URL}/${jobName}?key=${API_KEY}`)

  if (!statusRes.ok) {
    console.error(`Poll failed ${statusRes.status}: ${await statusRes.text()}`)
    continue
  }

  const status  = await statusRes.json()
  const elapsed = Math.round((polls * POLL_INTERVAL_MS) / 60000)

  // Gemini batch API signals completion via output data, not a state field
  const rawResponses = status.metadata?.output?.inlinedResponses?.inlinedResponses ?? []

  if (status.error) {
    console.log(`\n✗ Batch job failed:`)
    console.log(JSON.stringify(status.error, null, 2))
    process.exit(1)
  }

  process.stdout.write(`  [${elapsed}m] ${rawResponses.length > 0 ? 'COMPLETE' : 'RUNNING'}\r`)

  if (rawResponses.length > 0) {
    console.log(`\n✓ Batch job completed after ~${elapsed} minutes.\n`)

    // ── Step 3: Save images ───────────────────────────────────────────────────

    // Build a map from slug → response
    const responseMap = {}
    for (const r of rawResponses) {
      const key = r.metadata?.key ?? r.key
      if (key) responseMap[key] = r.response ?? r
    }

    const saved        = JSON.parse(readFileSync(JOB_FILE, 'utf8'))
    const orderedSlugs = saved.slugs ?? slugs

    let saved_count = 0
    let failed_count = 0

    for (let i = 0; i < orderedSlugs.length; i++) {
      const slug     = orderedSlugs[i]
      const response = responseMap[slug] ?? rawResponses[i]
      const outPath  = join(OUT_DIR, `${slug}.png`)

      if (existsSync(outPath)) {
        console.log(`  skip  ${slug} (already exists)`)
        saved_count++
        continue
      }

      const parts     = response?.candidates?.[0]?.content?.parts ?? []
      const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))

      if (!imagePart) {
        const textPart = parts.find(p => p.text)
        console.log(`  ✗ ${slug} — no image. Model said: ${textPart?.text?.slice(0, 120) ?? 'nothing'}`)
        failed_count++
        continue
      }

      const buf = Buffer.from(imagePart.inlineData.data, 'base64')
      writeFileSync(outPath, buf)
      console.log(`  ✓ ${slug}  (${Math.round(buf.length / 1024)} KB)`)
      saved_count++
    }

    console.log(`\n── Summary ─────────────────────────────────────────`)
    console.log(`  Saved  : ${saved_count}`)
    console.log(`  Failed : ${failed_count}`)
    console.log(`\nImages saved to : ${OUT_DIR}`)

    if (failed_count === 0) {
      // Clean up job file on full success
      import('fs').then(({ unlinkSync }) => {
        try { unlinkSync(JOB_FILE) } catch {}
      })
    } else {
      console.log(`\nFor failed slugs, run individually in real-time mode:`)
      console.log(`  GEMINI_API_KEY=... node scripts/generate-single-image.mjs <slug>`)
    }

    console.log(`\nNext step: node scripts/upload-division-images.mjs`)
    process.exit(0)
  }

}

console.log(`\n✗ Timed out after ${MAX_POLLS} polls. Re-run this script to resume polling.`)
