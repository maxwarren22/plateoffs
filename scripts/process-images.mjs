/**
 * process-images.mjs
 *
 * 1. Compresses 7 division cover images → JPEG 800px wide, ~80-100 KB each
 * 2. Copies icon (1024x1024) + splash to assets/
 * 3. Uploads compressed division images to Supabase "division-cover-images" bucket
 * 4. Prints SQL UPDATE statements to wire up cover_image_url per division slug
 *
 * Run: node scripts/process-images.mjs
 */

import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://ppdgdwfiwgwifzykkngr.supabase.co';
// Use service role key for storage uploads — paste yours here or set env var SUPABASE_SERVICE_KEY
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
// Bucket ID as shown in Supabase Storage — try both common slugs
const BUCKET = process.env.SUPABASE_BUCKET || 'division-cover-image';
const SOURCE_DIR = '/Users/maxwarren/Downloads/iloveimg-resized';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, '../assets');
const OUT_DIR = join(__dirname, 'output');
// ────────────────────────────────────────────────────────────────────────────

// Identified by dimension/naming — update mapping if images are assigned differently
// 928x1152 images = division covers (7 total)
// 1024x1024 = icon
// 704x1520  = splash

const ICON_FILE = { file: 'Gemini_Generated_Image_pwo9i2pwo9i2pwo9.png' };   // 1024x1024 crossed-forks logo
const SPLASH_FILE = { file: 'Gemini_Generated_Image_as2qjwas2qjwas2q.png' };  // 704x1520 sunburst splash

// Division covers matched to actual DB slugs by visual content
const DIVISION_FILES = [
  { file: 'Gemini_Generated_Image_noxvj8noxvj8noxv.png', slug: 'italian-night' },    // red pasta explosion
  { file: 'Gemini_Generated_Image_wo3lsawo3lsawo3l.png', slug: 'fire-and-spice' },   // exploding hot peppers
  { file: 'Gemini_Generated_Image_d9cgkqd9cgkqd9cg.png', slug: 'weekend-brunch' },   // neon street taco
  { file: 'Gemini_Generated_Image_hqa6ulhqa6ulhqa6.png', slug: 'chocolate-wars' },   // chocolate cake pink/lime drip
  { file: 'Gemini_Generated_Image_low9xolow9xolow9.png', slug: 'power-bowls' },      // cyberpunk neon bowl
];

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

async function processIcon() {
  if (!ICON_FILE) { console.warn('⚠ No 1024x1024 icon found'); return; }
  const src = join(SOURCE_DIR, ICON_FILE.file);

  // icon.png: 1024x1024 PNG (Expo requirement)
  await sharp(src).resize(1024, 1024, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(join(ASSETS_DIR, 'icon.png'));
  console.log('✓ assets/icon.png');

  // adaptive-icon.png: Android foreground, 1024x1024
  await sharp(src).resize(1024, 1024, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('✓ assets/adaptive-icon.png');

  // favicon.png: 64x64
  await sharp(src).resize(64, 64, { fit: 'cover' }).png({ compressionLevel: 9 }).toFile(join(ASSETS_DIR, 'favicon.png'));
  console.log('✓ assets/favicon.png');
}

async function processSplash() {
  if (!SPLASH_FILE) { console.warn('⚠ No splash image found'); return; }
  const src = join(SOURCE_DIR, SPLASH_FILE.file);

  // splash-icon.png: Expo uses resizeMode: contain, so keep aspect ratio, max 1242px wide
  await sharp(src)
    .resize(1242, null, { fit: 'inside', withoutEnlargement: false })
    .png({ compressionLevel: 9 })
    .toFile(join(ASSETS_DIR, 'splash-icon.png'));
  console.log('✓ assets/splash-icon.png');
}

async function compressDivisionImages() {
  const results = [];
  for (let i = 0; i < DIVISION_FILES.length; i++) {
    const { file, slug } = DIVISION_FILES[i];
    const src = join(SOURCE_DIR, file);
    const outName = `${slug}.jpg`;
    const outPath = join(OUT_DIR, outName);

    await sharp(src)
      .resize(800, null, { fit: 'inside', withoutEnlargement: false })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(outPath);

    const stat = readFileSync(outPath);
    const kb = Math.round(stat.length / 1024);
    console.log(`✓ ${outName}  (${kb} KB)`);
    results.push({ slug: DIVISION_FILES[i].slug, outPath, outName });
  }
  return results;
}

async function uploadToSupabase(compressed) {
  if (!SUPABASE_KEY) {
    console.error('\n✗ No Supabase key set. Export SUPABASE_SERVICE_KEY and re-run upload step.');
    return [];
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const urls = [];

  for (const { slug, outPath, outName } of compressed) {
    const fileBuffer = readFileSync(outPath);
    const storagePath = `covers/${outName}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error(`✗ Upload failed for ${outName}: ${error.message}`);
      urls.push({ slug, url: null });
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    console.log(`✓ Uploaded ${outName} → ${data.publicUrl}`);
    urls.push({ slug, url: data.publicUrl });
  }
  return urls;
}

function printSQL(urlMap) {
  console.log('\n── SQL to run in Supabase SQL Editor ──────────────────────────────');
  console.log('-- Step 1: Add column (skip if already added)');
  console.log('ALTER TABLE plateoffs_divisions ADD COLUMN IF NOT EXISTS cover_image_url text;\n');
  console.log('-- Step 2: Set cover images');
  for (const { slug, url } of urlMap) {
    if (url) {
      console.log(`UPDATE plateoffs_divisions SET cover_image_url = '${url}' WHERE slug = '${slug}';`);
    } else {
      console.log(`-- SKIPPED ${slug} (upload failed)`);
    }
  }
  console.log('───────────────────────────────────────────────────────────────────\n');
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('Processing images...\n');
await processIcon();
await processSplash();
console.log('');
const compressed = await compressDivisionImages();
console.log('\nUploading to Supabase...');
const urlMap = await uploadToSupabase(compressed);
printSQL(urlMap);
console.log('Done.');
