# Review Mode, Save Flag, and Browse Color — Design

Date: 2026-08-04. Approved by user.

## Goals

1. A new **Review Mode** that surfaces drinks the user has not memorized.
2. A way to manually **save** drinks that are "still learning".
3. More **color and findability** in the Browse tab.

## 1. Review Mode (`screen: "review"`)

Flashcard flip-through over the "needs review" pool.

**Pool** (from the currently selected decks + tier/category filters):
- **Saved**: manually flagged drinks (always included).
- **Never seen**: `stats.seen === 0`.
- **Shaky**: `leitnerBox <= 2` or accuracy `< 70%` (with `seen > 0`).

Each card shows a badge for the reason ("saved" / "never seen" / "shaky"; saved wins if both).

**Flow**: front shows drink name (+ tier/category/base). Tap **Reveal** → full build (glass, serve, rim, garnish, prep, ingredients, notes). Self-grade **Got it** / **Still shaky**, which calls `recordResult(deckId, drinkId, correct)` so it moves the Leitner box like any quiz. Reveal side also has the save/unsave toggle. Deck order is shuffled; a small `x / N` progress counter; end screen with a "go again" option showing how many are still weak.

## 2. Save flag

- `progressStore` gains `savedDrinks: Record<string, true>` (key `deckId:drinkId`), `toggleSaved(deckId, drinkId)`, `isSaved(...)` — persisted in the same zustand `persist` blob.
- Bookmark toggle button on Browse cards and Review reveal side.

## 3. Browse upgrades

- **Base-spirit accent color**: left border color + colored base badge per card. Color map keyed by normalized base keyword (tequila, mezcal, rum, vodka, whiskey/bourbon, gin, liqueur/other, non-alcoholic); fallback neutral. Lives in `src/lib/baseColors.ts`.
- **Colored chips** for tier and category on each card.
- **In-Browse filter chips**: base spirit row + category row (derived from the current pool) + a **Saved only** toggle. Local state to Browse, not global.
- Search input unchanged.

## Files

- `src/screens/Review.tsx` (new)
- `src/lib/reviewPool.ts` (new — pool building, pure & testable)
- `src/lib/baseColors.ts` (new — base → Tailwind classes)
- `src/store/progressStore.ts` (savedDrinks)
- `src/store/appStore.ts`, `src/App.tsx`, `src/screens/Home.tsx` (wire in "review" screen; Home mode card: "Review — flashcards for drinks you haven't nailed yet")
- `src/screens/Browse.tsx` (color, chips, saved toggle/filter)

## Out of scope

Test framework setup (project has none), changes to other quiz modes, deck data changes.
