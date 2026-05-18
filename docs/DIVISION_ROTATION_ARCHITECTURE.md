# Division Rotation & Recipe Curation Architecture

## Overview

Plateoffs shows users a curated lobby of food "divisions" — themed brackets of 8 recipes that compete head-to-head. This document defines the complete system for:

1. **A pre-seeded division catalog** — anchor divisions that always appear, plus a rotating pool that cycles on slot-specific schedules
2. **Deterministic rotation** — the active set is computed from a fixed epoch, so every server run produces the same result
3. **Recipe curation** — when a division activates, a Supabase Edge Function ensures ≥ 8 quality recipes per dietary profile exist in the bank
4. **Inline image generation** — every newly-inserted recipe gets an AI-generated food photo immediately during curation, before the user notification fires
5. **Dietary personalization** — every division maintains a pool large enough to guarantee 8 qualifying recipes for each dietary profile
6. **Synced countdown timers** — the app reads `next_*_rotation_at` from `app_config` rather than computing it locally

---

## 1. Division Types

### Anchor Divisions
Always active. These cover core dietary identities so users always have a "home" regardless of the rotation. The division never rotates, but its **recipe pool refreshes every 5 days** — the same epoch algorithm as R3.

| Slot | Display Order | Theme |
|------|--------------|-------|
| A1 | 2 | **Protein Throne** — highest-protein meals, any source |
| A2 | 4 | **Plant Power** — 100% plant-based |
| A3 | 6 | **30-Minute Wars** — fast weeknight cooking, any cuisine |
| A4 | 8 | **Comfort Classics** — hearty soul food from every culture |

### Rotating Divisions
Four slots cycle on independent schedules. Each slot picks from its own pool using the epoch algorithm.

| Slot | Display Order | Theme | Interval |
|------|-------------|-------|----------|
| **R1** | 1 | Cuisine Passport | Every **3 days** |
| **R2** | 3 | Seasonal/Contextual | Every **7 days** |
| **R3** | 5 | Wild Card | Every **5 days** |
| **R4** | 7 | Dessert | Every **4 days** |

**Total lobby size: 8 divisions** (4 anchors + 4 rotating).

**Lobby card order:** R1 (1), A1 (2), R2 (3), A2 (4), R3 (5), A3 (6), R4 (7), A4 (8) — interleaved.

> **Note:** Rotating divisions activated before migration 006 will have old display_order values (5, 10, 15, 20) until they next rotate. This self-corrects on each slot's next natural epoch advance.

---

## 2. Rotation Algorithm

### Epoch Definition

```
EPOCH_ZERO = 2025-06-01T00:00:00Z  (fixed, never changes)

R1_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 259200)   // 3 days
R2_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 604800)   // 7 days
R3_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 432000)   // 5 days
R4_epoch     = floor((now_unix - EPOCH_ZERO_unix) / 345600)   // 4 days
ANCHOR_epoch = floor((now_unix - EPOCH_ZERO_unix) / 432000)   // 5 days

next_R1_rotation_at     = EPOCH_ZERO_unix + (R1_epoch + 1) * 259200
next_R2_rotation_at     = EPOCH_ZERO_unix + (R2_epoch + 1) * 604800
next_R3_rotation_at     = EPOCH_ZERO_unix + (R3_epoch + 1) * 432000
next_R4_rotation_at     = EPOCH_ZERO_unix + (R4_epoch + 1) * 345600
next_anchor_rotation_at = EPOCH_ZERO_unix + (ANCHOR_epoch + 1) * 432000
```

**All epoch boundaries fall at midnight UTC.** Because EPOCH_ZERO is midnight UTC and every interval is an exact multiple of 86400 seconds, every rotation happens at 00:00:00 UTC. The hourly cron (`0 * * * *`) fires at midnight, so there is zero lag between epoch change and rotation.

### Slot Selection

```
pool     = division_catalog WHERE category = slot.category ORDER BY display_order ASC
eligible = pool filtered by active_months for the seasonal slot
selected = eligible[epoch % len(eligible)]
```

