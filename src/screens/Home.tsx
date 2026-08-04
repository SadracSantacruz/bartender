import { useMemo } from "react";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore, type Screen } from "../store/appStore";

const MODES: Array<{ screen: Screen; label: string; desc: string }> = [
  { screen: "browse", label: "Browse", desc: "Search every drink, not a quiz" },
  { screen: "review", label: "Review", desc: "Flashcards for drinks you haven't nailed yet" },
  { screen: "mc", label: "Multiple Choice", desc: "4 options, one field at a time" },
  { screen: "fullbuild", label: "Full Build Recall", desc: "Fill in the whole build, self-graded" },
  { screen: "reverse", label: "Reverse Recall", desc: "See the build, name the drink" },
  { screen: "rapidfire", label: "Rapid Fire", desc: "60 seconds, one-line answers" },
  { screen: "ticket", label: "Ticket Mode", desc: "5-8 tickets, glass + base, timed" },
  { screen: "dashboard", label: "Dashboard", desc: "Mastery, weak spots, per-field stats" },
  { screen: "import", label: "Import Deck", desc: "Paste JSON, validate a new deck" },
];

export default function Home() {
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const toggleDeck = useAppStore((s) => s.toggleDeck);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const setTierFilter = useAppStore((s) => s.setTierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const setCategoryFilter = useAppStore((s) => s.setCategoryFilter);
  const navigate = useAppStore((s) => s.navigate);

  const selectedDecks = useMemo(
    () => LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck),
    [selectedDeckIds]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const deck of selectedDecks) {
      for (const drink of deck.drinks) set.add(drink.category);
    }
    return Array.from(set).sort();
  }, [selectedDecks]);

  const tiers = useMemo(() => {
    const set = new Set<number>();
    for (const deck of selectedDecks) {
      for (const drink of deck.drinks) set.add(drink.tier);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [selectedDecks]);

  const drinkCount = useMemo(() => {
    let count = 0;
    for (const deck of selectedDecks) {
      for (const drink of deck.drinks) {
        if (tierFilter !== "all" && drink.tier !== tierFilter) continue;
        if (categoryFilter !== "all" && drink.category !== categoryFilter) continue;
        count++;
      }
    }
    return count;
  }, [selectedDecks, tierFilter, categoryFilter]);

  const hasSelection = selectedDeckIds.length > 0 && drinkCount > 0;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100">
      <h1 className="mb-1 text-2xl font-semibold">Bar Drill</h1>
      <p className="mb-6 text-neutral-400">Pick your decks, then pick a mode.</p>

      {LOADED_DECKS.length === 0 ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-4 text-amber-200">
          No decks found in <code className="rounded bg-black/30 px-1">data/decks/</code>. Drop a{" "}
          <code className="rounded bg-black/30 px-1">.json</code> deck file there and restart the dev server.
        </div>
      ) : (
        <>
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Decks</h2>
            <div className="space-y-2">
              {LOADED_DECKS.map(({ deck }) => (
                <label
                  key={deck.id}
                  className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 active:bg-neutral-900"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-emerald-500"
                    checked={selectedDeckIds.includes(deck.id)}
                    onChange={() => toggleDeck(deck.id)}
                  />
                  <div>
                    <div className="font-medium">{deck.name}</div>
                    <div className="text-sm text-neutral-500">
                      {deck.description} · {deck.drinks.length} drinks
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {selectedDeckIds.length > 0 && (
            <section className="mb-6 flex flex-wrap gap-4">
              <div>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Tier</h2>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={tierFilter === "all"} onClick={() => setTierFilter("all")} label="All" />
                  {tiers.map((t) => (
                    <FilterChip
                      key={t}
                      active={tierFilter === t}
                      onClick={() => setTierFilter(t)}
                      label={`Tier ${t}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Category</h2>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    active={categoryFilter === "all"}
                    onClick={() => setCategoryFilter("all")}
                    label="All"
                  />
                  {categories.map((c) => (
                    <FilterChip
                      key={c}
                      active={categoryFilter === c}
                      onClick={() => setCategoryFilter(c)}
                      label={c}
                    />
                  ))}
                </div>
              </div>
              <p className="w-full text-sm text-neutral-500">{drinkCount} drinks match your filters.</p>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Modes</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODES.map((mode) => {
                const needsSelection = mode.screen !== "import" && mode.screen !== "dashboard";
                const disabled = needsSelection && !hasSelection;
                return (
                  <button
                    key={mode.screen}
                    type="button"
                    disabled={disabled}
                    onClick={() => navigate(mode.screen)}
                    className="min-h-[64px] rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-colors hover:border-emerald-700 hover:bg-neutral-900 active:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-800"
                  >
                    <div className="font-medium">{mode.label}</div>
                    <div className="text-sm text-neutral-500">{mode.desc}</div>
                  </button>
                );
              })}
            </div>
            {!hasSelection && (
              <p className="mt-3 text-sm text-neutral-500">
                Select at least one deck above to unlock the quiz modes.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-full border px-3 py-1 text-sm ${
        active
          ? "border-emerald-600 bg-emerald-900/40 text-emerald-300"
          : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}
