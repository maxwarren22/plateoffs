import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { fetchActiveDivisions, fetchAllRotationTimes, fetchDivisionRecipes } from '@/lib/supabase';
import { getCachedRecipes, setCachedRecipes } from '@/lib/recipeCache';
import { getCachedCoverImageUri, pruneOldCoverImages } from '@/lib/coverImageCache';
import { type Division } from '@/lib/tournament';
import type { Recipe } from '@/types/recipe';

interface LobbyState {
  divisions: Division[];
  rotationTimes: Record<string, number>;
  // Keyed by divisionId — local file:// URI (or remote URL as fallback).
  // Populated before loading: false so cards render with cached images immediately.
  coverImageUris: Record<string, string>;
  // Keyed by divisionId — populated in background after divisions load.
  // Unfiltered full recipe set so handleSelectDivision can apply dietary filter client-side.
  prefetchedRecipes: Record<string, Recipe[]>;
  loading: boolean;
  error: string | null;
  prefetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

// Tracks whether AsyncStorage rehydration has completed. Not stored in Zustand
// state so it never triggers re-renders and never gets persisted.
let _hydrated = false;

// Fetches recipes for all divisions in parallel using cache-first strategy,
// then kicks off Image.prefetch for every recipe image.
async function loadAllRecipes(divisions: Division[]): Promise<Record<string, Recipe[]>> {
  const results: Record<string, Recipe[]> = {};
  await Promise.allSettled(
    divisions
      .filter((d) => (d.recipe_ids?.length ?? 0) > 0 && !d.curation_pending)
      .map(async (div) => {
        let recipes = await getCachedRecipes(div.id, div.recipe_ids);
        if (!recipes) {
          recipes = await fetchDivisionRecipes(div, []);
          await setCachedRecipes(div.id, div.recipe_ids, recipes);
        }
        results[div.id] = recipes;
        recipes.forEach((r) => {
          if (r.image_url) Image.prefetch(r.image_url).catch(() => {});
        });
      })
  );
  return results;
}

// Resolves cover image URIs for all divisions in parallel.
// Cache hit  → instant file:// read, no network.
// Cache miss → awaits Image.prefetch so the native HTTP cache is warm before cards
//              render, AND kicks off a file system download for subsequent launches.
async function resolveCoverImageUris(divisions: Division[]): Promise<Record<string, string>> {
  const uris: Record<string, string> = {};
  await Promise.allSettled(
    divisions
      .filter((d) => d.cover_image_url)
      .map(async (d) => {
        const uri = await getCachedCoverImageUri(d.cover_image_url!);
        uris[d.id] = uri;
        // Only prefetch on cache miss (remote URL returned). Local file:// URIs
        // read straight from disk — no native cache step needed.
        if (uri === d.cover_image_url) {
          await Image.prefetch(uri).catch(() => {});
        }
      })
  );
  return uris;
}

export const useLobbyStore = create<LobbyState>()(
  persist(
    (set, get) => ({
      divisions: [],
      rotationTimes: {},
      coverImageUris: {},
      prefetchedRecipes: {},
      loading: false,
      error: null,

      prefetch: async () => {
        if (get().loading) return;
        // If hydration hasn't completed, bail — onFinishHydration will call us once ready.
        if (!_hydrated) return;
        // Cached data already available (rehydrated from AsyncStorage this launch).
        if (get().divisions.length > 0) return;

        // First install or cleared storage: show skeleton cards.
        set({ loading: true, error: null });
        try {
          const [divisions, rotationTimes] = await Promise.all([
            fetchActiveDivisions(),
            fetchAllRotationTimes(),
          ]);
          const coverImageUris = await resolveCoverImageUris(divisions);
          set({ divisions, rotationTimes, coverImageUris, loading: false });
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
          const coverImageUris = await resolveCoverImageUris(divisions);
          set({ divisions, rotationTimes, coverImageUris });
          const activeUrls = divisions.flatMap((d) => d.cover_image_url ? [d.cover_image_url] : []);
          pruneOldCoverImages(activeUrls).catch(() => {});
          loadAllRecipes(divisions)
            .then((prefetchedRecipes) => set({ prefetchedRecipes }))
            .catch(() => {});
        } catch {
          // Swallow silently — stale data is fine on re-focus.
        }
      },
    }),
    {
      name: 'plateoffs-lobby-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the data needed for instant lobby render. Exclude runtime flags,
      // loading state, and prefetchedRecipes (handled by its own cache layer).
      partialize: (state) => ({
        divisions: state.divisions,
        rotationTimes: state.rotationTimes,
        coverImageUris: state.coverImageUris,
      }),
    }
  )
);

// Once AsyncStorage has finished rehydrating the store:
// - If we have cached divisions: show them immediately and refresh silently in background.
// - If not (first install): trigger prefetch so the skeleton appears.
useLobbyStore.persist.onFinishHydration((state) => {
  _hydrated = true;
  if (state.divisions.length > 0) {
    useLobbyStore.getState().refresh();
  } else {
    useLobbyStore.getState().prefetch();
  }
});