**Always `ORDER BY display_order ASC`.** This makes selection fully deterministic — the same epoch always selects the same division, regardless of Postgres storage order. The `display_order` values within each category (cuisine: 10–27, seasonal: 30–45, wildcard: 50–62, dessert: 70–76) explicitly define the rotation sequence.

### Notification Timing

The app schedules a local push notification at `rotatesAt + CURATION_BUFFER_MS` where:
- `rotatesAt` = `next_*_rotation_at` from `app_config` (midnight UTC)
- `CURATION_BUFFER_MS` = **8 minutes** (480 000 ms)

Timeline on rotation night:
```
00:00 — rotate-divisions (hourly cron) fires, epoch advanced, division activated,
          curation_pending = true, next_*_rotation_at updated in app_config
00:02 — curate-scheduler fires (offset 2 min from the hour, never races with rotation)
          picks up curation_pending, calls curate-division-recipes:
          · text + image generated in parallel per new recipe
00:02:45 — curation + images complete, curation_pending = false
00:08 — push notification fires → user opens app → lobby fully populated ✓
```

**Why the 2-minute offset matters:** Both crons could fire at `:00` if curate-scheduler ran `*/5`. Offsetting to `2,7,12,...` means curate-scheduler always fires 2 minutes after rotate-divisions at the hourly boundary, guaranteeing `curation_pending` is already set when it checks.

**Notification timing and timezone:** Midnight UTC = 7pm EST / 4pm PST — prime dinner-planning time for North American users. This is intentional and ideal for a food app. UK/European users (midnight local) are the only affected group; EPOCH_ZERO can be shifted if expanding to those markets.

---

## 3. Dietary Profiles

Every division must support all five profiles. Pool size is a result, not a target.

| Profile | Tag | Description |
|---------|-----|-------------|
| No restrictions | *(default)* | All recipes qualify |
| Vegetarian | `vegetarian` | No meat or fish |
| Vegan | `vegan` | No animal products |
| Gluten-free | `gluten_free` | No wheat/barley/rye |
| No pork | `no_pork` | No pork or derivatives |
| Dairy-free | `dairy_free` | No milk/cheese/butter |

---

## 4. Database Schema

### `division_catalog`

```sql
create table division_catalog (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  description      text,
  category         text not null,       -- 'anchor'|'cuisine'|'seasonal'|'wildcard'|'dessert'
  slot             text,                -- 'A1'..'A4'|'R1'..'R4'
  active_months    int[],               -- null = all months eligible
  display_order    int not null default 99,
                                        -- lobby card order AND rotation sequence within category
  cover_image_url  text,
  rotation_index   integer default 0,   -- anchor window position in division_recipe_bank
  last_curated_at  timestamptz,
  created_at       timestamptz default now()
);
```

### `division_recipe_bank`

```sql
create table division_recipe_bank (
  id         uuid        primary key default gen_random_uuid(),
  catalog_id uuid        not null references division_catalog(id) on delete cascade,
  recipe_id  uuid        not null references recipes(id),
  sort_order integer     not null,
  added_at   timestamptz not null default now(),
  unique (catalog_id, recipe_id)
);

create index on division_recipe_bank (catalog_id, sort_order);
```

### `plateoffs_divisions`

Key columns (including additions from migrations):
```sql
alter table plateoffs_divisions
  add column catalog_id       uuid references division_catalog(id),
  add column division_type    text default 'rotating',  -- 'anchor'|'rotating'
  add column active_until     timestamptz,
  add column curation_pending boolean not null default false;
  -- curation_pending: set true by rotate-divisions when bank needs growth.
  -- Cleared false by curate-division-recipes on success.
  -- Polled every 5 minutes by curate-scheduler.
```

### `app_config`

Stores per-slot epoch numbers and next rotation timestamps. Readable by the app (public RLS). Written only by `rotate-divisions`.

| Key | Example Value |
|-----|--------------|
| `r1_epoch` | `116` |
| `next_r1_rotation_at` | `2026-05-18T00:00:00.000Z` |
| `anchor_epoch` | `70` |
| `next_anchor_rotation_at` | `2026-05-22T00:00:00.000Z` |

