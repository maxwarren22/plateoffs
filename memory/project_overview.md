---
name: project-overview
description: Plateoffs app architecture — food bracket tournament, division rotation system, tech stack
metadata:
  type: project
---

Expo React Native app (SDK 54, expo-router, Zustand, Supabase). Food bracket tournament where users vote on recipes head-to-head in "divisions".

**Division system:**
- 4 anchor divisions (permanent): Protein Throne, Plant Power, 30-Minute Wars, Comfort Classics
- 4 rotating slots: R1 (Cuisine, 3d), R2 (Seasonal, 7d), R3 (Wild Card, 5d), R4 (Dessert, 4d)
- Rotation times stored in `app_config` table: `next_r1_rotation_at`, etc.
- Division slot stored in `division_catalog.slot`, joined via `catalog_id` FK

**Key files:**
- `app/lobby.tsx` — main lobby with division cards, diet filter, timers
- `lib/supabase.ts` — fetchActiveDivisions (joins division_catalog for slot), fetchAllRotationTimes
- `lib/tournament.ts` — Division interface (has `slot: string | null`)
- `lib/notifications.ts` — expo-notifications setup, scheduleRotationNotifications, 10 creative messages
- `styles/lobby.styles.ts` — shared lobby styles

**Why:** Deterministic epoch-based rotation so all devices agree without coordination.
