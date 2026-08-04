export type Serve = "up" | "rocks" | "built" | "blended" | "shareable" | "other";

export interface Drink {
  id: string;
  name: string;
  tier: number;
  category: string;
  base: string;
  ingredients: string[];
  glass: string;
  serve: Serve;
  rim: string;
  garnish: string;
  prep: string;
  notes?: string;
  verify?: string;
}

export interface Deck {
  id: string;
  name: string;
  description: string;
  tierLabels: Record<string, string>;
  drinks: Drink[];
}

export const DRINK_FIELDS = [
  "base",
  "glass",
  "serve",
  "rim",
  "garnish",
  "ingredients",
  "prep",
] as const;

export type DrinkField = (typeof DRINK_FIELDS)[number];