### `recipes` additions

```sql
alter table recipes
  add column dietary_tags    text[] default '{}',
  add column meal_type_tags  text[] default '{}',
  add column ingredients     text[],
  add column instructions    text[],
  add column image_path      text,
  add column is_public       boolean,
  add column cook_time       integer,
  add column skill_level     text,
  add column source          text default 'manual';  -- 'manual'|'ai'
```

---

## 5. Edge Functions & Cron Schedule

### Cron Jobs (Supabase Dashboard → Integrations → Cron)

| Job Name | Schedule | Function | Purpose |
|----------|----------|----------|---------|
| `rotate-divisions-hourly` | `0 * * * *` | `rotate-divisions` | Epoch check + slot rotation |
| `curate-scheduler-5min` | `2,7,12,17,22,27,32,37,42,47,52,57 * * * *` | `curate-scheduler` | Process `curation_pending` queue |
| `backfill-images-30min` | `*/30 * * * *` | `backfill-recipe-images` | Cleanup sweep for any missed images |

---

### `rotate-divisions` (hourly cron)

Checks if any slot's epoch has advanced. Only mutates state when it has.

**Responsibilities:**
1. Compute current epochs from EPOCH_ZERO
2. Compare against stored epochs in `app_config`
3. For each rotating slot whose epoch advanced:
   - Deactivate the previous division (by `catalog_id`, avoids touching anchors)
   - Load the full recipe bank for the newly selected division
   - Upsert into `plateoffs_divisions` with `curation_pending = bank.length < MAX_BANK_SIZE`
4. On each anchor epoch advance (5-day cycle):
   - Slide the 40-recipe window forward through each anchor's bank
   - Set `curation_pending = true` if bank < MAX_BANK_SIZE
5. Run `markIncompleteDivisions` — safety net that sets `curation_pending = true` on any active division with fewer than 8 recipes (catches failed prior curation runs)
6. Write updated epochs and `next_*_rotation_at` to `app_config`
7. **Return immediately** — never calls curate-division-recipes via HTTP

**Anchor window rotation:**
```
ANCHOR_WINDOW_SIZE = 40
window = bank[rotation_index : rotation_index + 40]  (wraps around)
next_index = (rotation_index + 40) % bank.length
```
`rotation_index` persists in `division_catalog` across restarts.

---

### `curate-scheduler` (every 5 minutes)

Processes all divisions with `curation_pending = true` **sequentially** (one at a time), shortest recipe bank first.

**For each pending division:**
1. Call `curate-division-recipes` (synchronous — awaits full response)
2. `curate-division-recipes` handles: recipe generation + inline image generation + clearing `curation_pending`
3. Log result; if it fails, `curation_pending` stays true and retries next 5-minute run

**Why sequential:** prevents concurrent Gemini load from stacking. A single growth run takes ~45s (recipes + images). A single initial fill takes ~2 minutes. Most rotations affect 1 slot; worst case is 2–3 simultaneous, processed across 2–3 consecutive 5-minute runs.

**Authentication note:** uses `SUPABASE_ANON_KEY` (reliably auto-injected as a valid JWT) for inter-function HTTP calls. `curate-division-recipes` handles its own DB auth via `SUPABASE_SERVICE_ROLE_KEY`.

---

### `curate-division-recipes` (called by `curate-scheduler`, also manually callable)

Grows a division's recipe bank. Returns synchronously with a full result after completion.

**Accepts:** `{ slug }` or `{ catalog_id }` in POST body  
**Deployed:** `--no-verify-jwt` (internal infrastructure function)  
**Returns:** `{ ok, division, mode, bankSize, inserted, matched }`

**Bank constants:**
| Constant | Value | Meaning |
|---|---|---|
| `INITIAL_BANK_TARGET` | 40 | Fill to this when bank starts empty |
| `GROWTH_BATCH` | 10 | Recipes added per growth call |
| `MAX_BANK_SIZE` | 250 | Bank cap — rotation cycles forever after this |
| `RESOLVE_BATCH_SIZE` | 20 | Parallel recipe resolutions per batch |

