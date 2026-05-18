import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY       = Deno.env.get('GEMINI_API_KEY')!
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta'
const IMAGE_MODEL  = 'gemini-2.5-flash'
const IMAGE_BUCKET = 'recipe-images'

// Process this many images in parallel per batch; keep small to stay within timeout
const BATCH_SIZE    = 3
const DEFAULT_LIMIT = 20

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Gemini: image generation ──────────────────────────────────────────────────

async function geminiImage(prompt: string): Promise<Uint8Array | null> {
  const res = await fetch(
    `${GEMINI_BASE}/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 1,
        },
      }),
    }
  )
  if (!res.ok) {
    console.error(`Image generation failed ${res.status}: ${await res.text()}`)
    return null
  }
  const json = await res.json()
  const parts = json.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((p: { inlineData?: { mimeType?: string } }) =>
    p.inlineData?.mimeType?.startsWith('image/')
  )
  if (!imagePart) return null
  return Uint8Array.from(atob(imagePart.inlineData.data), c => c.charCodeAt(0))
}

function buildImagePrompt(recipeName: string): string {
  const surfaces = ['marble', 'dark wood', 'rustic concrete', 'slate', 'linen']
  const surface = surfaces[Math.floor(Math.random() * surfaces.length)]
  return `Professional food photography of ${recipeName}. Top-down shot on a ${surface} surface. Natural window light. Garnished and plated for a high-end restaurant menu. Photorealistic, high resolution, appetizing, vibrant colors.`
}

// ── Storage ───────────────────────────────────────────────────────────────────

async function uploadImage(
  supabase: any,
  recipeId: string,
  imageBytes: Uint8Array
): Promise<string | null> {
  const path = `ai-generated/${recipeId}.png`
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, imageBytes, { contentType: 'image/png', upsert: true })
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
    const limit: number = body.limit ?? DEFAULT_LIMIT

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // When explicit IDs are provided, process all of them (no limit truncation).
    // When scanning globally, cap at `limit` to stay within timeout.
    let query = supabase
      .from('recipes')
      .select('id, name')
      .eq('source', 'ai')
      .is('image_path', null)

    if (recipeIds?.length) {
      query = query.in('id', recipeIds)
    } else {
      query = query.limit(limit)
    }

    const { data: targets, error } = await query
    if (error) throw error

    if (!targets?.length) {
      return new Response(
        JSON.stringify({ success: true, total: 0, succeeded: 0, failed: 0 }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Backfilling images for ${targets.length} recipes`)
    let succeeded = 0
    let failed = 0

    // Process in small parallel batches to balance speed vs. timeout risk
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE)
      await Promise.allSettled(
        batch.map(async (recipe: { id: string; name: string }) => {
          const imageBytes = await geminiImage(buildImagePrompt(recipe.name))
          if (!imageBytes) { failed++; return }

          const path = await uploadImage(supabase, recipe.id, imageBytes)
          if (path) {
            await supabase.from('recipes').update({ image_path: path }).eq('id', recipe.id)
            succeeded++
            console.log(`Image saved for: ${recipe.name}`)
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
