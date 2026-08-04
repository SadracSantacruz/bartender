import type { DeckDrink } from "./quiz";
import type { DrinkStats } from "../store/progressStore";

export type ReviewReason = "saved" | "never seen" | "shaky";

export interface ReviewEntry {
  deckDrink: DeckDrink;
  reasons: ReviewReason[];
}

const SHAKY_ACCURACY = 0.7;
const SHAKY_MAX_BOX = 2;

/**
 * Decide which drinks need review: manually saved ones always, plus anything
 * never seen, stuck in a low Leitner box, or with low accuracy.
 */
export function buildReviewPool(
  pool: DeckDrink[],
  getStats: (deckId: string, drinkId: string) => DrinkStats,
  isSaved: (deckId: string, drinkId: string) => boolean
): ReviewEntry[] {
  const entries: ReviewEntry[] = [];
  for (const deckDrink of pool) {
    const { deck, drink } = deckDrink;
    const stats = getStats(deck.id, drink.id);
    const reasons: ReviewReason[] = [];

    if (isSaved(deck.id, drink.id)) reasons.push("saved");
    if (stats.seen === 0) {
      reasons.push("never seen");
    } else if (stats.leitnerBox <= SHAKY_MAX_BOX || stats.correct / stats.seen < SHAKY_ACCURACY) {
      reasons.push("shaky");
    }

    if (reasons.length > 0) entries.push({ deckDrink, reasons });
  }
  return entries;
}
