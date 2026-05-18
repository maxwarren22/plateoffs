-- ============================================================
-- Phase 5b: Seed division_recipe_bank from existing data
--
-- The old curate-division-recipes stored recipe UUIDs in
-- division_catalog.recipe_ids. This migration moves that data
-- into the new division_recipe_bank table, preserving the
-- existing order as the initial sort_order sequence.
--
-- Safe to re-run: ON CONFLICT DO NOTHING skips duplicates.
-- Divisions with empty/null recipe_ids are skipped — run
-- curate-division-recipes manually for those slugs afterward.
-- ============================================================

INSERT INTO division_recipe_bank (catalog_id, recipe_id, sort_order)
SELECT
  dc.id                      AS catalog_id,
  r.recipe_id                AS recipe_id,
  (r.ordinality - 1)::integer AS sort_order
FROM division_catalog dc
CROSS JOIN LATERAL unnest(dc.recipe_ids) WITH ORDINALITY AS r(recipe_id, ordinality)
WHERE dc.recipe_ids IS NOT NULL
  AND array_length(dc.recipe_ids, 1) > 0
ON CONFLICT (catalog_id, recipe_id) DO NOTHING;

-- Show what was seeded so you can verify in the Supabase SQL editor
SELECT
  dc.slug,
  dc.name,
  count(drb.id) AS bank_size
FROM division_catalog dc
LEFT JOIN division_recipe_bank drb ON drb.catalog_id = dc.id
GROUP BY dc.slug, dc.name
ORDER BY bank_size DESC, dc.slug;
