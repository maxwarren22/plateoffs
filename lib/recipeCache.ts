import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recipe } from '@/types/recipe';

const CACHE_PREFIX = 'plateoffs-recipe-cache:';
// 7-day TTL — a safety net; fingerprint-based invalidation handles rotation.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Stable fingerprint based on the set of recipe IDs.
// Sort so reordering the array doesn't cause a spurious cache miss.
export function recipeFingerprint(recipeIds: string[]): string {
  return [...recipeIds].sort().join(',');
}

interface CacheEntry {
  fp: string;
  recipes: Recipe[];
  cachedAt: number;
}

export async function getCachedRecipes(
  divisionId: string,
  recipeIds: string[]
): Promise<Recipe[] | null> {
  const fp = recipeFingerprint(recipeIds);
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + divisionId);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.fp !== fp) return null; // Division rotated — new recipe set
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
    return entry.recipes;
  } catch {
    return null;
  }
}

export async function setCachedRecipes(
  divisionId: string,
  recipeIds: string[],
  recipes: Recipe[]
): Promise<void> {
  const fp = recipeFingerprint(recipeIds);
  try {
    const entry: CacheEntry = { fp, recipes, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + divisionId, JSON.stringify(entry));
  } catch {}
}
