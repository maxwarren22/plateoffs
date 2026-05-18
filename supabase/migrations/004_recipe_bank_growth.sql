-- ============================================================
-- Phase 5: Division recipe bank + rotation tracking
-- Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT
-- ============================================================

-- ── division_catalog additions ────────────────────────────────

-- Tracks the current position in the bank rotation sequence.
-- rotate-divisions advances this by ANCHOR_WINDOW_SIZE each epoch.
ALTER TABLE division_catalog ADD COLUMN IF NOT EXISTS rotation_index  integer      DEFAULT 0;

-- Tracks when the bank was last grown by curate-division-recipes.
ALTER TABLE division_catalog ADD COLUMN IF NOT EXISTS last_curated_at timestamptz;

-- ── division_recipe_bank ──────────────────────────────────────
-- One row per recipe per division. sort_order defines the rotation
-- sequence. rotate-divisions slices this table using rotation_index
-- to produce the active window in plateoffs_divisions.recipe_ids.
-- Once a division has MAX_BANK_SIZE rows, curation stops permanently.

CREATE TABLE IF NOT EXISTS division_recipe_bank (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid        NOT NULL REFERENCES division_catalog(id) ON DELETE CASCADE,
  recipe_id  uuid        NOT NULL REFERENCES recipes(id),
  sort_order integer     NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_id, recipe_id)
);

-- Fast lookup for rotation window queries and bank-size checks
CREATE INDEX IF NOT EXISTS idx_drb_catalog_sort
  ON division_recipe_bank (catalog_id, sort_order);

-- RLS: public read (app needs to read bank entries), service role write
ALTER TABLE division_recipe_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON division_recipe_bank FOR SELECT USING (true);

-- ── recipes: columns written by curate-division-recipes ───────
-- Added IF NOT EXISTS so this is safe against existing columns.

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS dietary_tags   text[]  DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS meal_type_tags text[]  DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ingredients    text[]  DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instructions   text[]  DEFAULT '{}';
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS image_path     text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_public      boolean DEFAULT true;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_time      integer;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS skill_level    text;

-- Fast lookup for backfill-recipe-images
CREATE INDEX IF NOT EXISTS idx_recipes_ai_no_image
  ON recipes (source, image_path)
  WHERE source = 'ai' AND image_path IS NULL;

-- Fast lookup for the ilike name search in curate-division-recipes
CREATE INDEX IF NOT EXISTS idx_recipes_name_lower
  ON recipes (lower(name));
