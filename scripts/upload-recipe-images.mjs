/**
 * upload-recipe-images.mjs
 *
 * Reads raw PNGs from scripts/output/recipe-images/,
 * resizes to 900×1200 JPEG q82, uploads to Supabase "recipe-images" bucket,
 * and updates image_path on each recipe row.
 *
 * Safe to re-run — uses upsert for storage.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-recipe-images.mjs
 *
 * Optional — process a single recipe ID only:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-recipe-images.mjs <id>
 */

import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IN_DIR    = join(__dirname, 'output', 'recipe-images')

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET = 'recipe-images'

const TARGET_W = 900
const TARGET_H = 1200
const QUALITY  = 82

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

if (!existsSync(IN_DIR)) {
  console.error(`Input directory not found: ${IN_DIR}`)
  console.error('Run poll-recipe-image-backfill.mjs first.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const targetId   = process.argv[2] || null
const available  = readdirSync(IN_DIR).filter(f => f.endsWith('.png')).map(f => f.replace('.png', ''))
const ids        = targetId ? [targetId] : available

if (ids.length === 0) {
  console.error('No PNG files found in', IN_DIR)
  process.exit(1)
}

console.log(`\nProcessing ${ids.length} image(s)...\n`)

async function processAndUpload(id) {
  const inPath = join(IN_DIR, `${id}.png`)
  if (!existsSync(inPath)) throw new Error(`Source file not found: ${inPath}`)

  const imageBuffer = await sharp(inPath)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer()

  const storagePath = `ai-generated/${id}.jpg`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imageBuffer, { contentType: 'image/jpeg', upsert: true })

  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

  const { error: dbErr } = await supabase
    .from('recipes')
    .update({ image_path: storagePath })
    .eq('id', id)

  if (dbErr) throw new Error(`DB update failed: ${dbErr.message}`)

  return Math.round(imageBuffer.length / 1024)
}

let succeeded = 0
let failed    = 0
const failures = []

for (let i = 0; i < ids.length; i++) {
  const id = ids[i]
  process.stdout.write(`[${i + 1}/${ids.length}] ${id} ... `)

  try {
    const kb = await processAndUpload(id)
    console.log(`✓  ${kb} KB`)
    succeeded++
  } catch (err) {
    console.log(`✗  ${err.message}`)
    failures.push({ id, error: err.message })
    failed++
  }
}

console.log(`\n── Summary ─────────────────────────────────────`)
console.log(`  Succeeded: ${succeeded}`)
console.log(`  Failed:    ${failed}`)
if (failures.length) {
  console.log(`\n  Failed IDs:`)
  failures.forEach(f => console.log(`    ${f.id}: ${f.error}`))
}