**Bank lifecycle:**
- **Initial fill** (`bank = 0`): Pass 1 broad generation (up to 20 recipes) + gap-fill rounds until every dietary profile has ≥ 8 qualifying recipes. Inline retry if bank still below target.
- **Growth mode** (`0 < bank < 250`): 10 fresh recipes per call, passing last 40 recipe names to Gemini to avoid near-duplicates.
- **Full** (`bank ≥ 250`): returns immediately, no generation.

**Recipe resolution pipeline (per batch):**
1. **Lookup phase (parallel):** `recipes.ilike(name)` — find existing DB match
2. **Insert phase (parallel):** for new recipes only:
   - Text details (Gemini 2.5 Flash) and image (Gemini 2.5 Flash Image) generated **in parallel**
   - Recipe inserted into `recipes` with `source = 'ai'`, `is_public = true`
   - Image uploaded to `recipe-images/ai-generated/{id}.png`, `image_path` set immediately
3. **Tag phase (parallel):** merge `dietary_tags` on matched existing recipes
4. **Bank phase (sequential):** insert into `division_recipe_bank` with deterministic `sort_order`

**On completion:**
- Syncs full bank to `plateoffs_divisions.recipe_ids` for the active row
- Sets `curation_pending = false` on `plateoffs_divisions`
- Stamps `last_curated_at` on `division_catalog`

**Timing:** growth mode ~45s total (text + image parallel). Initial fill ~90–120s.

---

### `backfill-recipe-images` (every 30 minutes, cleanup only)

A safety net for any images that failed during inline generation in `curate-division-recipes`.

**Deployed:** `--no-verify-jwt`  
**Model:** `gemini-2.5-flash-image` via `@google/genai` SDK  
**Accepts:** `{ recipe_ids[] }`, `{ catalog_id }`, or `{}` (global scan)

**Global scan scope:** queries `division_recipe_bank` for recipe IDs first, then filters `recipes` to `source = 'ai' AND image_path IS NULL` within that set. This avoids touching the thousands of seeded CMP recipes that have nothing to do with Plateoffs.

**Process:** parallel batches of 5 images → upload to `recipe-images/ai-generated/{id}.png` → update `image_path`.

---

## 6. App-Side Dietary Filtering

When a user enters a division, the app filters the division's recipe pool to their dietary profile:

```typescript
async function fetchDivisionRecipes(division: Division, dietaryProfile: string[]): Promise<Recipe[]> {
  const { data } = await supabase
    .from('recipes')
    .select('*')
    .in('id', division.recipe_ids)
    .contains('dietary_tags', dietaryProfile)
    .limit(8)
  return data ?? []
}
```

### Countdown Timers

```typescript
async function fetchNextRotationAt(): Promise<number> {
  const { data } = await supabase
    .from('app_config')
    .select('key,value')
    .in('key', ['next_r1_rotation_at', 'next_r2_rotation_at', 'next_r3_rotation_at', 'next_r4_rotation_at'])
  const times = (data ?? []).map(r => new Date(r.value).getTime())
  return times.length ? Math.min(...times) : Date.now() + 3 * 86_400_000
}
```

Rotating slots show **"ROTATES IN"**; anchor slots show **"RECIPES IN"**.

### Push Notification Buffer

```typescript
const CURATION_BUFFER_MS = 8 * 60 * 1000  // 8 minutes after epoch change
```

The 8-minute buffer ensures `curate-scheduler` has time to run a full curation + image generation pass before the user is notified. Since all epoch boundaries fall at midnight UTC and the cron fires at midnight, the window is:

- `00:00` rotate-divisions fires and sets `curation_pending`
- `00:05` curate-scheduler fires, curation + images complete within ~45s
- `00:08` notification fires → lobby fully populated

---

## 7. Pre-Seeded Division Catalog

### Anchor Divisions (4, always active)

| display_order | slug | name |
|---|------|------|
| 2 | `protein-throne` | Protein Throne |
| 4 | `plant-power` | Plant Power |
| 6 | `30-minute-wars` | 30-Minute Wars |
| 8 | `comfort-classics` | Comfort Classics |

