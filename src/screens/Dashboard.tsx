import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { DRINK_FIELDS, type DrinkField } from "../types";
import { useProgressStore } from "../store/progressStore";

function accuracyColor(pct: number): string {
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 50) return "text-amber-400";
  return "text-red-400";
}

function barColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function Dashboard() {
  const getMasteryPercent = useProgressStore((s) => s.getMasteryPercent);
  const getDeckMastery = useProgressStore((s) => s.getDeckMastery);
  const getWeakest = useProgressStore((s) => s.getWeakest);
  const getFieldBreakdown = useProgressStore((s) => s.getFieldBreakdown);
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const stats = useProgressStore((s) => s.stats);

  const [confirmingReset, setConfirmingReset] = useState(false);

  const allKeys = useMemo(
    () =>
      LOADED_DECKS.flatMap(({ deck }) =>
        deck.drinks.map((drink) => ({ deckId: deck.id, drinkId: drink.id }))
      ),
    []
  );

  const hasAnyProgress = useMemo(() => Object.keys(stats).length > 0, [stats]);

  const overallMastery = getMasteryPercent(allKeys);
  const weakest = getWeakest(allKeys, 10);
  const fieldBreakdown = getFieldBreakdown(allKeys);

  const fieldEntries = useMemo(() => {
    return DRINK_FIELDS.filter((f) => (fieldBreakdown[f]?.seen ?? 0) > 0)
      .map((f) => {
        const stat = fieldBreakdown[f]!;
        const pct = stat.seen === 0 ? 0 : Math.round((stat.correct / stat.seen) * 100);
        return { field: f as DrinkField, ...stat, pct };
      })
      .sort((a, b) => a.pct - b.pct);
  }, [fieldBreakdown]);

  const drinkLookup = useMemo(() => {
    const map = new Map<string, { drinkName: string; deckName: string }>();
    for (const { deck } of LOADED_DECKS) {
      for (const drink of deck.drinks) {
        map.set(`${deck.id}:${drink.id}`, { drinkName: drink.name, deckName: deck.name });
      }
    }
    return map;
  }, []);

  function handleReset() {
    resetProgress();
    setConfirmingReset(false);
  }

  return (
    <Layout title="Dashboard">
      {LOADED_DECKS.length === 0 || !hasAnyProgress ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center text-neutral-400">
          No progress yet -- play a round in any mode to start tracking mastery.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Overall Mastery
            </h2>
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6">
              <div className={`text-5xl font-semibold ${accuracyColor(overallMastery)}`}>
                {overallMastery}%
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all ${barColor(overallMastery)}`}
                  style={{ width: `${overallMastery}%` }}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Per-Deck Mastery
            </h2>
            <div className="space-y-2">
              {LOADED_DECKS.map(({ deck }) => {
                const pct = getDeckMastery(
                  deck.id,
                  deck.drinks.map((d) => d.id)
                );
                return (
                  <div key={deck.id} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium">{deck.name}</span>
                      <span className={`text-sm font-medium ${accuracyColor(pct)}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Weakest Drinks
            </h2>
            <div className="space-y-2">
              {weakest.map((entry) => {
                const info = drinkLookup.get(`${entry.deckId}:${entry.drinkId}`);
                const notYetDrilled = entry.stats.seen === 0;
                const pct = notYetDrilled ? null : Math.round(entry.accuracy * 100);
                return (
                  <div
                    key={`${entry.deckId}:${entry.drinkId}`}
                    className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3"
                  >
                    <div>
                      <div className="font-medium">{info?.drinkName ?? entry.drinkId}</div>
                      <div className="text-sm text-neutral-500">{info?.deckName ?? entry.deckId}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
                        Box {entry.stats.leitnerBox}
                      </span>
                      {notYetDrilled ? (
                        <span className="text-sm text-neutral-500">not yet drilled</span>
                      ) : (
                        <span className={`text-sm font-medium ${accuracyColor(pct!)}`}>{pct}%</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {fieldEntries.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
                Per-Field Breakdown
              </h2>
              <div className="space-y-2">
                {fieldEntries.map((entry) => (
                  <div key={entry.field} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium capitalize">{entry.field}</span>
                      <span className={`text-sm font-medium ${accuracyColor(entry.pct)}`}>
                        {entry.pct}% ({entry.correct}/{entry.seen})
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(entry.pct)}`}
                        style={{ width: `${entry.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Danger Zone
            </h2>
            {!confirmingReset ? (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="min-h-[44px] rounded-lg border border-red-800 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/40 active:bg-red-950/60"
              >
                Reset Progress
              </button>
            ) : (
              <div className="rounded-lg border border-red-800 bg-red-950/30 p-4">
                <p className="mb-3 text-sm text-red-200">
                  Are you sure? This cannot be undone. All mastery data will be permanently wiped.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 active:bg-red-800"
                  >
                    Yes, reset everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingReset(false)}
                    className="min-h-[44px] rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900 active:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
}