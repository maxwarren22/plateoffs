import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_SAVED_RECIPES = 6;

export interface SavedRecipe {
  id: string;
  title: string;
  image_url: string | null;
  description: string | null;
  cook_time_minutes: number | null;
  difficulty: string | null;
  savedAt: number;
}

interface SavedRecipesState {
  recipes: SavedRecipe[];
  saveRecipe: (recipe: SavedRecipe) => 'saved' | 'full' | 'duplicate';
  removeRecipe: (id: string) => void;
  replaceRecipe: (removeId: string, newRecipe: SavedRecipe) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedRecipesStore = create<SavedRecipesState>()(
  persist(
    (set, get) => ({
      recipes: [],

      saveRecipe: (recipe) => {
        const { recipes } = get();
        if (recipes.some((r) => r.id === recipe.id)) return 'duplicate';
        if (recipes.length >= MAX_SAVED_RECIPES) return 'full';
        set({ recipes: [...recipes, { ...recipe, savedAt: Date.now() }] });
        return 'saved';
      },

      removeRecipe: (id) => {
        set({ recipes: get().recipes.filter((r) => r.id !== id) });
      },

      replaceRecipe: (removeId, newRecipe) => {
        const next = get().recipes.map((r) =>
          r.id === removeId ? { ...newRecipe, savedAt: Date.now() } : r
        );
        set({ recipes: next });
      },

      isSaved: (id) => get().recipes.some((r) => r.id === id),
    }),
    {
      name: 'plateoffs-saved-recipes',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
