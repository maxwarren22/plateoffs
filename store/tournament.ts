import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recipe } from '@/types/recipe';
import type { Division } from '@/lib/tournament';

interface TournamentState {
  division: Division | null;
  leftRecipe: Recipe | null;
  rightRecipe: Recipe | null;
  remainingRecipes: Recipe[];
  matchupCount: number;
  totalMatchups: number;
  champion: Recipe | null;

  setDivision: (division: Division) => void;
  startGauntlet: (recipes: Recipe[]) => void;
  selectWinner: (winner: Recipe, winnerSide: 'left' | 'right') => void;
  reset: () => void;
}

const initialState = {
  division: null,
  leftRecipe: null,
  rightRecipe: null,
  remainingRecipes: [],
  matchupCount: 0,
  totalMatchups: 0,
  champion: null,
};

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDivision: (division) => set({ division }),

      startGauntlet: (recipes) => {
        const shuffled = [...recipes].sort(() => Math.random() - 0.5);
        set({
          leftRecipe: shuffled[0],
          rightRecipe: shuffled[1],
          remainingRecipes: shuffled.slice(2),
          matchupCount: 0,
          totalMatchups: recipes.length - 1,
          champion: null,
        });
      },

      selectWinner: (winner, winnerSide) => {
        const { remainingRecipes, matchupCount } = get();
        if (remainingRecipes.length === 0) {
          set({ champion: winner });
          return;
        }
        const [next, ...rest] = remainingRecipes;
        if (winnerSide === 'left') {
          set({ leftRecipe: winner, rightRecipe: next, remainingRecipes: rest, matchupCount: matchupCount + 1 });
        } else {
          set({ leftRecipe: next, rightRecipe: winner, remainingRecipes: rest, matchupCount: matchupCount + 1 });
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'plateoffs-tournament',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
