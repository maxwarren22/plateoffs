/**
 * upload-division-images.mjs
 *
 * 1. Reads all PNGs from scripts/output/division-covers/
 * 2. Resizes each to 900px wide, 3:4 aspect ratio, JPEG quality 82
 * 3. Uploads to Supabase "division-cover-images" bucket at covers/<slug>.jpg
 * 4. Updates division_catalog.cover_image_url for each slug
 *
 * Safe to re-run — uses upsert for storage and update for DB.
 *
 * Run:
 *   SUPABASE_SERVICE_KEY=your_key node scripts/upload-division-images.mjs
 *
 * Optional — process a single slug only:
 *   SUPABASE_SERVICE_KEY=your_key node scripts/upload-division-images.mjs protein-throne
 */

import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const IN_DIR     = join(__dirname, 'output', 'division-covers')

const SUPABASE_URL = 'https://ppdgdwfiwgwifzykkngr.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const BUCKET       = 'division-cover-images'

// Target dimensions: 900px wide, 3:4 → 1200px tall
const TARGET_W = 900
const TARGET_H = 1200
const QUALITY  = 82

if (!SUPABASE_KEY) {
  console.error('Set SUPABASE_SERVICE_KEY env var before running.')
  process.exit(1)
}

if (!existsSync(IN_DIR)) {
  console.error(`Input directory not found: ${IN_DIR}`)
  console.error('Run generate-division-images.mjs first.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Determine which slugs to process
const targetSlug = process.argv[2] || null
const available  = readdirSync(IN_DIR)
  .filter(f => f.endsWith('.png'))
  .map(f => f.replace('.png', ''))

const slugs = targetSlug ? [targetSlug] : available

if (slugs.length === 0) {
  console.error('No PNG files found in', IN_DIR)
  process.exit(1)
}

console.log(`\nProcessing ${slugs.length} image(s)...\n`)

async function processAndUpload(slug) {
  const inPath = join(IN_DIR, `${slug}.png`)

  if (!existsSync(inPath)) {
    throw new Error(`Source file not found: ${inPath}`)
  }

  // Resize to 900×1200 JPEG
  const jpegBuffer = await sharp(inPath)
    .resize(TARGET_W, TARGET_H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toBuffer()

  const storagePath = `covers/${slug}.jpg`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  // Get public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  // Update division_catalog
  const { error: dbError } = await supabase
    .from('division_catalog')
    .update({ cover_image_url: publicUrl })
    .eq('slug', slug)

  if (dbError) throw new Error(`DB update failed: ${dbError.message}`)

  return { publicUrl, sizeKb: Math.round(jpegBuffer.length / 1024) }
}

// ── Main ──────────────────────────────────────────────────────────────────────

let succeeded = 0
let failed    = 0
const failures = []

for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i]
  process.stdout.write(`[${i + 1}/${slugs.length}] ${slug} ... `)

  try {
    const { sizeKb } = await processAndUpload(slug)
    console.log(`✓  ${sizeKb} KB`)
    succeeded++
  } catch (err) {
    console.log(`✗  ${err.message}`)
    failures.push({ slug, error: err.message })
    failed++
  }
}

console.log(`\n── Summary ─────────────────────────────────────`)
console.log(`  Succeeded: ${succeeded}`)
console.log(`  Failed:    ${failed}`)
if (failures.length) {
  console.log(`\n  Failed slugs:`)
  failures.forEach(f => console.log(`    ${f.slug}: ${f.error}`))
}
console.log(`\nAll cover_image_url values updated in division_catalog.`)
