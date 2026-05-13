/**
 * generate-single-image.mjs
 *
 * Real-time fallback for slugs that failed in the batch job.
 *
 * Run:
 *   GEMINI_API_KEY=your_key node scripts/generate-single-image.mjs <slug>
 *   GEMINI_API_KEY=your_key node scripts/generate-single-image.mjs protein-throne
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DIVISION_PROMPTS } from './prompts/division-covers.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR   = join(__dirname, 'output', 'division-covers')
const API_KEY   = process.env.GEMINI_API_KEY || ''
const MODEL     = 'gemini-2.5-flash-image'
const BASE_URL  = 'https://generativelanguage.googleapis.com/v1beta'

const slug = process.argv[2]

if (!API_KEY) { console.error('Set GEMINI_API_KEY env var.'); process.exit(1) }
if (!slug)    { console.error('Usage: node generate-single-image.mjs <slug>'); process.exit(1) }
if (!DIVISION_PROMPTS[slug]) {
  console.error(`Unknown slug: "${slug}"`)
  console.error(`Available: ${Object.keys(DIVISION_PROMPTS).join(', ')}`)
  process.exit(1)
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

console.log(`\nGenerating: ${slug}`)

const res = await fetch(
  `${BASE_URL}/models/${MODEL}:generateContent?key=${API_KEY}`,
  {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: DIVISION_PROMPTS[slug].trim() }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 1 },
    }),
  }
)

if (!res.ok) {
  console.error(`API ${res.status}: ${await res.text()}`)
  process.exit(1)
}

const json      = await res.json()
const parts     = json.candidates?.[0]?.content?.parts ?? []
const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'))

if (!imagePart) {
  const textPart = parts.find(p => p.text)
  console.error(`No image returned. Model said: ${textPart?.text ?? 'nothing'}`)
  process.exit(1)
}

const buf     = Buffer.from(imagePart.inlineData.data, 'base64')
const outPath = join(OUT_DIR, `${slug}.png`)
writeFileSync(outPath, buf)
console.log(`✓ Saved: ${outPath}  (${Math.round(buf.length / 1024)} KB)`)
console.log(`Next: node scripts/upload-division-images.mjs ${slug}`)
