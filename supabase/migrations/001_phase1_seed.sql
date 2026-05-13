-- ============================================================
-- Phase 1: Seed division_catalog + app_config + anchor divisions
-- Safe to re-run: uses ON CONFLICT DO NOTHING / IF NOT EXISTS
-- ============================================================

-- Add source column to recipes if not already there
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- ── app_config seed ─────────────────────────────────────────
INSERT INTO app_config (key, value) VALUES
  ('epoch_zero',            '2025-06-01T00:00:00Z'),
  ('r1_epoch',              '0'),
  ('r2_epoch',              '0'),
  ('r3_epoch',              '0'),
  ('r4_epoch',              '0'),
  ('next_r1_rotation_at',   '2025-06-04T00:00:00Z'),
  ('next_r2_rotation_at',   '2025-06-08T00:00:00Z'),
  ('next_r3_rotation_at',   '2025-06-06T00:00:00Z'),
  ('next_r4_rotation_at',   '2025-06-05T00:00:00Z')
ON CONFLICT (key) DO NOTHING;

-- ── division_catalog: Anchor divisions ───────────────────────
INSERT INTO division_catalog (slug, name, description, category, slot, display_order) VALUES
  ('protein-throne',   'Protein Throne',   'The highest-protein showdown — any source',               'anchor', 'A1', 1),
  ('plant-power',      'Plant Power',      '100% plant-based, zero compromise on flavor',             'anchor', 'A2', 2),
  ('30-minute-wars',   '30-Minute Wars',   'Fast weeknight cooking — any cuisine, any diet',          'anchor', 'A3', 3),
  ('comfort-classics', 'Comfort Classics', 'Hearty soul food from every culture',                     'anchor', 'A4', 4)
ON CONFLICT (slug) DO NOTHING;

-- ── division_catalog: Cuisine pool (Slot R1, 3-day cycle) ───
INSERT INTO division_catalog (slug, name, category, slot, display_order) VALUES
  ('italian-masters',       'Italian Masters',       'cuisine', 'R1', 10),
  ('japanese-showdown',     'Japanese Showdown',     'cuisine', 'R1', 11),
  ('mexican-street-fight',  'Mexican Street Fight',  'cuisine', 'R1', 12),
  ('thai-throwdown',        'Thai Throwdown',        'cuisine', 'R1', 13),
  ('indian-spice-wars',     'Indian Spice Wars',     'cuisine', 'R1', 14),
  ('mediterranean-clash',   'Mediterranean Clash',   'cuisine', 'R1', 15),
  ('french-bistro-battle',  'French Bistro Battle',  'cuisine', 'R1', 16),
  ('korean-fire',           'Korean Fire',           'cuisine', 'R1', 17),
  ('chinese-takeout-wars',  'Chinese Takeout Wars',  'cuisine', 'R1', 18),
  ('vietnamese-bowl-off',   'Vietnamese Bowl-Off',   'cuisine', 'R1', 19),
  ('greek-taverna-fight',   'Greek Taverna Fight',   'cuisine', 'R1', 20),
  ('spanish-tapas-brawl',   'Spanish Tapas Brawl',   'cuisine', 'R1', 21),
  ('middle-east-mashup',    'Middle East Mashup',    'cuisine', 'R1', 22),
  ('peruvian-showdown',     'Peruvian Showdown',     'cuisine', 'R1', 23),
  ('ethiopian-feast',       'Ethiopian Feast',       'cuisine', 'R1', 24),
  ('american-bbq-bracket',  'American BBQ Bracket',  'cuisine', 'R1', 25),
  ('dim-sum-derby',         'Dim Sum Derby',         'cuisine', 'R1', 26),
  ('caribbean-clash',       'Caribbean Clash',       'cuisine', 'R1', 27)
ON CONFLICT (slug) DO NOTHING;