### Cuisine Pool (Slot R1 — 18 entries, 3-day cycle)

Rotation sequence determined by `display_order` (10–27):

| do | slug | name |
|----|------|------|
| 10 | `italian-masters` | Italian Masters |
| 11 | `japanese-showdown` | Japanese Showdown |
| 12 | `mexican-street-fight` | Mexican Street Fight |
| 13 | `thai-throwdown` | Thai Throwdown |
| 14 | `indian-spice-wars` | Indian Spice Wars |
| 15 | `mediterranean-clash` | Mediterranean Clash |
| 16 | `french-bistro-battle` | French Bistro Battle |
| 17 | `korean-fire` | Korean Fire |
| 18 | `chinese-takeout-wars` | Chinese Takeout Wars |
| 19 | `vietnamese-bowl-off` | Vietnamese Bowl-Off |
| 20 | `greek-taverna-fight` | Greek Taverna Fight |
| 21 | `spanish-tapas-brawl` | Spanish Tapas Brawl |
| 22 | `middle-east-mashup` | Middle East Mashup |
| 23 | `peruvian-showdown` | Peruvian Showdown |
| 24 | `ethiopian-feast` | Ethiopian Feast |
| 25 | `american-bbq-bracket` | American BBQ Bracket |
| 26 | `dim-sum-derby` | Dim Sum Derby |
| 27 | `caribbean-clash` | Caribbean Clash |

### Seasonal / Contextual Pool (Slot R2 — 16 entries, 7-day cycle)

| do | slug | name | active_months |
|----|----|------|--------------|
| 30 | `summer-grill-masters` | Summer Grill Masters | [6,7,8] |
| 31 | `summer-salad-slam` | Summer Salad Slam | [6,7,8] |
| 32 | `fall-harvest-bowl` | Fall Harvest Bowl | [9,10,11] |
| 33 | `fall-soup-wars` | Fall Soup Wars | [9,10,11] |
| 34 | `winter-warmers` | Winter Warmers | [12,1,2] |
| 35 | `holiday-feast-bracket` | Holiday Feast Bracket | [12,1] |
| 36 | `spring-garden-fresh` | Spring Garden Fresh | [3,4,5] |
| 37 | `spring-brunch-battle` | Spring Brunch Battle | [3,4,5] |
| 38 | `game-day-grub` | Game Day Grub | [1,2,9,10] |
| 39 | `valentines-dinner` | Valentine's Dinner | [2] |
| 40 | `thanksgiving-sides` | Thanksgiving Sides | [11] |
| 41 | `summer-dessert-duel` | Summer Dessert Duel | [6,7,8] |
| 42 | `cold-weather-stews` | Cold-Weather Stews | [11,12,1,2] |
| 43 | `spring-detox-bracket` | Spring Detox Bracket | [3,4] |
| 44 | `tailgate-titans` | Tailgate Titans | [9,10] |
| 45 | `new-year-fresh-start` | New Year Fresh Start | [1] |

### Wild Card Pool (Slot R3 — 13 entries, 5-day cycle)

| do | slug | name |
|----|------|------|
| 50 | `breakfast-all-day` | Breakfast All Day |
| 51 | `sandwich-supremacy` | Sandwich Supremacy |
| 52 | `pasta-wars` | Pasta Wars |
| 53 | `soup-showdown` | Soup Showdown |
| 54 | `pizza-bracket` | Pizza Bracket |
| 55 | `taco-tuesday-forever` | Taco Tuesday Forever |
| 56 | `noodle-bowl-bracket` | Noodle Bowl Bracket |
| 57 | `seafood-smackdown` | Seafood Smackdown |
| 58 | `salad-that-slaps` | Salad That Slaps |
| 59 | `bowl-food-bracket` | Bowl Food Bracket |
| 60 | `street-food-world-tour` | Street Food World Tour |
| 61 | `one-pan-wonder` | One-Pan Wonder |
| 62 | `date-night-bracket` | Date Night Bracket |

### Dessert Pool (Slot R4 — 7 entries, 4-day cycle)

