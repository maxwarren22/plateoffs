-- ============================================================
-- Add curation_pending flag + fix lobby display order
-- Safe to re-run: uses IF NOT EXISTS / idempotent UPDATEs
-- ============================================================

-- ── plateoffs_divisions: curation queue flag ─────────────────
-- Set by rotate-divisions when a division needs recipe generation.
-- Cleared by curate-division-recipes on successful completion.
-- curate-scheduler polls this flag every 5 minutes.
ALTER TABLE plateoffs_divisions
  ADD COLUMN IF NOT EXISTS curation_pending boolean NOT NULL DEFAULT false;

-- ── division_catalog: fix anchor display_order ───────────────
-- Lobby order per spec: R1=1, A1=2, R2=3, A2=4, R3=5, A3=6, R4=7, A4=8
UPDATE division_catalog SET display_order = 2 WHERE slug = 'protein-throne';
UPDATE division_catalog SET display_order = 4 WHERE slug = 'plant-power';
UPDATE division_catalog SET display_order = 6 WHERE slug = '30-minute-wars';
UPDATE division_catalog SET display_order = 8 WHERE slug = 'comfort-classics';

-- ── plateoffs_divisions: sync anchor display_order ───────────
UPDATE plateoffs_divisions pd
SET display_order = dc.display_order
FROM division_catalog dc
WHERE pd.catalog_id = dc.id
  AND pd.division_type = 'anchor';

-- ── cron setup reminder ──────────────────────────────────────
-- Add a second cron job in the Supabase Dashboard:
--   Name:     curate-scheduler-5min
--   Schedule: */5 * * * *
--   Function: curate-scheduler
