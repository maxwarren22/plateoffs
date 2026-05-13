import type { Recipe } from '@/types/recipe';

export const BRACKET_SIZE = 8;
export const TOTAL_ROUNDS = Math.log2(BRACKET_SIZE); // 3

export interface Division {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  recipe_ids: string[];
  is_active: boolean;
  active_from: string | null;
  active_until: string | null;
  display_order: number;
  cover_recipe_id: string | null;
  cover_image_url: string | null;
  catalog_id: string | null;
  division_type: 'anchor' | 'rotating';
  slot: string | null;
}

export function buildBracket(recipes: Recipe[]): Recipe[][] {
  if (recipes.length !== BRACKET_SIZE) {
    throw new Error(`Tournament requires exactly ${BRACKET_SIZE} recipes`);
  }
  const shuffled = [...recipes].sort(() => Math.random() - 0.5);
  const pairs: Recipe[][] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }
  return pairs;
}

export function advanceBracket(winners: Recipe[]): Recipe[][] {
  const pairs: Recipe[][] = [];
  for (let i = 0; i < winners.length; i += 2) {
    pairs.push([winners[i], winners[i + 1]]);
  }
  return pairs;
}

export function roundLabel(round: number): string {
  switch (round) {
    case 1: return 'Round of 8';
    case 2: return 'Semi-Finals';
    case 3: return 'Final';
    default: return `Round ${round}`;
  }
}
