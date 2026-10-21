import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { CONFIDENCE_LEVELS, useProgressStore, type Confidence } from "../store/progressStore";
import { getFilteredDrinks, getFieldValue, isFieldDocumented, shuffle, type DeckDrink } from "../lib/quiz";
import { buildReviewPool, type ReviewReason } from "../lib/reviewPool";
import { CONFIDENCE_ACTIVE, CONFIDENCE_LABELS } from "../lib/confidence";
import { baseColorFor } from "../lib/baseColors";
import { DRINK_FIELDS, type DrinkField } from "../types";
import { Badge, Button, Card, EmptyState, ProgressBar, SectionTitle } from "../components/ui";

const CARD_FIELDS: Array<{ field: DrinkField; label: string }> = [
  { field: "base", label: "Base" },
  { field: "glass", label: "Glass" },
  { field: "serve", label: "Serve" },
  { field: "rim", label: "Rim" },
  { field: "garnish", label: "Garnish" },
  { field: "prep", label: "Prep" },
];

const FIELD_LABELS: Record<DrinkField, string> = {
  base: "Base",
  glass: "Glass",
  serve: "Serve",
  rim: "Rim",
  garnish: "Garnish",
  ingredients: "Ingredients",
  prep: "Prep",
};

// Module-level constant so the default never creates a new array reference.
const EMPTY_FIELDS: DrinkField[] = [];

const REASON_STYLES: Record<ReviewReason, string> = {
  saved: "border-sky-700/70 bg-sky-950/50 text-sky-300",
  "never seen": "border-purple-700/70 bg-purple-950/50 text-purple-300",
  shaky: "border-amber-700/70 bg-amber-950/50 text-amber-300",
};

interface RoundCard {
  deckDrink: DeckDrink;
  badges: Array<{ label: string; className: string }>;
}

/**
 * `review`: the auto-built pool (saved, never seen, shaky by stats).
 * `rated`: only drinks the user rated "Don't got it" / "Kind of got it" in
 * Browse. Grading there re-rates the drink, so "Got it" drops it out.
 */
type ReviewSource = "review" | "rated";

