import { useMemo } from "react";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore, type Screen } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { getFilteredDrinks } from "../lib/quiz";
import { buildReviewPool } from "../lib/reviewPool";
import { accuracyText, Badge, Button, Card, Chip, ProgressBar, SectionTitle } from "../components/ui";

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

  // Whole, stable store slices only — never a fresh literal out of a selector.
  const stats = useProgressStore((s) => s.stats);
  const savedDrinks = useProgressStore((s) => s.savedDrinks);
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);

  const hasProgress = Object.keys(stats).length > 0;

  /**
   * "How am I doing / what should I drill now" for the current selection.
   * Falls back to every loaded deck before the user has picked anything, so
   * the block still says something useful on a cold open.
   */
  const snapshot = useMemo(() => {
    const scoped = selectedDecks.length > 0;
    const pool = scoped
      ? getFilteredDrinks(selectedDecks, tierFilter, categoryFilter, skippedDrinks)
      : getFilteredDrinks(
          LOADED_DECKS.map((d) => d.deck),
          "all",
          "all",
          skippedDrinks
        );

    const { getStats, isSaved, getMasteryPercent } = useProgressStore.getState();
    const entries = buildReviewPool(pool, getStats, isSaved);

    let neverSeen = 0;
    let shaky = 0;
    for (const { reasons } of entries) {
      if (reasons.includes("never seen")) neverSeen++;
      if (reasons.includes("shaky")) shaky++;
    }

    return {
      scoped,
      poolSize: pool.length,
      mastery: getMasteryPercent(pool.map(({ deck, drink }) => ({ deckId: deck.id, drinkId: drink.id }))),
      toReview: entries.length,
      neverSeen,
      shaky,
    };
    // `stats`/`savedDrinks` aren't read directly here, but they drive the
    // getState() reads above, so they belong in the dependency list.
  }, [selectedDecks, tierFilter, categoryFilter, skippedDrinks, stats, savedDrinks]);

  return (
    <div className="min-h-screen text-ink-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-ink-100 sm:text-5xl">
            Bar Drill
          </h1>
          <p className="mt-2 text-ink-400">Pick your decks, then pick a mode.</p>
        </header>

        {LOADED_DECKS.length === 0 ? (
          <Card className="border-amber-800 bg-amber-950/30 p-5 text-amber-200">
            No decks found in <code className="rounded bg-black/40 px-1">data/decks/</code>. Drop a{" "}
            <code className="rounded bg-black/40 px-1">.json</code> deck file there and restart the dev
            server.
          </Card>
        ) : (
          <div className="space-y-8">
            {!hasProgress ? (
              <p className="rounded-2xl border border-ink-800 bg-ink-900/60 px-4 py-3 text-sm leading-relaxed text-ink-300">
                Pick a deck below and start with{" "}
                <span className="font-semibold text-brass-300">Review</span> or{" "}
                <span className="font-semibold text-brass-300">Multiple Choice</span>.
              </p>
            ) : (
              <Card glow accent="border-l-brass-500" className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-500">
                      {snapshot.scoped ? "Mastery · selected decks" : "Mastery · all decks"}
                    </div>
                    <div
                      className={`font-display text-5xl font-bold leading-none tabular-nums ${accuracyText(snapshot.mastery)}`}
                    >
                      {snapshot.mastery}
                      <span className="text-2xl font-semibold">%</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge className="border-purple-700/70 bg-purple-950/50 text-purple-300">
                      <span className="tabular-nums">{snapshot.neverSeen}</span> never drilled
                    </Badge>
                    <Badge className="border-amber-700/70 bg-amber-950/50 text-amber-300">
                      <span className="tabular-nums">{snapshot.shaky}</span> shaky
                    </Badge>
                  </div>
                </div>

                <ProgressBar pct={snapshot.mastery} className="mt-3.5" />

                {snapshot.toReview > 0 ? (
                  <>
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={!hasSelection}
                      onClick={() => navigate("review")}
                      className="mt-4 min-h-[52px] w-full text-base"
                    >
                      {hasSelection
                        ? `Keep drilling — ${snapshot.toReview} to review`
                        : "Pick a deck to keep drilling"}
                    </Button>
                    {hasSelection && (
                      <p className="mt-2 text-center text-xs text-ink-500">
                        Review targets exactly the unseen and shaky drinks.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-4 font-display text-base font-semibold text-emerald-400">
                      Everything&rsquo;s reviewed
                      {snapshot.poolSize > 0 && (
                        <span className="ml-1.5 font-sans text-sm font-normal text-ink-400">
                          all <span className="tabular-nums">{snapshot.poolSize}</span> drinks are solid
                        </span>
                      )}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Button
                        variant="secondary"
                        size="lg"
                        disabled={!hasSelection}
                        onClick={() => navigate("rapidfire")}
                        className="min-h-[52px]"
                      >
                        Rapid Fire
                      </Button>
                      <Button
                        variant="secondary"
                        size="lg"
                        disabled={!hasSelection}
                        onClick={() => navigate("ticket")}
                        className="min-h-[52px]"
                      >
                        Ticket Mode
                      </Button>
                    </div>
                    <p className="mt-2 text-center text-xs text-ink-500">
                      Push for speed instead.
                    </p>
                  </>
                )}
              </Card>
            )}

            <section>
              <SectionTitle
                right={
                  <span className="text-xs tabular-nums text-ink-400">
                    {selectedDeckIds.length} of {LOADED_DECKS.length} selected
                  </span>
                }
              >
                Decks
              </SectionTitle>
              <div className="space-y-2">
                {LOADED_DECKS.map(({ deck }) => {
                  const checked = selectedDeckIds.includes(deck.id);
                  return (
                    <label
                      key={deck.id}
                      className={`flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border p-4 shadow-sm shadow-black/30 transition-colors duration-100 ${
                        checked
                          ? "border-brass-600 bg-brass-500/10 ring-1 ring-brass-500/20"
                          : "border-ink-800 bg-ink-900/80 hover:border-ink-700 active:bg-ink-850"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 accent-brass-500"
                        checked={checked}
                        onChange={() => toggleDeck(deck.id)}
                      />
                      <div className="min-w-0">
                        <div
                          className={`font-display font-semibold ${checked ? "text-brass-300" : "text-ink-100"}`}
                        >
                          {deck.name}
                        </div>
                        <div className="mt-0.5 text-sm text-ink-400">
                          {deck.description}{" "}
                          <span className="tabular-nums text-ink-500">
                            · {deck.drinks.length} drinks
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {selectedDeckIds.length > 0 && (
              <section className="space-y-4">
                <div>
                  <SectionTitle>Tier</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    <Chip active={tierFilter === "all"} onClick={() => setTierFilter("all")} label="All" />
                    {tiers.map((t) => (
                      <Chip
                        key={t}
                        active={tierFilter === t}
                        onClick={() => setTierFilter(t)}
                        label={`Tier ${t}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <SectionTitle>Category</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    <Chip
                      active={categoryFilter === "all"}
                      onClick={() => setCategoryFilter("all")}
                      label="All"
                    />
                    {categories.map((c) => (
                      <Chip
                        key={c}
                        active={categoryFilter === c}
                        onClick={() => setCategoryFilter(c)}
                        label={c}
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm text-ink-400">
                  <span className="font-medium tabular-nums text-ink-200">{drinkCount}</span> drinks
                  match your filters.
                </p>
              </section>
            )}

            <section>
              <SectionTitle>Modes</SectionTitle>
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
                      className="flex min-h-[76px] flex-col justify-center rounded-2xl border border-ink-800 bg-ink-900/80 p-4 text-left shadow-lg shadow-black/30 outline-none transition-colors duration-100 hover:border-brass-600/70 hover:bg-ink-850 focus-visible:border-brass-500 active:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink-800 disabled:hover:bg-ink-900/80"
                    >
                      <div className="font-display text-base font-semibold tracking-tight text-ink-100">
                        {mode.label}
                      </div>
                      <div className="mt-0.5 text-sm leading-snug text-ink-400">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
              {!hasSelection && (
                <p className="mt-3 text-sm text-ink-400">
                  Select at least one deck above to unlock the quiz modes.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