-- ── division_catalog: Seasonal pool (Slot R2, 7-day cycle) ──
INSERT INTO division_catalog (slug, name, category, slot, active_months, display_order) VALUES
  ('summer-grill-masters',  'Summer Grill Masters',  'seasonal', 'R2', ARRAY[6,7,8],       30),
  ('summer-salad-slam',     'Summer Salad Slam',     'seasonal', 'R2', ARRAY[6,7,8],       31),
  ('fall-harvest-bowl',     'Fall Harvest Bowl',     'seasonal', 'R2', ARRAY[9,10,11],     32),
  ('fall-soup-wars',        'Fall Soup Wars',        'seasonal', 'R2', ARRAY[9,10,11],     33),
  ('winter-warmers',        'Winter Warmers',        'seasonal', 'R2', ARRAY[12,1,2],      34),
  ('holiday-feast-bracket', 'Holiday Feast Bracket', 'seasonal', 'R2', ARRAY[12,1],        35),
  ('spring-garden-fresh',   'Spring Garden Fresh',   'seasonal', 'R2', ARRAY[3,4,5],       36),
  ('spring-brunch-battle',  'Spring Brunch Battle',  'seasonal', 'R2', ARRAY[3,4,5],       37),
  ('game-day-grub',         'Game Day Grub',         'seasonal', 'R2', ARRAY[1,2,9,10],    38),
  ('valentines-dinner',     'Valentine''s Dinner',   'seasonal', 'R2', ARRAY[2],           39),
  ('thanksgiving-sides',    'Thanksgiving Sides',    'seasonal', 'R2', ARRAY[11],          40),
  ('summer-dessert-duel',   'Summer Dessert Duel',   'seasonal', 'R2', ARRAY[6,7,8],       41),
  ('cold-weather-stews',    'Cold-Weather Stews',    'seasonal', 'R2', ARRAY[11,12,1,2],   42),
  ('spring-detox-bracket',  'Spring Detox Bracket',  'seasonal', 'R2', ARRAY[3,4],         43),
  ('tailgate-titans',       'Tailgate Titans',       'seasonal', 'R2', ARRAY[9,10],        44),
  ('new-year-fresh-start',  'New Year Fresh Start',  'seasonal', 'R2', ARRAY[1],           45)
ON CONFLICT (slug) DO NOTHING;

-- ── division_catalog: Wild Card pool (Slot R3, 5-day cycle) ─
INSERT INTO division_catalog (slug, name, category, slot, display_order) VALUES
  ('breakfast-all-day',      'Breakfast All Day',      'wildcard', 'R3', 50),
  ('sandwich-supremacy',     'Sandwich Supremacy',     'wildcard', 'R3', 51),
  ('pasta-wars',             'Pasta Wars',             'wildcard', 'R3', 52),
  ('soup-showdown',          'Soup Showdown',          'wildcard', 'R3', 53),
  ('pizza-bracket',          'Pizza Bracket',          'wildcard', 'R3', 54),
  ('taco-tuesday-forever',   'Taco Tuesday Forever',   'wildcard', 'R3', 55),
  ('noodle-bowl-bracket',    'Noodle Bowl Bracket',    'wildcard', 'R3', 56),
  ('seafood-smackdown',      'Seafood Smackdown',      'wildcard', 'R3', 57),
  ('salad-that-slaps',       'Salad That Slaps',       'wildcard', 'R3', 58),
  ('bowl-food-bracket',      'Bowl Food Bracket',      'wildcard', 'R3', 59),
  ('street-food-world-tour', 'Street Food World Tour', 'wildcard', 'R3', 60),
  ('one-pan-wonder',         'One-Pan Wonder',         'wildcard', 'R3', 61),
  ('date-night-bracket',     'Date Night Bracket',     'wildcard', 'R3', 62)
ON CONFLICT (slug) DO NOTHING;

-- ── division_catalog: Dessert pool (Slot R4, 4-day cycle) ───
INSERT INTO division_catalog (slug, name, description, category, slot, display_order) VALUES
  ('dessert-knockout',         'Dessert Knockout',         'The ultimate showdown of indulgent desserts',           'dessert', 'R4', 70),
  ('chocolate-championship',   'Chocolate Championship',   'Everything chocolate — dark, milk, white, and beyond',  'dessert', 'R4', 71),
  ('cake-bake-off',            'Cake Bake-Off',            'Layer cakes, sheet cakes, cheesecakes — all competing', 'dessert', 'R4', 72),
  ('ice-cream-invitational',   'Ice Cream Invitational',   'Scoops, sundaes, and frozen novelties battle it out',   'dessert', 'R4', 73),
  ('cookie-clash',             'Cookie Clash',             'Drop cookies vs. bars vs. sandwich cookies',            'dessert', 'R4', 74),
  ('pie-playoffs',             'Pie Playoffs',             'Fruit pies, cream pies, tarts — one takes the crown',   'dessert', 'R4', 75),
  ('pastry-smackdown',         'Pastry Smackdown',         'Croissants, danishes, eclairs, and beyond',             'dessert', 'R4', 76)
ON CONFLICT (slug) DO NOTHING;

-- ── plateoffs_divisions: Activate anchor divisions ───────────
-- Upsert anchors by slug so this is safe to re-run.
-- recipe_ids and cover_image_url will be populated by curate-division-recipes.
INSERT INTO plateoffs_divisions (
  name, slug, description, category,
  is_active, display_order, division_type, catalog_id, recipe_ids
)
SELECT
  dc.name,
  dc.slug,
  dc.description,
  dc.category,
  true,
  dc.display_order,
  'anchor',
  dc.id,
  '{}'::uuid[]
FROM division_catalog dc
WHERE dc.category = 'anchor'
ON CONFLICT (slug) DO UPDATE SET
  division_type = 'anchor',
  is_active     = true,
  catalog_id    = EXCLUDED.catalog_id;