export default function Review({ source = "review" }: { source?: ReviewSource }) {
  const rated = source === "rated";
  const title = rated ? "Don't Got It" : "Review";
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const navigate = useAppStore((s) => s.navigate);
  const recordResult = useProgressStore((s) => s.recordResult);
  const toggleSaved = useProgressStore((s) => s.toggleSaved);
  const savedDrinks = useProgressStore((s) => s.savedDrinks);
  const toggleSkipped = useProgressStore((s) => s.toggleSkipped);
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);
  const setPersonalNote = useProgressStore((s) => s.setPersonalNote);
  const toggleShakyField = useProgressStore((s) => s.toggleShakyField);
  const personalNotes = useProgressStore((s) => s.personalNotes);
  const shakyFieldsMap = useProgressStore((s) => s.shakyFields);
  const setConfidence = useProgressStore((s) => s.setConfidence);

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter, skippedDrinks);
  }, [selectedDeckIds, tierFilter, categoryFilter, skippedDrinks]);

  // Snapshot the review deck once per round so grading a card doesn't reshuffle
  // or remove cards out from under you mid-round.
  const [round, setRound] = useState<RoundCard[]>(() => buildRound());
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [gotIt, setGotIt] = useState(0);
  const [stillShaky, setStillShaky] = useState(0);
  const [finished, setFinished] = useState(false);

  const currentDeckDrink = round[index]?.deckDrink;
  const currentKey = currentDeckDrink ? `${currentDeckDrink.deck.id}:${currentDeckDrink.drink.id}` : "";
  const storedNote = personalNotes[currentKey] ?? "";
  const [noteDraft, setNoteDraft] = useState(storedNote);
  useEffect(() => {
    setNoteDraft(storedNote);
  }, [storedNote]);

  function commitNote() {
    if (currentDeckDrink && noteDraft !== storedNote) {
      setPersonalNote(currentDeckDrink.deck.id, currentDeckDrink.drink.id, noteDraft);
    }
  }

  function buildRound(): RoundCard[] {
    if (rated) {
      // "Don't got it" first, then "Kind of", each shuffled.
      const { confidence } = useProgressStore.getState();
      const byLevel: Record<"nope" | "kinda", RoundCard[]> = { nope: [], kinda: [] };
      for (const deckDrink of pool) {
        const level = confidence[`${deckDrink.deck.id}:${deckDrink.drink.id}`];
        if (level !== "nope" && level !== "kinda") continue;
        byLevel[level].push({
          deckDrink,
          badges: [{ label: CONFIDENCE_LABELS[level], className: CONFIDENCE_ACTIVE[level] }],
        });
      }
      return [...shuffle(byLevel.nope), ...shuffle(byLevel.kinda)];
    }
    const { getStats, isSaved } = useProgressStore.getState();
    return shuffle(buildReviewPool(pool, getStats, isSaved)).map(({ deckDrink, reasons }) => ({
      deckDrink,
      badges: reasons.map((r) => ({ label: r, className: REASON_STYLES[r] })),
    }));
  }

  function startOver() {
    setRound(buildRound());
    setIndex(0);
    setRevealed(false);
    setGotIt(0);
    setStillShaky(0);
    setFinished(false);
  }

  function grade(correct: boolean) {
    const { deck, drink } = round[index].deckDrink;
    recordResult(deck.id, drink.id, correct);
    if (correct) setGotIt((n) => n + 1);
    else setStillShaky((n) => n + 1);

    if (index + 1 >= round.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setRevealed(false);
  }

  function rate(level: Confidence) {
    const { deck, drink } = round[index].deckDrink;
    setConfidence(deck.id, drink.id, level);
    grade(level === "got");
  }


  if (pool.length === 0) {
    return (
      <Layout title={title}>
        <EmptyState title="No drinks in this pool">
          No drinks match your current selection. Go back{" "}
          <button className="font-medium text-brass-400 underline" onClick={() => navigate("home")}>
            Home
          </button>{" "}
          and pick a deck.
        </EmptyState>
      </Layout>
    );
  }

  if (round.length === 0 && rated) {
    return (
      <Layout title={title}>
        <Card accent="border-l-emerald-500" glow className="p-8 text-center">
          <p className="font-display text-2xl font-semibold text-emerald-300">
            Nothing rated Don&rsquo;t got it or Kind of
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
            Rate drinks in Browse with the &ldquo;Do I know it?&rdquo; buttons. The ones you
            don&rsquo;t know yet land here.
          </p>
          <Button variant="secondary" size="lg" className="mt-5" onClick={() => navigate("browse")}>
            Go to Browse
          </Button>
        </Card>
      </Layout>
    );
  }

  if (round.length === 0) {
    return (
      <Layout title={title}>
        <Card accent="border-l-emerald-500" glow className="p-8 text-center">
          <p className="font-display text-2xl font-semibold text-emerald-300">
            Nothing needs review &#127881;
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
            Every drink in your selection is either mastered or not flagged. Save drinks from Browse, or
            keep quizzing &mdash; anything you miss lands back here.
          </p>
          <Button variant="secondary" size="lg" className="mt-5" onClick={() => navigate("browse")}>
            Go to Browse
          </Button>
        </Card>
      </Layout>
    );
  }

  if (finished) {
    const remaining = buildRound().length;
    const graded = gotIt + stillShaky;
    const pct = graded > 0 ? (gotIt / graded) * 100 : 0;
    return (
      <Layout title={title}>
        <div className="space-y-5">
          <Card accent="border-l-emerald-500" glow className="p-6 text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brass-500">
              {rated ? "Round complete" : "Review complete"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-800/70 bg-emerald-950/30 p-4">
                <div className="font-display text-5xl font-bold tabular-nums text-emerald-300">
                  {gotIt}
                </div>
                <div className="mt-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                  Got it
                </div>
              </div>
              <div className="rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4">
                <div className="font-display text-5xl font-bold tabular-nums text-amber-300">
                  {stillShaky}
                </div>
                <div className="mt-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400">
                  {rated ? "Not yet" : "Still shaky"}
                </div>
              </div>
            </div>
            <ProgressBar pct={pct} className="mt-5" />
          </Card>

          <p className="text-sm text-ink-400">
            {rated
              ? remaining === 0
                ? "Everything you rated is Got it now. Nice."
                : `${remaining} drink${remaining === 1 ? "" : "s"} still rated Don't got it or Kind of.`
              : remaining === 0
                ? "Nothing left in the review pool right now. Nice."
                : `${remaining} drink${remaining === 1 ? "" : "s"} still in the review pool.`}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {remaining > 0 && (
              <Button variant="primary" size="lg" onClick={startOver}>
                {rated ? "Go again" : "Review again"}
              </Button>
            )}
            <Button variant="secondary" size="lg" onClick={() => navigate("home")}>
              Home
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const { deckDrink, badges } = round[index];
  const { deck, drink } = deckDrink;
  const key = `${deck.id}:${drink.id}`;
  const color = baseColorFor(drink.base);
  const saved = !!savedDrinks[key];
  const skipped = !!skippedDrinks[key];
  const documentedFields = CARD_FIELDS.filter(({ field }) => isFieldDocumented(drink, field));
  const shakyForDrink = shakyFieldsMap[key];

  return (
    <Layout title={title}>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brass-500">
              Card {index + 1} of {round.length}
            </span>
            <span className="text-xs tabular-nums text-ink-400">
              {gotIt} got &middot; {stillShaky} {rated ? "not yet" : "shaky"}
            </span>
          </div>
          <ProgressBar tone="brand" pct={(index / round.length) * 100} />
        </div>

        <Card accent={color.border} className="p-6">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {badges.map((b) => (
              <Badge key={b.label} className={b.className}>
                {b.label}
              </Badge>
            ))}
          </div>

          <h2 className="font-display text-4xl font-bold leading-tight text-ink-100">{drink.name}</h2>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-ink-400">
            {deck.name} &middot; Tier {drink.tier} &middot; {drink.category}
          </p>

          {!revealed ? (
            <p className="mt-5 text-sm leading-relaxed text-ink-400">
              Say the full build out loud &mdash; glass, ice, ingredients, garnish &mdash; then reveal.
            </p>
          ) : (
            <div className="mt-5 space-y-4 border-t border-ink-800 pt-4">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {documentedFields.map(({ field, label }) => (
                  <div key={field} className="flex flex-col gap-0.5">
                    <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-500">
                      {label}
                    </span>
                    <span className="text-base leading-snug text-ink-100">
                      {getFieldValue(drink, field)}
                    </span>
                  </div>
                ))}
              </div>

              {drink.ingredients.length > 0 && (
                <div>
                  <div className="mb-1 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-500">
                    Ingredients
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 text-base text-ink-100 marker:text-ink-500">
                    {drink.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drink.notes && (
                <p className="text-sm leading-relaxed text-ink-300">
                  <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-500">
                    Notes{" "}
                  </span>
                  {drink.notes}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-ink-800 pt-3">
                <button
                  type="button"
                  onClick={() => toggleSaved(deck.id, drink.id)}
                  className={`min-h-[44px] rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors duration-100 ${
                    saved
                      ? "border-sky-600 bg-sky-900/40 text-sky-300"
                      : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100"
                  }`}
                >
                  {saved ? "★ Saved — tap to unsave" : "☆ Save for later"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSkipped(deck.id, drink.id)}
                  title="Won't show up in Review or quizzes anymore"
                  className={`min-h-[44px] rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors duration-100 ${
                    skipped
                      ? "border-ink-500 bg-ink-700 text-ink-200"
                      : "border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600 hover:text-ink-200"
                  }`}
                >
                  {skipped ? "\u{1F6AB} Skipped — tap to unskip" : "\u{1F6AB} Don't need to know this"}
                </button>
              </div>

              <div className="border-t border-ink-800 pt-3">
                <SectionTitle>Shaky on</SectionTitle>
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {DRINK_FIELDS.map((field) => {
                    const active = (shakyForDrink ?? EMPTY_FIELDS).includes(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleShakyField(deck.id, drink.id, field)}
                        className={`min-h-[36px] rounded-full border px-3.5 py-1 text-xs font-medium transition-colors duration-100 ${
                          active
                            ? "border-amber-600 bg-amber-900/40 text-amber-300"
                            : "border-ink-700 bg-ink-850 text-ink-400 hover:border-ink-600 hover:text-ink-200"
                        }`}
                      >
                        {FIELD_LABELS[field]}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onBlur={commitNote}
                  placeholder={"Personal note — e.g. 'confused vodka for tequila', 'forgot the cherry garnish'..."}
                  rows={2}
                  className="w-full rounded-xl border border-ink-800 bg-ink-950/50 px-3 py-2 text-sm text-ink-200 placeholder-ink-500 outline-none transition-colors duration-100 focus:border-brass-500 focus:ring-2 focus:ring-brass-500/25"
                />
              </div>
            </div>
          )}
        </Card>

        {!revealed ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setRevealed(true)}>
            Reveal build
          </Button>
        ) : rated ? (
          <div className="grid grid-cols-3 gap-2">
            {CONFIDENCE_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => rate(level)}
                className={`min-h-[56px] rounded-xl border px-2 py-2 text-sm font-semibold leading-tight transition-colors duration-100 hover:brightness-125 ${CONFIDENCE_ACTIVE[level]}`}
              >
                {CONFIDENCE_LABELS[level]}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="success" size="lg" className="min-h-[56px]" onClick={() => grade(true)}>
              Got it
            </Button>
            <Button variant="warn" size="lg" className="min-h-[56px]" onClick={() => grade(false)}>
              Still shaky
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
