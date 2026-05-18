# Division Rotation & Recipe Curation Architecture

## Overview

Plateoffs shows users a curated lobby of food "divisions" — themed brackets of 8 recipes that compete head-to-head. This document defines the system for:

1. **A pre-seeded division catalog** — anchor divisions that always appear, plus a rotating pool that cycles on slot-specific schedules
2. **Deterministic rotation** — the active set is computed from a fixed epoch, so every device agrees without coordination
3. **Server-side recipe curation** — when a division activates, a Supabase Edge Function ensures ≥ 8 quality recipes per dietary profile exist in the database
4. **Dietary personalization** — every division maintains a pool large enough to guarantee 8 qualifying recipes for each supported dietary profile
5. **A synced countdown timer** — the app reads the true next-rotation timestamp from the database instead of computing a fake local one

---

## 1. Division Types

### Anchor Divisions
Always active. These cover core dietary identities so users always have a "home" category regardless of the rotation. The division itself never rotates, but its **recipe pool refreshes every 5 days** — the same epoch algorithm as R3, using a single shared `next_anchor_rotation_at` timestamp in `app_config`.

| Slot | Theme | Rationale |
|------|-------|-----------|
| A1 | **Protein Throne** | High-protein meals (any source) |
| A2 | **Plant Power** | Vegan / whole-food plant-based |
| A3 | **30-Minute Wars** | Weeknight speed cooking, any cuisine, any diet |
| A4 | **Comfort Classics** | Hearty, crowd-pleasing staples |

### Rotating Divisions
Three rotating slots cycle on independent schedules. The active entries are selected from a pre-seeded catalog using a deterministic epoch algorithm per slot:

| Slot | Theme | Rotation Interval |
|------|-------|-------------------|
| **R1** | Cuisine Passport | Every **3 days** |
| **R2** | Seasonal/Contextual | Every **7 days** |
| **R3** | Wild Card | Every **5 days** |
| **R4** | Dessert | Every **4 days** |

Each slot has its own epoch counter derived from the same `EPOCH_ZERO`, just divided by its own interval.

**Total lobby size: 8 divisions** (4 anchors + 4 rotating). Cards display in order: R1, A1, R2, A2, R3, A3, R4, A4.

---

## 2. Rotation Algorithm

### Epoch Definition

```
EPOCH_ZERO = 2025-06-01T00:00:00Z  (fixed, never changes)

R1_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 259200)   // 3 days
R2_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 604800)   // 7 days
R3_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 432000)   // 5 days
R4_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 345600)   // 4 days
ANCHOR_epoch = floor((now_unix - EPOCH_ZERO_unix) / 432000)   // 5 days (shared by all 4 anchors)

next_R1_rotation_at     = EPOCH_ZERO_unix + (R1_epoch + 1) * 259200
next_R2_rotation_at     = EPOCH_ZERO_unix + (R2_epoch + 1) * 604800
next_R3_rotation_at     = EPOCH_ZERO_unix + (R3_epoch + 1) * 432000
next_R4_rotation_at     = EPOCH_ZERO_unix + (R4_epoch + 1) * 345600
next_anchor_rotation_at = EPOCH_ZERO_unix + (ANCHOR_epoch + 1) * 432000
```

Each division card shows its own countdown. Rotating slots display "ROTATES IN"; anchor slots display "RECIPES IN" (the division stays, only the recipe pool refreshes).

The cron runs hourly and compares current epochs against what's stored in `app_config` — only acting when a slot's epoch has advanced.

### Slot Selection

```
R1_index = R1_epoch % len(cuisine_pool)
R2_index = R2_epoch % len(seasonal_pool)   // filtered by current month
R3_index = R3_epoch % len(wildcard_pool)   // anything not already active
```

The **seasonal pool** is filtered at runtime: only entries whose `active_months` array includes the current calendar month are eligible.

---

## 3. Dietary Profiles

Every division must support all five dietary profiles. The recipe pool size is variable — whatever is needed to guarantee ≥ 8 qualifying recipes per profile.

### Supported Profiles

| Profile | Tag | Description |
|---------|-----|-------------|
| No restrictions | *(default)* | All recipes qualify |
| Vegetarian | `vegetarian` | No meat or fish |
| Vegan | `vegan` | No animal products |
| Gluten-free | `gluten_free` | No wheat/barley/rye |
| No pork | `no_pork` | No pork or pork derivatives |
| Dairy-free | `dairy_free` | No milk/cheese/butter |

