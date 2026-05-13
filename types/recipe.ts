export interface Recipe {
  id: string;
  title: string;
  image_url: string | null;
  description: string | null;
  cook_time_minutes: number | null;
  difficulty: string | null;
  tags: string[];
  ingredients?: any[] | null;
  instructions?: any[] | null;
}

export interface Matchup {
  round: number;
  totalRounds: number;
  recipeA: Recipe;
  recipeB: Recipe;
}
