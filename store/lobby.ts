import { create } from 'zustand';
import { Image } from 'react-native';
import { fetchActiveDivisions, fetchAllRotationTimes, fetchDivisionRecipes } from '@/lib/supabase';
import { getCachedRecipes, setCachedRecipes } from '@/lib/recipeCache';
import { type Division } from '@/lib/tournament';
import type { Recipe } from '@/types/recipe';

interface LobbyState {
  divisions: Division[];
  rotationTimes: Record<string, number>;
  // Keyed by divisionId — populated in background after divisions load.
  // Unfiltered full recipe set so handleSelectDivision can apply dietary filter client-side.
  prefetchedRecipes: Record<string, Recipe[]>;
  loading: boolean;
  error: string | null;
  prefetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Fetches recipes for all divisions in parallel using cache-first strategy,
// then kicks off Image.prefetch for every recipe image.
async function loadAllRecipes(divisions: Division[]): Promise<Record<string, Recipe[]>> {
  const results: Record<string, Recipe[]> = {};
  await Promise.allSettled(
    divisions
      .filter((d) => (d.recipe_ids?.length ?? 0) > 0 && !d.curation_pending)
      .map(async (div) => {
        // Check AsyncStorage cache first — keyed by divisionId + recipe fingerprint.
        let recipes = await getCachedRecipes(div.id, div.recipe_ids);
        if (!recipes) {
          // Cache miss: fetch unfiltered from DB and persist.
          recipes = await fetchDivisionRecipes(div, []);
          await setCachedRecipes(div.id, div.recipe_ids, recipes);
        }
        results[div.id] = recipes;
        // Warm the native image cache for all recipe images.
        recipes.forEach((r) => {
          if (r.image_url) Image.prefetch(r.image_url).catch(() => {});
        });
      })
  );
  return results;
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  divisions: [],
  rotationTimes: {},
  prefetchedRecipes: {},
  loading: false,
  error: null,

  prefetch: async () => {
    if (get().loading || get().divisions.length > 0) return;
    set({ loading: true, error: null });
    try {
      const [divisions, rotationTimes] = await Promise.all([
        fetchActiveDivisions(),
        fetchAllRotationTimes(),
      ]);
      // Prefetch cover images before state update so native cache is warm
      // by the time ImageBackground first renders.
      divisions.forEach((d) => {
        if (d.cover_image_url) Image.prefetch(d.cover_image_url).catch(() => {});
      });
      set({ divisions, rotationTimes, loading: false });
      // Background: fetch all recipe sets (cache-first) and warm image cache.
      // Does not block UI — prefetchedRecipes is updated when ready.
      loadAllRecipes(divisions)
        .then((prefetchedRecipes) => set({ prefetchedRecipes }))
        .catch(() => {});
    } catch (e: any) {
      set({ error: e.message ?? 'Failed to load divisions', loading: false });
    }
  },

  refresh: async () => {
    if (get().loading) return;
    try {
      const [divisions, rotationTimes] = await Promise.all([
        fetchActiveDivisions(),
        fetchAllRotationTimes(),
      ]);
      divisions.forEach((d) => {
        if (d.cover_image_url) Image.prefetch(d.cover_image_url).catch(() => {});
      });
      set({ divisions, rotationTimes });
      // Re-run cache-first recipe load — handles rotation (new fingerprint = fresh fetch).
      loadAllRecipes(divisions)
        .then((prefetchedRecipes) => set({ prefetchedRecipes }))
        .catch(() => {});
    } catch {
      // Swallow silently — stale data is fine, don't flash an error on re-focus.
    }
  },
}));