A recipe can qualify for multiple profiles. A vegan pasta dish tagged `['vegan', 'dairy_free', 'gluten_free']` counts toward three profiles simultaneously.

### Pool Sizing Rule

The curation function generates recipes until every profile has ≥ 8 qualifying recipes. Pool size is a result, not a target:

- A salad-heavy division may need only 12–14 total (high natural overlap)
- American BBQ Bracket may need 28–32 total (low vegan/dairy-free overlap)
- Gemini is always capable of finding on-theme recipes for any profile (vegan protein for Protein Throne, gluten-free pasta for Italian Masters, etc.)

---

## 4. Database Schema

### New Table: `division_catalog`

```sql
create table division_catalog (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  description      text,
  category         text not null,       -- 'anchor' | 'cuisine' | 'seasonal' | 'wildcard'
  slot             text,                -- 'A1'|'A2'|'A3'|'A4'|'R1'|'R2'|'R3'; null for pool entries
  active_months    int[],               -- [1..12], null = all months eligible
  display_order    int not null default 99,
  cover_image_url  text,
  rotation_index   integer default 0,  -- current position in division_recipe_bank; advanced each anchor epoch
  last_curated_at  timestamptz,        -- updated each time the bank grows
  created_at       timestamptz default now()
);

-- RLS: public read, service role write
alter table division_catalog enable row level security;
create policy "Public read access" on division_catalog for select using (true);
```

### New Table: `division_recipe_bank`

One row per recipe per division. This is the bank — a curated set of up to 250 recipes
per division. `rotate-divisions` slices it using `rotation_index` to produce the active
window. Once full, curation stops permanently and the window just cycles forever.

```sql
create table division_recipe_bank (
  id         uuid        primary key default gen_random_uuid(),
  catalog_id uuid        not null references division_catalog(id) on delete cascade,
  recipe_id  uuid        not null references recipes(id),
  sort_order integer     not null,   -- rotation sequence; new entries append at the end
  added_at   timestamptz not null default now(),
  unique (catalog_id, recipe_id)
);

create index on division_recipe_bank (catalog_id, sort_order);
```

**Curation writes here, not to the main `recipes` table.** New AI-generated recipes are
inserted into `recipes` (building the public catalog) and then also registered here.
Existing recipes matched by name from the public catalog are registered here directly.

### New Table: `app_config`

```sql
create table app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

-- Seed rows:
insert into app_config (key, value) values
  ('epoch_zero',             '2025-06-01T00:00:00Z'),
  ('r1_epoch',               '0'),
  ('r2_epoch',               '0'),
  ('r3_epoch',               '0'),
  ('r4_epoch',               '0'),
  ('anchor_epoch',           '0'),
  ('next_r1_rotation_at',     '2025-06-04T00:00:00Z'),
  ('next_r2_rotation_at',     '2025-06-08T00:00:00Z'),
  ('next_r3_rotation_at',     '2025-06-06T00:00:00Z'),
  ('next_r4_rotation_at',     '2025-06-05T00:00:00Z'),
  ('next_anchor_rotation_at', '2025-06-06T00:00:00Z');

-- RLS: public read, service role write
alter table app_config enable row level security;
create policy "Public read access" on app_config for select using (true);
```

### New Table: `user_profiles`

```sql
create table user_profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  dietary_profile  text[] default '{}',   -- e.g. ['vegan', 'gluten_free']
  display_name     text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- RLS: users read/write their own row only
alter table user_profiles enable row level security;
create policy "Users manage own profile"
  on user_profiles
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

### Modifications to `plateoffs_divisions`

```sql
alter table plateoffs_divisions
  add column catalog_id    uuid references division_catalog(id),
  add column division_type text default 'rotating';  -- 'anchor' | 'rotating'
```

### Modifications to `recipes`

```sql
alter table recipes
  add column dietary_tags text[] default '{}',  -- e.g. ['vegan', 'gluten_free', 'no_pork']
  add column source        text default 'manual'; -- 'manual' | 'ai_generated'
```

---

## 5. Supabase Edge Functions

### `rotate-divisions` (scheduled, runs hourly)

Checks if any slot's epoch has advanced. Only acts on slots that have actually changed.

**Responsibilities:**
1. Compute current R1/R2/R3/R4 epochs from `EPOCH_ZERO`
2. Compare against stored epochs in `app_config`
3. For each rotating slot whose epoch has advanced:
   - Deactivate the previous division for that slot in `plateoffs_divisions`
   - Activate (or insert) the newly selected division
   - Trigger `curate-division-recipes` if the new division has < 8 recipes
4. On each anchor epoch advance (5-day cycle):
   - Slide the **active window** forward through each anchor's recipe bank
   - Trigger `curate-division-recipes` for anchors whose bank is below `MAX_BANK_SIZE`
5. Retry any active divisions still below `BRACKET_SIZE` (catches timed-out curation jobs)
6. Update `app_config` with new epochs and `next_*_rotation_at` values

**Anchor window rotation:**
```
ANCHOR_WINDOW_SIZE = 40

