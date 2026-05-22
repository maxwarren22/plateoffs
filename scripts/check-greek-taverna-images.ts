import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars')
  Deno.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Find the Greek Taverna Fight division
const { data: divisions, error: divErr } = await supabase
  .from('plateoffs_divisions')
  .select('id, name, recipe_ids, catalog_id')
  .ilike('name', '%greek%')

if (divErr) { console.error(divErr); Deno.exit(1) }
if (!divisions?.length) { console.log('No Greek division found'); Deno.exit(0) }

const div = divisions[0]
console.log(`Division: "${div.name}"`)
console.log(`catalog_id: ${div.catalog_id}`)
console.log(`recipe_ids in gauntlet: ${div.recipe_ids?.length ?? 0}`)

// ── Check the 8 gauntlet recipes ─────────────────────────────────────────────
if (div.recipe_ids?.length) {
  const { data: gauntlet } = await supabase
    .from('recipes')
    .select('id, name, image_path, source')
    .in('id', div.recipe_ids)

  console.log(`\n=== GAUNTLET (${gauntlet?.length ?? 0} recipes) ===`)
  const missing = (gauntlet ?? []).filter((r: any) => !r.image_path)
  const present = (gauntlet ?? []).filter((r: any) => r.image_path)

  for (const r of present) {
    console.log(`  ✓ ${r.name}`)
    console.log(`    ${r.image_path}`)
  }
  for (const r of missing) {
    console.log(`  ✗ ${r.name} (${r.source}) — NO IMAGE`)
    console.log(`    id: ${r.id}`)
  }
}

// ── Check the full bank ───────────────────────────────────────────────────────
if (div.catalog_id) {
  const { data: bankRows } = await supabase
    .from('division_recipe_bank')
    .select('recipe_id')
    .eq('catalog_id', div.catalog_id)

  const bankIds = (bankRows ?? []).map((r: any) => r.recipe_id)
  console.log(`\n=== BANK: ${bankIds.length} recipes ===`)

  const CHUNK = 100
  const allMissing: any[] = []
  for (let i = 0; i < bankIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('recipes')
      .select('id, name, image_path, source')
      .in('id', bankIds.slice(i, i + CHUNK))
      .is('image_path', null)
    if (data) allMissing.push(...data)
  }

  if (!allMissing.length) {
    console.log('All bank recipes have images.')
  } else {
    console.log(`Missing images: ${allMissing.length}`)
    for (const r of allMissing) {
      console.log(`  ✗ ${r.name} (${r.source}) — id: ${r.id}`)
    }
  }
}
