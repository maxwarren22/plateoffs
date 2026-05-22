import { createClient } from '@supabase/supabase-js';
import type { Recipe } from '@/types/recipe';
import type { Division } from '@/lib/tournament';
import { BRACKET_SIZE } from '@/lib/tournament';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const RECIPE_SELECT = [
  'id',
  'name',
  'image_path',
  'total_time_minutes',
  'skill_level',
  'tags',
  'meal_type_tags',
  'dietary_tags',
  'calories',
].join(', ');

function imagePathToUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl;
}

function dbRowToRecipe(row: any, full = false): Recipe {
  return {
    id: row.id,
    title: row.name,
    image_url: imagePathToUrl(row.image_path),
    description: null,
    cook_time_minutes: row.total_time_minutes ?? null,
    difficulty: row.skill_level ?? null,
    tags: row.tags ?? [],
    ...(full && {
      ingredients: Array.isArray(row.ingredients) ? row.ingredients : null,
      instructions: Array.isArray(row.instructions)
        ? row.instructions
        : typeof row.instructions === 'string'
        ? row.instructions.split('\n').filter(Boolean)
        : null,
    }),
  };
}

export async function fetchActiveDivisions(): Promise<Division[]> {
  const { data, error } = await supabase
    .from('plateoffs_divisions')
    .select('*, division_catalog!catalog_id(slot)')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const { division_catalog, ...rest } = row;
    return { ...rest, slot: division_catalog?.slot ?? null } as Division;
  });
}

export async function fetchDivisionRecipes(
  division: Division,
  dietaryProfile: string[] = []
): Promise<Recipe[]> {
  if (!division.recipe_ids || division.recipe_ids.length === 0) {
    throw new Error(`Division "${division.name}" has no recipes curated yet`);
  }

  let query = supabase
    .from('recipes')
    .select(RECIPE_SELECT)
    .in('id', division.recipe_ids);

  if (dietaryProfile.length > 0) {
    query = query.contains('dietary_tags', dietaryProfile);
  }

  const { data, error } = await query;

  if (error) throw error;

  if (!data || data.length < BRACKET_SIZE) {
    if (dietaryProfile.length > 0) {
      // Fall back to unfiltered pool — curation gap, logged for re-curation
      const { data: fallback, error: fbError } = await supabase
        .from('recipes')
        .select(RECIPE_SELECT)
        .in('id', division.recipe_ids);
      if (fbError) throw fbError;
      if (!fallback || fallback.length < BRACKET_SIZE) {
        throw new Error(`Not enough recipes for "${division.name}"`);
      }
      return fallback.slice(0, BRACKET_SIZE).map(dbRowToRecipe);
    }
    throw new Error(`Only found ${data?.length ?? 0} of ${BRACKET_SIZE} recipes for "${division.name}"`);
  }

  return data.slice(0, BRACKET_SIZE).map(dbRowToRecipe);
}

export async function fetchRecipeImageUrls(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await supabase
    .from('recipes')
    .select('image_path')
    .in('id', ids);
  return (data ?? [])
    .map((r: any) => imagePathToUrl(r.image_path))
    .filter((url): url is string => !!url);
}

export async function fetchNextRotationAt(): Promise<number> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['next_r1_rotation_at', 'next_r2_rotation_at', 'next_r3_rotation_at', 'next_r4_rotation_at']);

  if (error || !data?.length) {
    return Date.now() + 3 * 86_400_000;
  }

  const times = data.map((r) => new Date(r.value).getTime()).filter((t) => !isNaN(t));
  return times.length ? Math.min(...times) : Date.now() + 3 * 86_400_000;
}

// Returns { R1: ms, R2: ms, R3: ms, R4: ms, ANCHOR: ms } — used for per-division countdown timers
export async function fetchAllRotationTimes(): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['next_r1_rotation_at', 'next_r2_rotation_at', 'next_r3_rotation_at', 'next_r4_rotation_at', 'next_anchor_rotation_at']);

  const result: Record<string, number> = {};
  for (const row of data ?? []) {
    // 'next_r1_rotation_at' → 'R1', 'next_anchor_rotation_at' → 'ANCHOR'
    const slot = row.key.replace('next_', '').replace('_rotation_at', '').toUpperCase();
    const ms = new Date(row.value).getTime();
    if (!isNaN(ms)) result[slot] = ms;
  }
  return result;
}

export async function fetchRecipeById(id: string): Promise<Recipe | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select(`${RECIPE_SELECT}, instructions, ingredients`)
    .eq('id', id)
    .single();

  if (error) return null;
  return dbRowToRecipe(data, true);
}