// division_catalog.rotation_index persists where we are in the bank
window = bank[rotation_index : rotation_index + ANCHOR_WINDOW_SIZE]  (wraps)
next_rotation_index = (rotation_index + ANCHOR_WINDOW_SIZE) % bank.length

// Written back to division_catalog each epoch
```
`rotation_index` is persisted on `division_catalog` so it survives restarts and bank
growth. Each 5-day epoch the index advances by 40. Once the bank reaches 250 recipes
the full bank cycles in ~6 epochs (~30 days) before any recipe repeats in the active set.

---

### `curate-division-recipes` (called by `rotate-divisions`, also callable manually)

Grows a division's recipe bank in `division_catalog`. **Does not generate images** —
image generation is handled by `backfill-recipe-images` after insert.

**Bank sizing constants:**
| Constant | Value | Meaning |
|---|---|---|
| `INITIAL_BANK_TARGET` | 40 | Fill to this on first run |
| `GROWTH_BATCH` | 10 | New recipes added per subsequent cycle |
| `MAX_BANK_SIZE` | 250 | Stop generating; window cycles forever |
| `RESOLVE_BATCH_SIZE` | 5 | Recipes processed per sequential batch |

**Bank lifecycle:**
- **Initial fill** (`bank < 40`): broad Pass 1 generation (up to 20 recipes) + gap-fill passes until every dietary profile has ≥ 8 qualifying recipes
- **Growth mode** (`40 ≤ bank < 250`): add `GROWTH_BATCH` fresh recipes per cycle, passing existing recipe names to Gemini to avoid near-duplicates
- **Full** (`bank ≥ 250`): skip generation, return immediately

At **~6 months** of 5-day anchor cycles, each anchor bank reaches ≈ 250 recipes — enough to go roughly a year before a recipe repeats in the active 40-recipe window.

**For each proposed recipe:**
1. Search `recipes` by name (`ilike`) for an existing match
2. If found: merge `dietary_tags`, add ID to bank
3. If not: generate full recipe details via Gemini (text only), insert into `recipes`, add ID to bank
4. Process in sequential batches of `RESOLVE_BATCH_SIZE` to avoid Edge Function timeout

**After all recipes are resolved:**
- Write updated `recipe_ids` to `division_catalog`
- Sync `plateoffs_divisions.recipe_ids = full bank` for any active row linked to this catalog entry
  *(for anchors this is overwritten by the next window rotation; for rotating divisions the full bank is immediately playable)*
- Fire-and-forget `backfill-recipe-images` for newly inserted recipe IDs

---

### `backfill-recipe-images` (called by `curate-division-recipes`, also callable manually)

Generates and uploads images for AI recipes that are missing them. Decoupled from
curation so a slow image generation run never blocks recipe insertion.

**Accepts:**
- `recipe_ids: string[]` (optional) — scope to specific recipes; omit to process any AI recipe missing an image
- `limit: number` (default 20) — max recipes to process per invocation

**Process:**
1. Query `recipes` where `source = 'ai'` and `image_path IS NULL`, filtered to provided IDs if given
2. Generate images via Gemini in parallel batches of 3
3. Upload each image to `recipe-images` storage bucket at `ai-generated/{id}.png`
4. Update `recipes.image_path`

Can be called repeatedly — idempotent, skips any recipe that already has an image.

---

## 6. App-Side Dietary Filtering

When a user enters a division, the app selects 8 recipes from the division's pool that match the user's dietary profile.

```typescript
// lib/supabase.ts
async function fetchDivisionRecipes(division: Division, dietaryProfile: string[]): Promise<Recipe[]> {
  const { data } = await supabase
    .from('recipes')
    .select('*')
    .in('id', division.recipe_ids)
    .contains('dietary_tags', dietaryProfile)  // all user tags must be present
    .limit(8);
  return data ?? [];
}
```

If fewer than 8 qualify (edge case), the app falls back to the closest match and logs the gap for re-curation.

### Fetching `next_rotation_at` for Countdown

```typescript
async function fetchNextRotationAt(): Promise<number> {
  const { data } = await supabase
    .from('app_config')
    .select('key,value')
    .in('key', ['next_r1_rotation_at', 'next_r2_rotation_at', 'next_r3_rotation_at']);

  const times = (data ?? []).map(r => new Date(r.value).getTime());
  return times.length ? Math.min(...times) : Date.now() + 3 * 86_400_000;
}
```

Countdown label: **"NEXT ROTATION IN:"** (replaces "NEXT BATCH OF BRAWLS DROPPING IN:")

---

## 7. Pre-Seeded Division Catalog

### Anchor Divisions (4, always active)

| slug | name | description |
|------|------|-------------|
| `protein-throne` | Protein Throne | The highest-protein showdown — any source |
| `plant-power` | Plant Power | 100% plant-based, zero compromise on flavor |
| `30-minute-wars` | 30-Minute Wars | Fast weeknight cooking — any cuisine, any diet |
| `comfort-classics` | Comfort Classics | Hearty soul food from every culture |

### Cuisine Pool (Slot R1 — 18 entries, 3-day cycle, ~54-day full rotation)

| slug | name |
|------|------|
| `italian-masters` | Italian Masters |
| `japanese-showdown` | Japanese Showdown |
| `mexican-street-fight` | Mexican Street Fight |
| `thai-throwdown` | Thai Throwdown |
| `indian-spice-wars` | Indian Spice Wars |
| `mediterranean-clash` | Mediterranean Clash |
| `french-bistro-battle` | French Bistro Battle |
| `korean-fire` | Korean Fire |
| `chinese-takeout-wars` | Chinese Takeout Wars |
| `vietnamese-bowl-off` | Vietnamese Bowl-Off |
| `greek-taverna-fight` | Greek Taverna Fight |
| `spanish-tapas-brawl` | Spanish Tapas Brawl |
| `middle-east-mashup` | Middle East Mashup |
| `peruvian-showdown` | Peruvian Showdown |
| `ethiopian-feast` | Ethiopian Feast |
| `american-bbq-bracket` | American BBQ Bracket |
| `dim-sum-derby` | Dim Sum Derby |
| `caribbean-clash` | Caribbean Clash |

### Seasonal / Contextual Pool (Slot R2 — 16 entries, 7-day cycle, filtered by month)

| slug | name | active_months |
|------|------|--------------|
| `summer-grill-masters` | Summer Grill Masters | [6,7,8] |
| `summer-salad-slam` | Summer Salad Slam | [6,7,8] |
| `fall-harvest-bowl` | Fall Harvest Bowl | [9,10,11] |
| `fall-soup-wars` | Fall Soup Wars | [9,10,11] |
| `winter-warmers` | Winter Warmers | [12,1,2] |
| `holiday-feast-bracket` | Holiday Feast Bracket | [12,1] |
| `spring-garden-fresh` | Spring Garden Fresh | [3,4,5] |
| `spring-brunch-battle` | Spring Brunch Battle | [3,4,5] |
| `game-day-grub` | Game Day Grub | [1,2,9,10] |
| `valentines-dinner` | Valentine's Dinner | [2] |
| `thanksgiving-sides` | Thanksgiving Sides | [11] |
| `summer-dessert-duel` | Summer Dessert Duel | [6,7,8] |
| `cold-weather-stews` | Cold-Weather Stews | [11,12,1,2] |
| `spring-detox-bracket` | Spring Detox Bracket | [3,4] |
| `tailgate-titans` | Tailgate Titans | [9,10] |
| `new-year-fresh-start` | New Year Fresh Start | [1] |

### Wild Card Pool (Slot R3 — 13 entries, 5-day cycle)

| slug | name |
|------|------|
| `breakfast-all-day` | Breakfast All Day |
| `sandwich-supremacy` | Sandwich Supremacy |
| `pasta-wars` | Pasta Wars |
| `soup-showdown` | Soup Showdown |
| `pizza-bracket` | Pizza Bracket |
| `taco-tuesday-forever` | Taco Tuesday Forever |
| `noodle-bowl-bracket` | Noodle Bowl Bracket |
| `seafood-smackdown` | Seafood Smackdown |
| `salad-that-slaps` | Salad That Slaps |
| `bowl-food-bracket` | Bowl Food Bracket |
| `street-food-world-tour` | Street Food World Tour |
| `one-pan-wonder` | One-Pan Wonder |
| `date-night-bracket` | Date Night Bracket |

### Dessert Pool (Slot R4 — 7 entries, 4-day cycle, ~28-day full rotation)

| slug | name |
|------|------|
| `dessert-knockout` | Dessert Knockout |
| `chocolate-championship` | Chocolate Championship |
| `cake-bake-off` | Cake Bake-Off |
| `ice-cream-invitational` | Ice Cream Invitational |
| `cookie-clash` | Cookie Clash |
| `pie-playoffs` | Pie Playoffs |
| `pastry-smackdown` | Pastry Smackdown |

---

## 8. Implementation Phases

### Phase 1 — Database & Catalog
- [ ] Create `division_catalog` table with RLS
- [ ] Create `app_config` table with RLS and initial values
- [ ] Create `user_profiles` table with RLS
- [ ] Add `dietary_tags` and `source` columns to `recipes`
- [ ] Add `catalog_id` and `division_type` columns to `plateoffs_divisions`
- [ ] Seed all anchor + pool entries into `division_catalog`
- [ ] Manually set up anchor divisions in `plateoffs_divisions` as `division_type = 'anchor'`

### Phase 2 — App Timer Sync & Dietary Filtering
- [ ] Add `fetchNextRotationAt()` to `lib/supabase.ts`
- [ ] Update `fetchDivisionRecipes()` to accept and apply `dietaryProfile`
- [ ] Add dietary profile to user store / context
- [ ] Update `lobby.tsx` to fetch per-slot rotation times and pass to each card
- [ ] Anchor cards show "RECIPES IN" label; rotating cards show "ROTATES IN"
- [ ] Add dietary preference UI (onboarding or settings screen)

### Phase 3 — `curate-division-recipes` Edge Function
- [x] Create Edge Function scaffold with Gemini API integration
- [x] Implement Pass 1 broad generation with dietary coverage targets
- [x] Implement gap analysis per dietary profile
- [x] Implement targeted fill passes until all profiles reach 8
- [x] Implement recipe name matching → conditional insert flow
- [x] Batch sequential resolution (5 at a time) to avoid Edge Function timeout
- [x] Growth mode: add 10 fresh recipes per cycle, passing existing names to avoid near-duplicates
- [x] Bank cap: skip generation once bank reaches 250 recipes
- [x] Sync `plateoffs_divisions.recipe_ids` after curation so divisions are immediately playable
- [x] Fire-and-forget `backfill-recipe-images` for newly inserted IDs

### Phase 4 — `rotate-divisions` Edge Function
- [x] Implement per-slot epoch computation (R1/R2/R3/R4 independent intervals)
- [x] Compare current epochs to stored epochs in `app_config`
- [x] Implement division deactivation / activation per slot
- [x] Wire call to `curate-division-recipes` per new division
- [x] Write updated epochs and `next_*_rotation_at` to `app_config`
- [x] Schedule via Supabase Cron (run hourly, act only when epoch advances)
- [x] Anchor window rotation: slide 40-recipe window through bank each epoch
- [x] Trigger growth curation for anchors until bank reaches MAX_BANK_SIZE

### Phase 5 — `backfill-recipe-images` Edge Function
- [x] Create Edge Function for async image generation
- [x] Accept `recipe_ids[]` for targeted backfill or run globally with `limit`
- [x] Process in parallel batches of 3 to balance speed vs. timeout
- [x] Idempotent: skip recipes that already have images

### Phase 6 — Seeding & Backfill
- [ ] Run migration `004_recipe_bank_growth.sql`
- [ ] Run `curate-division-recipes` against all 4 anchor divisions (initial fill)
- [ ] Dry-run `rotate-divisions` against current epoch to populate first rotating set
- [ ] Verify lobby displays correct 8 divisions with working countdown
- [ ] Verify dietary filtering returns correct 8 recipes per profile
- [ ] Confirm `backfill-recipe-images` fills images for all AI-generated recipes

---

## 9. Key Invariants

- `EPOCH_ZERO` is immutable once set. Changing it shifts the entire rotation calendar.
- Every division always supports all dietary profiles. Pool size is whatever is needed to guarantee ≥ 8 recipes per profile — never a fixed number.
- Each division always has ≥ 8 recipe IDs per dietary profile before it can become active. The curation function enforces this gate.
- Anchor divisions are **never** deactivated by the cron. Only `division_type = 'rotating'` rows are touched.
- The cron runs hourly but only mutates state when a slot's epoch has actually advanced.
- AI-generated recipes are flagged with `source = 'ai_generated'` so they can be audited or replaced later.
- The app never computes the rotation schedule itself — it only reads `next_*_rotation_at` from `app_config` for display.
- Dietary filtering happens at bracket-build time using `dietary_tags` on individual recipes, not at the division level.
