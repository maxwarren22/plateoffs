// Recompresses recipe images that were uploaded as raw PNG (by
// backfill-recipe-images, which can't run sharp in the Supabase edge
// runtime) into webp, then updates image_path. Runs on a normal Node
// runner where sharp works fine.
//
// Run:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/compress-recipe-images.mjs [limit]

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const IMAGE_BUCKET = 'recipe-images'
const WEBP_QUALITY = 85
const MAX_DIMENSION = 1024
const LIMIT = Number(process.argv[2] ?? 100)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

function nameToSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// LIKE '%.png' can't use an index and times out on the full table, so
// filter on the indexed (source, image_path not null) pair first, then
// narrow to .png client-side. PostgREST caps each request at 1000 rows,
// so page through with .range() until we have enough PNGs or run out.
const PAGE_SIZE = 1000
let pngCandidates = []
for (let page = 0; pngCandidates.length < LIMIT; page++) {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, image_path')
    .eq('source', 'ai')
    .not('image_path', 'is', null)
    .range(from, to)

  if (error) {
    console.error('Recipes fetch error:', error.message)
    process.exit(1)
  }

  pngCandidates.push(...data.filter(r => r.image_path.endsWith('.png')))

  if (data.length < PAGE_SIZE) break // last page
}

const recipes = pngCandidates.slice(0, LIMIT)

if (!recipes.length) {
  console.log('No PNG recipe images to compress.')
  process.exit(0)
}

console.log(`Compressing ${recipes.length} recipe image(s)...\n`)

let succeeded = 0
let failed = 0

for (const recipe of recipes) {
  try {
    const { data: blob, error: dlError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .download(recipe.image_path)
    if (dlError || !blob) throw new Error(dlError?.message ?? 'download failed')

    const pngBytes = Buffer.from(await blob.arrayBuffer())
    const webpBytes = await sharp(pngBytes)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer()

    const newPath = `permanent/${nameToSlug(recipe.name)}-${Date.now()}.webp`
    const { error: upError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(newPath, webpBytes, { contentType: 'image/webp', upsert: true })
    if (upError) throw new Error(upError.message)

    const { error: updError } = await supabase
      .from('recipes')
      .update({ image_path: newPath })
      .eq('id', recipe.id)
    if (updError) throw new Error(updError.message)

    await supabase.storage.from(IMAGE_BUCKET).remove([recipe.image_path])

    console.log(`  ✓ ${recipe.name}: ${pngBytes.length} → ${webpBytes.length} bytes (${recipe.image_path} → ${newPath})`)
    succeeded++
  } catch (err) {
    console.error(`  ✗ ${recipe.name} (${recipe.image_path}): ${err.message ?? err}`)
    failed++
  }
}

console.log(`\nDone. ${succeeded} compressed, ${failed} failed.`)
