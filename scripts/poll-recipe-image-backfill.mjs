/**
 * poll-recipe-image-backfill.mjs
 *
 * Checks the saved batch job. If complete, saves raw PNGs to
 * scripts/output/recipe-images/{id}.png — then run
 * upload-recipe-images.mjs to resize and upload to Supabase.
 *
 * Uses streaming JSON parsing to handle large responses without hitting
 * Node's string length limit.
 *
 * Run:
 *   GEMINI_API_KEY=... node scripts/poll-recipe-image-backfill.mjs
 */

import chain from 'stream-chain'
import { parser } from 'stream-json'
import { pick } from 'stream-json/filters/pick.js'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, createWriteStream, createReadStream, openSync, readSync, closeSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'output', 'recipe-images')
const JOB_FILE  = join(__dirname, 'output', 'recipe-image-backfill-job.json')
const TMP_FILE  = join(__dirname, 'output', 'recipe-image-backfill-response.tmp.json')

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) { console.error('Required: GEMINI_API_KEY'); process.exit(1) }

if (!existsSync(JOB_FILE)) {
  console.error(`No job file found at ${JOB_FILE}`)
  console.error('Run submit-recipe-image-backfill.mjs first.')
  process.exit(1)
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

const saved = JSON.parse(readFileSync(JOB_FILE, 'utf8'))
const { jobName, recipes, submittedAt } = saved

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const elapsed = Math.round((Date.now() - new Date(submittedAt).getTime()) / 60000)
console.log(`\nJob      : ${jobName}`)
console.log(`Submitted: ${submittedAt} (${elapsed} min ago)`)
console.log(`Recipes  : ${recipes.length}`)
console.log(`\nDownloading response (streaming to disk)...`)

// ── Stream response to temp file (avoids string length limit) ─────────────────

const url = `${BASE_URL}/${jobName}?key=${GEMINI_API_KEY}`

await new Promise((resolve, reject) => {
  const file = createWriteStream(TMP_FILE)
  https.get(url, (res) => {
    if (res.statusCode !== 200) {
      let body = ''
      res.on('data', d => body += d)
      res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`)))
      return
    }
    res.pipe(file)
    file.on('finish', resolve)
    file.on('error', reject)
  }).on('error', reject)
})

console.log('Download complete. Parsing...')

// ── Check if still running (peek at the file) ─────────────────────────────────
// The response will be missing inlinedResponses if the job isn't done yet.

const peek = Buffer.alloc(512)
const fd_ = openSync(TMP_FILE, 'r')
readSync(fd_, peek, 0, 512, 0)
closeSync(fd_)
const head = peek.toString('utf8')

if (!head.includes('inlinedResponses')) {
  console.log('\nStatus: still running — check back in a few minutes.')
  console.log('  Re-run: node scripts/poll-recipe-image-backfill.mjs')
  try { unlinkSync(TMP_FILE) } catch {}
  process.exit(0)
}

// ── Build recipe lookup: id → name ────────────────────────────────────────────

const recipeMap = {}
for (const r of recipes) recipeMap[r.id] = r.name

// ── Stream-parse responses and save PNGs ──────────────────────────────────────

let saved_count  = 0
let failed_count = 0
let itemCount    = 0
const failedNames = []

await new Promise((resolve, reject) => {
  const pipeline = chain([
    createReadStream(TMP_FILE),
    parser(),
    pick({ filter: 'metadata.output.inlinedResponses.inlinedResponses' }),
    streamArray(),
    async ({ value: item }) => {
      itemCount++
      const id     = item.metadata?.key ?? item.key
      const name   = recipeMap[id] ?? `(unknown: ${id})`
      const idx    = recipes.findIndex(r => r.id === id)
      const prefix = `[${idx + 1}/${recipes.length}]`
      const outPath = join(OUT_DIR, `${id}.png`)

      if (existsSync(outPath)) {
        console.log(`${prefix} skip  ${name} (already saved)`)
        saved_count++
        return null
      }

      const parts     = item.response?.candidates?.[0]?.content?.parts ?? []
      const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))

      if (!imagePart) {
        const textPart = parts.find(p => p.text)
        console.log(`${prefix} ✗  ${name} — no image. ${textPart?.text?.slice(0, 80) ?? 'no response'}`)
        failedNames.push(name)
        failed_count++
        return null
      }

      const buf = Buffer.from(imagePart.inlineData.data, 'base64')
      writeFileSync(outPath, buf)
      console.log(`${prefix} ✓  ${name}  (${Math.round(buf.length / 1024)} KB)`)
      saved_count++
      return null
    },
  ])

  pipeline.on('finish', resolve)
  pipeline.on('error', reject)
})

// ── Summary ───────────────────────────────────────────────────────────────────

if (itemCount === 0) {
  console.log('\nStatus: still running — no responses parsed.')
  try { unlinkSync(TMP_FILE) } catch {}
  process.exit(0)
}

console.log(`\n── Summary ───────────────────────────────────────`)
console.log(`  Saved  : ${saved_count}`)
console.log(`  Failed : ${failed_count}`)

if (failedNames.length) {
  console.log(`\n  Failed:`)
  failedNames.forEach(n => console.log(`    - ${n}`))
}

try { unlinkSync(TMP_FILE) } catch {}
try { unlinkSync(JOB_FILE) } catch {}
console.log(`\nJob file cleaned up.`)
console.log(`\nNext: resize and upload images to Supabase:`)
console.log(`  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-recipe-images.mjs`)
