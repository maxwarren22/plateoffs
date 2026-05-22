/**
 * One-time migration: recompress + repath images stored at permanent/ai-generated/{uuid}.webp
 *
 * These were uploaded as raw PNGs (compression failed due to missing Buffer in Deno)
 * and saved with the wrong path convention. This script:
 *   1. Finds all ai-generated recipes with the old path
 *   2. Downloads the existing file from storage (no regeneration)
 *   3. Recompresses to WebP with sharp
 *   4. Uploads to permanent/{slug}-{timestamp}.webp
 *   5. Updates image_path in the recipes table
 *   6. Removes the old storage object
 *
 * Run with:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   deno run --allow-net --allow-env scripts/migrate-recipe-images.ts
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import sharp from 'npm:sharp'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars')
  Deno.exit(1)
}

const IMAGE_BUCKET  = 'recipe-images'
const WEBP_QUALITY  = 85
const MAX_DIMENSION = 1024
const BATCH_SIZE    = 5

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function compressImage(bytes: Uint8Array): Promise<Uint8Array> {
  const buffer = await sharp(bytes)
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()
  return new Uint8Array(buffer)
}

async function migrateRecipe(recipe: { id: string; name: string; image_path: string }) {
  const oldPath = recipe.image_path

  const { data: fileData, error: dlErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .download(oldPath)
  if (dlErr || !fileData) {
    console.error(`  ✗ Download failed (${oldPath}):`, dlErr?.message)
    return false
  }

  const raw = new Uint8Array(await fileData.arrayBuffer())
  console.log(`  Downloaded ${(raw.length / 1024).toFixed(0)}KB`)

  let compressed: Uint8Array
  try {
    compressed = await compressImage(raw)
    console.log(`  Compressed → ${(compressed.length / 1024).toFixed(0)}KB WebP`)
  } catch (err) {
    console.error(`  ✗ Compression failed:`, err)
    return false
  }

  const newPath = `permanent/${nameToSlug(recipe.name)}-${Date.now()}.webp`

  const { error: upErr } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(newPath, compressed, { contentType: 'image/webp', upsert: false })
  if (upErr) {
    console.error(`  ✗ Upload failed (${newPath}):`, upErr.message)
    return false
  }

  const { error: dbErr } = await supabase
    .from('recipes')
    .update({ image_path: newPath })
    .eq('id', recipe.id)
  if (dbErr) {
    console.error(`  ✗ DB update failed:`, dbErr.message)
    // Roll back the upload so storage and DB stay in sync
    await supabase.storage.from(IMAGE_BUCKET).remove([newPath])
    return false
  }

  const { error: rmErr } = await supabase.storage.from(IMAGE_BUCKET).remove([oldPath])
  if (rmErr) console.warn(`  ⚠ Could not remove old file (${oldPath}):`, rmErr.message)

  console.log(`  ✓ ${oldPath}\n    → ${newPath}`)
  return true
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Scope to recipes in the bank — avoids touching the 45k+ CMP recipes
const { data: bankRows, error: bankErr } = await supabase
  .from('division_recipe_bank')
  .select('recipe_id')

if (bankErr) {
  console.error('Bank query failed:', bankErr.message)
  Deno.exit(1)
}

const bankIds = (bankRows ?? []).map((r: { recipe_id: string }) => r.recipe_id)

if (!bankIds.length) {
  console.log('No recipes in division_recipe_bank — nothing to migrate.')
  Deno.exit(0)
}

// Fetch in chunks of 100 to stay within URL length limits
const CHUNK = 100
const targets: { id: string; name: string; image_path: string }[] = []

for (let i = 0; i < bankIds.length; i += CHUNK) {
  const chunk = bankIds.slice(i, i + CHUNK)
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, image_path')
    .eq('source', 'ai')
    .like('image_path', 'permanent/ai-generated/%')
    .in('id', chunk)
  if (error) {
    console.error('Recipes query failed:', error.message)
    Deno.exit(1)
  }
  if (data) targets.push(...data)
}

if (!targets?.length) {
  console.log('No recipes with old image paths — nothing to migrate.')
  Deno.exit(0)
}

console.log(`Found ${targets.length} recipe(s) to migrate.\n`)

let succeeded = 0
let failed = 0

for (let i = 0; i < targets.length; i += BATCH_SIZE) {
  const batch = targets.slice(i, i + BATCH_SIZE)
  const results = await Promise.allSettled(
    batch.map(async (r) => {
      console.log(`[${i + batch.indexOf(r) + 1}/${targets.length}] ${r.name}`)
      return migrateRecipe(r)
    })
  )
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) succeeded++
    else failed++
  }
}

console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`)
