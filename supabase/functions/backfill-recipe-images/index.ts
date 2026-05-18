import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenAI } from 'npm:@google/genai@1.11.0'
import { Jimp } from 'npm:jimp@1.6.0'

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const IMAGE_MODEL  = 'gemini-2.5-flash-image'
const IMAGE_BUCKET = 'recipe-images'

// Store under permanent/ so CMP's getRecipeImageUrl handles the path correctly
// (it only adds the permanent/ prefix for paths that don't already have it).
const IMAGE_PREFIX = 'permanent/ai-generated'

// Compress to webp — far smaller than raw Gemini PNG (2MB+ → ~100KB)
const WEBP_QUALITY = 85
const MAX_DIMENSION = 1024

const BATCH_SIZE    = 5
const DEFAULT_LIMIT = 20

const BACKGROUNDS = [
  'rustic wooden table with fresh herbs scattered around, top-down view',
  'white marble surface with linen napkin and silver fork, top-down view',
  'dark slate surface with colorful fresh ingredients around the dish, top-down view',
  'light wood cutting board with knife and ingredients at edges, top-down view',
  'terracotta tiles with olive oil bottle and fresh vegetables nearby, 45-degree angle',
  'black cast iron pan on worn oak table, moody side-lit, 45-degree angle',
  'bright white ceramic plate on bright linen tablecloth, natural window light, side angle',
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Gemini: image generation ──────────────────────────────────────────────────

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

function buildImagePrompt(recipeName: string): string {
  const bg = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]
  return `Professional food photography of ${recipeName}. ${bg}. Natural light. Garnished and plated for a high-end restaurant menu. Photorealistic, high resolution, appetizing, vibrant colors.`
}

async function geminiImage(prompt: string): Promise<Uint8Array | null> {
  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1' },
      },
    })
    const part = response.candidates?.[0]?.content?.parts?.[0]
    if (!part?.inlineData?.data) {
      console.error('No image data in Gemini response')
      return null
    }
    return Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0))
  } catch (err) {
    console.error('Gemini image generation failed:', err)
    return null
  }
}

// ── Image compression ─────────────────────────────────────────────────────────

async function compressImage(pngBytes: Uint8Array): Promise<Uint8Array> {
  try {
    const image = await Jimp.read(Buffer.from(pngBytes))

    // Resize to max MAX_DIMENSION on longest side, maintaining aspect ratio
    const { width, height } = image.bitmap
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      if (width >= height) {
        image.resize({ w: MAX_DIMENSION })
      } else {
        image.resize({ h: MAX_DIMENSION })
      }
    }

    const buffer = await image.getBuffer('image/webp', { quality: WEBP_QUALITY })
    const compressed = new Uint8Array(buffer)
    console.log(`Compressed: ${pngBytes.length} bytes PNG → ${compressed.length} bytes webp`)
    return compressed
  } catch (err) {
    console.error('Image compression failed, using original:', err)
    return pngBytes
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function uploadImage(
  supabase: ReturnType<typeof createClient>,
  recipeId: string,
  imageBytes: Uint8Array
): Promise<string | null> {
  const path = `${IMAGE_PREFIX}/${recipeId}.webp`
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, imageBytes, { contentType: 'image/webp', upsert: true })
  if (error) {
    console.error(`Image upload failed for ${recipeId}:`, error.message)
    return null
  }
  return path
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const recipeIds: string[] | undefined = body.recipe_ids
    const catalogId: string | undefined   = body.catalog_id
    const limit: number = body.limit ?? DEFAULT_LIMIT

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let targetIds: string[]

    if (recipeIds?.length) {
      targetIds = recipeIds
    } else if (catalogId) {
      const { data: bankRows, error: bankError } = await supabase
        .from('division_recipe_bank')
        .select('recipe_id')
        .eq('catalog_id', catalogId)
        .order('added_at', { ascending: false })
        .limit(limit)
      if (bankError) throw new Error(`division_recipe_bank query failed: ${bankError.message}`)
      targetIds = (bankRows ?? []).map((r: { recipe_id: string }) => r.recipe_id)
    } else {
      const { data: bankRows, error: bankError } = await supabase
        .from('division_recipe_bank')
        .select('recipe_id')
        .order('added_at', { ascending: false })
        .limit(limit * 5)
      if (bankError) throw new Error(`division_recipe_bank query failed: ${bankError.message}`)
      targetIds = (bankRows ?? []).map((r: { recipe_id: string }) => r.recipe_id)
    }

    if (!targetIds.length) {
      return new Response(
        JSON.stringify({ success: true, total: 0, succeeded: 0, failed: 0 }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const { data: targets, error: recipesError } = await supabase
      .from('recipes')
      .select('id, name')
      .eq('source', 'ai')
      .is('image_path', null)
      .in('id', targetIds)
      .limit(limit)
    if (recipesError) throw new Error(`recipes query failed: ${recipesError.message}`)

    if (!targets?.length) {
      return new Response(
        JSON.stringify({ success: true, total: 0, succeeded: 0, failed: 0 }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Backfilling images for ${targets.length} recipes`)
    let succeeded = 0
    let failed = 0

    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(
        batch.map(async (recipe: { id: string; name: string }) => {
          const rawBytes = await geminiImage(buildImagePrompt(recipe.name))
          if (!rawBytes) { failed++; return }

          const imageBytes = await compressImage(rawBytes)
          const path = await uploadImage(supabase, recipe.id, imageBytes)
          if (path) {
            await supabase.from('recipes').update({ image_path: path }).eq('id', recipe.id)
            succeeded++
            console.log(`Image saved: ${recipe.name} → ${path}`)
          } else {
            failed++
          }
        })
      )
    }

    return new Response(
      JSON.stringify({ success: true, total: targets.length, succeeded, failed }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Image backfill error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
