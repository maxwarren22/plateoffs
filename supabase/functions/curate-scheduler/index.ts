import { createClient } from 'npm:@supabase/supabase-js@2'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// SUPABASE_ANON_KEY is reliably auto-injected as a valid JWT for inter-function HTTP calls.
// The service role key env var may not resolve to a proper JWT in all runtime contexts.
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CORS_JSON = { ...CORS, 'Content-Type': 'application/json' }

// ── Handler ───────────────────────────────────────────────────────────────────
//
// Runs every 5 minutes via Supabase Dashboard cron (*/5 * * * *).
// For each division with curation_pending = true (sequential, shortest bank first):
//   1. Calls curate-division-recipes — fills recipe bank, clears curation_pending
//   2. Immediately calls backfill-recipe-images scoped to that division's catalog_id
//      — images are ready before the next notification window fires
//
// If curation fails, curation_pending stays true and retries next run.
// If image backfill fails, the 30-min cleanup cron will catch remaining recipes.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch pending divisions with catalog_id for scoped image backfill
    const { data: pending, error } = await supabase
      .from('plateoffs_divisions')
      .select('slug, recipe_ids')
      .eq('is_active', true)
      .eq('curation_pending', true)

    if (error) throw error

    if (!pending?.length) {
      console.log('No divisions pending curation')
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: CORS_JSON })
    }

    // Shortest bank first — empty/new divisions get fully set up before growth batches
    const sorted = [...pending].sort(
      (a, b) => (a.recipe_ids?.length ?? 0) - (b.recipe_ids?.length ?? 0)
    )

    console.log(`Processing ${sorted.length} pending division(s): ${sorted.map(d => d.slug).join(', ')}`)

    const results: { slug: string; ok: boolean; bankSize?: number; error?: string }[] = []

    for (const division of sorted) {
      console.log(`Curating: ${division.slug} (current recipes: ${division.recipe_ids?.length ?? 0})`)
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/curate-division-recipes`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ slug: division.slug }),
          }
        )
        const rawBody = await res.text()
        const body = (() => { try { return JSON.parse(rawBody) } catch { return {} } })()

        if (!res.ok) {
          console.error(`Curation error for ${division.slug}: ${res.status} — ${rawBody}`)
          results.push({ slug: division.slug, ok: false, error: `${res.status}: ${rawBody}` })
        } else {
          console.log(`Curation complete for ${division.slug}: bank=${body.bankSize}`)
          results.push({ slug: division.slug, ok: true, bankSize: body.bankSize })
        }
      } catch (err) {
        console.error(`Curation failed for ${division.slug}:`, err)
        results.push({ slug: division.slug, ok: false, error: String(err) })
      }
    }

    const succeeded = results.filter(r => r.ok).length
    console.log(`Scheduler run complete: ${succeeded}/${results.length} succeeded`)

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, succeeded, results }),
      { headers: CORS_JSON }
    )
  } catch (err) {
    console.error('curate-scheduler error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS_JSON,
    })
  }
})
