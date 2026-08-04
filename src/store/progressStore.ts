import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DrinkField } from "../types";

export interface DrinkKey {
  deckId: string;
  drinkId: string;
}

export interface FieldStat {
  seen: number;
  correct: number;
}

export interface DrinkStats {
  seen: number;
  correct: number;
  lastSeen: number;
  leitnerBox: number; // 1 (newest/weakest) to 5 (mastered)
  fields: Partial<Record<DrinkField, FieldStat>>;
}

function statKey(deckId: string, drinkId: string): string {
  return `${deckId}:${drinkId}`;
}

function emptyStats(): DrinkStats {
  return { seen: 0, correct: 0, lastSeen: 0, leitnerBox: 1, fields: {} };
}

// Leitner box review intervals, in ms. A drink in a higher box is considered
// "due" less often, so it surfaces less frequently once you know it well.
const BOX_INTERVAL_MS: Record<number, number> = {
  1: 0,
  2: 1000 * 60 * 10, // 10 min
  3: 1000 * 60 * 60 * 6, // 6 hours
  4: 1000 * 60 * 60 * 24 * 2, // 2 days
  5: 1000 * 60 * 60 * 24 * 7, // 7 days
};

interface ProgressState {
  stats: Record<string, DrinkStats>;

  /** Drinks manually flagged as "still learning", keyed `deckId:drinkId`. */
  savedDrinks: Record<string, true>;
  toggleSaved: (deckId: string, drinkId: string) => void;
  isSaved: (deckId: string, drinkId: string) => boolean;

  getStats: (deckId: string, drinkId: string) => DrinkStats;
  recordResult: (deckId: string, drinkId: string, correct: boolean, field?: DrinkField) => void;

  /** Weight for random-draw selection: higher = should be shown more often. */
  weightFor: (deckId: string, drinkId: string, tier: number) => number;

  getMasteryPercent: (keys: DrinkKey[]) => number;
  getWeakest: (keys: DrinkKey[], n: number) => Array<DrinkKey & { stats: DrinkStats; accuracy: number }>;
  getFieldBreakdown: (keys: DrinkKey[]) => Partial<Record<DrinkField, FieldStat>>;
  getDeckMastery: (deckId: string, drinkIds: string[]) => number;

  resetProgress: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      stats: {},

      savedDrinks: {},

      toggleSaved: (deckId, drinkId) => {
        set((s) => {
          const key = statKey(deckId, drinkId);
          const savedDrinks = { ...s.savedDrinks };
          if (savedDrinks[key]) {
            delete savedDrinks[key];
          } else {
            savedDrinks[key] = true;
          }
          return { savedDrinks };
        });
      },

      isSaved: (deckId, drinkId) => {
        return !!get().savedDrinks[statKey(deckId, drinkId)];
      },

      getStats: (deckId, drinkId) => {
        return get().stats[statKey(deckId, drinkId)] ?? emptyStats();
      },

      recordResult: (deckId, drinkId, correct, field) => {
        set((s) => {
          const key = statKey(deckId, drinkId);
          const prev = s.stats[key] ?? emptyStats();
          const nextBox = correct ? Math.min(5, prev.leitnerBox + 1) : 1;
          const fields = { ...prev.fields };
          if (field) {
            const prevField = fields[field] ?? { seen: 0, correct: 0 };
            fields[field] = {
              seen: prevField.seen + 1,
              correct: prevField.correct + (correct ? 1 : 0),
            };
          }
          return {
            stats: {
              ...s.stats,
              [key]: {
                seen: prev.seen + 1,
                correct: prev.correct + (correct ? 1 : 0),
                lastSeen: Date.now(),
                leitnerBox: nextBox,
                fields,
              },
            },
          };
        });
      },

      weightFor: (deckId, drinkId, tier) => {
        const stats = get().getStats(deckId, drinkId);
        const interval = BOX_INTERVAL_MS[stats.leitnerBox] ?? 0;
        const dueSince = stats.seen === 0 ? Infinity : Date.now() - (stats.lastSeen + interval);
        // Never-seen or overdue drinks get a strong boost; box position also matters.
        const overdueBoost = dueSince > 0 ? 3 : 1;
        const boxWeight = 6 - stats.leitnerBox; // box 1 = weight 5, box 5 = weight 1
        const tierWeight = tier === 1 ? 3 : tier === 2 ? 2 : 1;
        return overdueBoost * boxWeight * tierWeight;
      },

      getMasteryPercent: (keys) => {
        if (keys.length === 0) return 0;
        const { stats } = get();
        let totalSeen = 0;
        let totalCorrect = 0;
        for (const k of keys) {
          const s = stats[statKey(k.deckId, k.drinkId)];
          if (!s) continue;
          totalSeen += s.seen;
          totalCorrect += s.correct;
        }
        if (totalSeen === 0) return 0;
        return Math.round((totalCorrect / totalSeen) * 100);
      },

      getDeckMastery: (deckId, drinkIds) => {
        return get().getMasteryPercent(drinkIds.map((drinkId) => ({ deckId, drinkId })));
      },

      getWeakest: (keys, n) => {
        const { stats } = get();
        const withStats = keys.map((k) => {
          const s = stats[statKey(k.deckId, k.drinkId)] ?? emptyStats();
          const accuracy = s.seen === 0 ? -1 : s.correct / s.seen; // unseen drinks sort first (most urgent)
          return { ...k, stats: s, accuracy };
        });
        withStats.sort((a, b) => a.accuracy - b.accuracy || b.stats.seen - a.stats.seen);
        return withStats.slice(0, n);
      },

      getFieldBreakdown: (keys) => {
        const { stats } = get();
        const breakdown: Partial<Record<DrinkField, FieldStat>> = {};
        for (const k of keys) {
          const s = stats[statKey(k.deckId, k.drinkId)];
          if (!s) continue;
          for (const [field, fieldStat] of Object.entries(s.fields)) {
            const f = field as DrinkField;
            const prev = breakdown[f] ?? { seen: 0, correct: 0 };
            breakdown[f] = {
              seen: prev.seen + fieldStat.seen,
              correct: prev.correct + fieldStat.correct,
            };
          }
        }
        return breakdown;
      },

      resetProgress: () => set({ stats: {} }),
    }),
    { name: "bar-drill-progress" }
  )
);