| do | slug | name |
|----|------|------|
| 70 | `dessert-knockout` | Dessert Knockout |
| 71 | `chocolate-championship` | Chocolate Championship |
| 72 | `cake-bake-off` | Cake Bake-Off |
| 73 | `ice-cream-invitational` | Ice Cream Invitational |
| 74 | `cookie-clash` | Cookie Clash |
| 75 | `pie-playoffs` | Pie Playoffs |
| 76 | `pastry-smackdown` | Pastry Smackdown |

---

## 8. Implementation Checklist

### Database & Catalog
- [x] `division_catalog` with RLS
- [x] `division_recipe_bank` with RLS
- [x] `app_config` with initial values
- [x] `user_profiles` with RLS
- [x] `dietary_tags`, `source`, `image_path` added to `recipes`
- [x] `catalog_id`, `division_type`, `curation_pending` added to `plateoffs_divisions`
- [x] Anchor `display_order` corrected to 2/4/6/8 (migration 006)
- [x] All catalog pools seeded with `display_order` values

### Edge Functions
- [x] `rotate-divisions` — deterministic selection (ORDER BY display_order), curation_pending flag, no HTTP curation trigger
- [x] `curate-scheduler` — sequential processing, awaits full curate response
- [x] `curate-division-recipes` — text + image parallel generation in insertRecipe, clears curation_pending
- [x] `backfill-recipe-images` — gemini-2.5-flash-image model, scoped to division_recipe_bank

### Cron Jobs (Supabase Dashboard)
- [x] `rotate-divisions-hourly`: `0 * * * *`
- [x] `curate-scheduler-5min`: `*/5 * * * *`
- [x] `backfill-images-30min`: `*/30 * * * *`

### Mobile App
- [ ] `fetchNextRotationAt()` reads all four `next_*_rotation_at` values
- [ ] Countdown labels: "ROTATES IN" for rotating, "RECIPES IN" for anchors
- [x] `CURATION_BUFFER_MS` = 8 minutes (480 000 ms)
- [ ] Dietary profile preference UI (onboarding or settings)
- [ ] `fetchDivisionRecipes()` applies `dietary_tags` filter

---

## 9. Key Invariants

- `EPOCH_ZERO` is immutable. Changing it shifts the entire rotation calendar.
- **All epoch boundaries fall at midnight UTC.** Every interval (259200, 604800, 432000, 345600) is an exact multiple of 86 400 s. The hourly cron fires at midnight, so rotations happen within seconds of the epoch change. Midnight UTC = 7pm EST / 4pm PST — prime dinner-planning time for North American users.
- **curate-scheduler is offset from rotate-divisions.** Running at `2,7,12,...` instead of `*/5` ensures it fires 2 minutes after rotate-divisions at the hourly boundary, eliminating the race condition where both crons start simultaneously before `curation_pending` is set.
- **Division selection is deterministic.** Pools are always queried `ORDER BY display_order ASC` before `epoch % pool_size` is applied. The same epoch always selects the same division.
- **Curation is decoupled from rotation.** `rotate-divisions` sets `curation_pending = true` and returns immediately. `curate-scheduler` processes the queue every 5 minutes.
- **Images are inline.** Every AI-generated recipe gets its image generated in parallel with its text details inside `insertRecipe`, before the recipe ID is returned to the bank. By the time curation completes, all new recipes have `image_path` set.
- **The 8-minute notification buffer is the guarantee.** All curation + image work completes within 5–6 minutes of midnight. The notification fires at minute 8, when everything is ready.
- **`curation_pending` is the retry mechanism.** If curation fails partway, `curation_pending` stays true and `curate-scheduler` retries at the next 5-minute run. No work is silently dropped.
- **Anchor divisions are never deactivated.** Only `division_type = 'rotating'` rows are touched by rotation logic.
- **`backfill-recipe-images` is scoped to Plateoffs.** It queries `division_recipe_bank` for recipe IDs before touching `recipes`, never scanning the main CMP recipe catalog.
- **The app reads rotation state, never computes it.** All `next_*_rotation_at` values come from `app_config`. The app shows what the server says.
