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
  recipe_ids       uuid[],              -- full pool, populated by curation function
  last_curated_at  timestamptz,
  created_at       timestamptz default now()
);

-- RLS: public read, service role write
alter table division_catalog enable row level security;
create policy "Public read access" on division_catalog for select using (true);
```

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
1. Compute current R1/R2/R3 epochs from `EPOCH_ZERO`
2. Compare against stored epochs in `app_config`
3. For each slot whose epoch has advanced:
   - Deactivate the previous division for that slot in `plateoffs_divisions`
   - Activate (or insert) the newly selected division
   - Call `curate-division-recipes` if the division hasn't been curated yet
4. Update `app_config` with new epochs and `next_*_rotation_at` values

**Pseudocode:**
```typescript
const epochZero = new Date('2025-06-01T00:00:00Z').getTime() / 1000;
const now = Math.floor(Date.now() / 1000);

const r1Epoch     = Math.floor((now - epochZero) / 259200);
const r2Epoch     = Math.floor((now - epochZero) / 604800);
const r3Epoch     = Math.floor((now - epochZero) / 432000);
const r4Epoch     = Math.floor((now - epochZero) / 345600);
const anchorEpoch = Math.floor((now - epochZero) / 432000);  // 5 days

const stored = await getAppConfig(['r1_epoch', 'r2_epoch', 'r3_epoch', 'r4_epoch', 'anchor_epoch']);

if (r1Epoch     > Number(stored.r1_epoch))     await rotateSlot('R1', r1Epoch, cuisinePool);
if (r2Epoch     > Number(stored.r2_epoch))     await rotateSlot('R2', r2Epoch, getSeasonalPool(currentMonth()));
if (r3Epoch     > Number(stored.r3_epoch))     await rotateSlot('R3', r3Epoch, wildcardPool);
if (r4Epoch     > Number(stored.r4_epoch))     await rotateSlot('R4', r4Epoch, dessertPool);
if (anchorEpoch > Number(stored.anchor_epoch)) await refreshAnchorRecipes(anchorEpoch);

await updateAppConfig({ r1_epoch: r1Epoch, r2_epoch: r2Epoch, r3_epoch: r3Epoch, r4_epoch: r4Epoch, anchor_epoch: anchorEpoch, ... });
```

---

### `curate-division-recipes` (called by `rotate-divisions`, also callable manually)

Given a division catalog entry, builds a recipe pool large enough to guarantee ≥ 8 recipes for every dietary profile.

**Multi-Pass Generation Strategy:**

**Pass 1 — Broad generation:**
Ask Gemini for up to 20 on-theme recipes, naturally diverse in style and dietary compatibility.

**Pass 2 — Gap analysis:**
For each dietary profile, count qualifying recipes. Identify any profile with < 8.

**Pass 3 — Targeted fill:**
For each under-covered profile, prompt Gemini:
> *"Generate [N] more [division theme] recipes that are strictly [vegan / gluten-free / etc.]. They must feel authentic to the division — e.g. if the division is Protein Throne, propose plant-based high-protein dishes like tempeh, lentils, edamame."*

Repeat passes 2–3 until all profiles reach 8.

**For each proposed recipe:**
1. Search `recipes` by name (`ilike`) for an existing match
2. If found: tag it with appropriate `dietary_tags`, add its ID to the pool
3. If not found: generate full recipe details + image via Gemini, insert into `recipes`, upload image to `recipe-images` bucket

**Gemini Recipe Generation Prompt (Pass 1):**
```
You are a culinary curator for a food tournament app called Plateoffs.

Division: "{name}" — {description}

Propose exactly 20 recipes that would compete in this bracket. The set must include:
- At least 8 that are vegan
- At least 8 that are gluten-free
- At least 8 that contain no pork
- At least 8 that are dairy-free
- At least 8 that are vegetarian
(Many recipes will satisfy multiple criteria simultaneously — optimize for overlap.)

Each recipe should be iconic or beloved within the theme, have strong visual appeal,
vary in technique/style, and be a real named dish.

Return JSON array:
[{
  "name": string,
  "description": string,
  "cook_time_minutes": number,
  "skill_level": "easy"|"medium"|"hard",
  "tags": string[],
  "meal_type_tags": string[],
  "dietary_tags": ("vegetarian"|"vegan"|"gluten_free"|"no_pork"|"dairy_free")[]
}]
```

**Gemini Image Generation Prompt:**
```
Professional food photography of {recipe_name}.
Top-down shot on a {surface} surface.
Natural window light. Garnished and plated for a restaurant menu.
Photorealistic, high resolution, appetizing.
```

**Recipe Insert Schema:**
```typescript
{
  name: string,
  description: string,
  total_time_minutes: number,
  skill_level: 'easy' | 'medium' | 'hard',
  tags: string[],
  meal_type_tags: string[],
  dietary_tags: string[],
  image_path: string,
  source: 'ai_generated',
  created_at: now()
}
```

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
- [ ] Create Edge Function scaffold with Gemini API integration
- [ ] Implement Pass 1 broad generation with dietary coverage targets
- [ ] Implement gap analysis per dietary profile
- [ ] Implement targeted fill passes until all profiles reach 8
- [ ] Implement recipe name matching → conditional insert flow
- [ ] Implement Gemini image generation + Supabase Storage upload
- [ ] Test manually against a single division

### Phase 4 — `rotate-divisions` Edge Function
- [ ] Implement per-slot epoch computation (R1/R2/R3 independent intervals)
- [ ] Compare current epochs to stored epochs in `app_config`
- [ ] Implement division deactivation / activation per slot
- [ ] Wire call to `curate-division-recipes` per new division
- [ ] Write updated epochs and `next_*_rotation_at` to `app_config`
- [ ] Schedule via Supabase Cron (run hourly, act only when epoch advances)

### Phase 5 — Seeding & Backfill
- [ ] Run `curate-division-recipes` against all 4 anchor divisions
- [ ] Dry-run `rotate-divisions` against current epoch to populate first rotating set
- [ ] Verify lobby displays correct 7 divisions with working countdown
- [ ] Verify dietary filtering returns correct 8 recipes per profile

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
