import type { Deck, Drink, DrinkField } from "../types";

export interface DeckDrink {
  deck: Deck;
  drink: Drink;
}

/**
 * Flatten selected decks into (deck, drink) pairs, filtered by tier/category.
 * Pass `skipped` (from `useProgressStore`) to additionally drop drinks the
 * user flagged as "don't need to memorize" — omit it (e.g. in Browse) to keep
 * skipped drinks in the pool for management purposes.
 */
export function getFilteredDrinks(
  decks: Deck[],
  tierFilter: number | "all",
  categoryFilter: string | "all",
  skipped?: Record<string, true>
): DeckDrink[] {
  const result: DeckDrink[] = [];
  for (const deck of decks) {
    for (const drink of deck.drinks) {
      if (tierFilter !== "all" && drink.tier !== tierFilter) continue;
      if (categoryFilter !== "all" && drink.category !== categoryFilter) continue;
      if (skipped?.[`${deck.id}:${drink.id}`]) continue;
      result.push({ deck, drink });
    }
  }
  return result;
}

export function getFieldValue(drink: Drink, field: DrinkField): string {
  if (field === "ingredients") return drink.ingredients.join(", ");
  return drink[field];
}

export function isFieldDocumented(drink: Drink, field: DrinkField): boolean {
  if (field === "ingredients") return drink.ingredients.length > 0;
  const v = drink[field];
  return typeof v === "string" && v.trim().toLowerCase() !== "not documented";
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

/**
 * Build up to `count` wrong-answer options for a multiple choice question on
 * `field`, drawn from other drinks. Prefers drinks in the same category first
 * (harder, more realistic distractors), then backfills from the whole pool.
 * Never returns a distractor equal to the correct answer.
 */
export function pickDistractors(
  pool: DeckDrink[],
  correct: DeckDrink,
  field: DrinkField,
  count: number
): string[] {
  const correctValue = getFieldValue(correct.drink, field).trim().toLowerCase();
  const seen = new Set<string>([correctValue]);
  const distractors: string[] = [];

  const sameCategory = pool.filter(
    (p) => p.drink.id !== correct.drink.id && p.drink.category === correct.drink.category
  );
  const rest = pool.filter(
    (p) => p.drink.id !== correct.drink.id && p.drink.category !== correct.drink.category
  );

  for (const candidatePool of [shuffle(sameCategory), shuffle(rest)]) {
    for (const { drink } of candidatePool) {
      if (distractors.length >= count) break;
      if (!isFieldDocumented(drink, field)) continue;
      const value = getFieldValue(drink, field).trim();
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(value);
    }
    if (distractors.length >= count) break;
  }

  return distractors;
}

// --- Fuzzy matching for Reverse Recall (typed drink name vs. actual name) ---

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array(n + 1)
    .fill(0)
    .map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export type MatchResult = "exact" | "close" | "wrong";

export function fuzzyMatchName(guess: string, target: string): MatchResult {
  const g = normalize(guess);
  const t = normalize(target);
  if (!g) return "wrong";
  if (g === t) return "exact";
  const distance = levenshtein(g, t);
  const threshold = Math.max(1, Math.round(t.length * 0.2));
  if (distance <= threshold) return "close";
  return "wrong";
}

// --- Rapid Fire question generation: invert a field to "which drink(s) use X" ---

export interface InvertedQuestion {
  prompt: string;
  answerDrinkIds: string[]; // (deckId:drinkId) — 1 or 2 drinks that match
  field: DrinkField;
  value: string;
}

/**
 * For a field like `base` or `glass`, group drinks by their (normalized)
 * value and keep only groups of exactly 1 or 2 drinks — those make good
 * "which drink uses X" rapid fire questions. Groups of 3+ are too ambiguous.
 */
export function buildInvertedQuestions(
  pool: DeckDrink[],
  field: DrinkField,
  promptTemplate: (value: string, plural: boolean) => string
): InvertedQuestion[] {
  const groups = new Map<string, { value: string; ids: string[] }>();

  for (const { deck, drink } of pool) {
    if (!isFieldDocumented(drink, field)) continue;
    const raw = getFieldValue(drink, field);
    const key = normalize(raw);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { value: raw, ids: [] });
    groups.get(key)!.ids.push(`${deck.id}:${drink.id}`);
  }

  const questions: InvertedQuestion[] = [];
  for (const { value, ids } of groups.values()) {
    if (ids.length < 1 || ids.length > 2) continue;
    questions.push({
      prompt: promptTemplate(value, ids.length > 1),
      answerDrinkIds: ids,
      field,
      value,
    });
  }
  return questions;
}

export function drinkKey(deck: Deck, drink: Drink): string {
  return `${deck.id}:${drink.id}`;
}
