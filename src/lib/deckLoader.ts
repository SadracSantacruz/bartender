import type { Deck } from "../types";
import { validateDeck } from "./validateDeck";

// Eagerly loads every *.json file in data/decks/ at build/startup time.
// Dropping a new deck file in that folder and restarting the dev server
// is enough for it to show up here — no code changes required.
const deckModules = import.meta.glob("/data/decks/*.json", { eager: true });

export interface LoadedDeck {
  deck: Deck;
  filename: string;
}

function loadDecks(): LoadedDeck[] {
  const decks: LoadedDeck[] = [];

  for (const [path, mod] of Object.entries(deckModules)) {
    const filename = path.split("/").pop() ?? path;
    if (filename.startsWith("_")) continue; // skip _TEMPLATE.json and similar

    const raw = (mod as { default: unknown }).default;
    const result = validateDeck(raw);
    if (!result.valid || !result.deck) {
      console.error(`Skipping invalid deck file ${filename}:`, result.errors);
      continue;
    }
    decks.push({ deck: result.deck, filename });
  }

  return decks.sort((a, b) => a.deck.name.localeCompare(b.deck.name));
}

export const LOADED_DECKS: LoadedDeck[] = loadDecks();

export function getAllDrinksById(): Map<string, { deckId: string; drinkId: string }> {
  const map = new Map<string, { deckId: string; drinkId: string }>();
  for (const { deck } of LOADED_DECKS) {
    for (const drink of deck.drinks) {
      map.set(`${deck.id}:${drink.id}`, { deckId: deck.id, drinkId: drink.id });
    }
  }
  return map;
}
