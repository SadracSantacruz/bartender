import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { getFilteredDrinks, getFieldValue, isFieldDocumented, shuffle } from "../lib/quiz";
import { buildReviewPool, type ReviewEntry, type ReviewReason } from "../lib/reviewPool";
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
  saved: "border-sky-700 bg-sky-950/60 text-sky-300",
  "never seen": "border-purple-700 bg-purple-950/60 text-purple-300",
  shaky: "border-amber-700 bg-amber-950/60 text-amber-300",
};

export default function Review() {
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

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter, skippedDrinks);
  }, [selectedDeckIds, tierFilter, categoryFilter, skippedDrinks]);

  // Snapshot the review deck once per round so grading a card doesn't reshuffle
  // or remove cards out from under you mid-round.
  const [round, setRound] = useState<ReviewEntry[]>(() => buildRound());
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

  function buildRound(): ReviewEntry[] {
    const { getStats, isSaved } = useProgressStore.getState();
    return shuffle(buildReviewPool(pool, getStats, isSaved));
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

  if (pool.length === 0) {
    return (
      <Layout title="Review">
        <EmptyState title="No drinks in this pool">
          No drinks match your current selection. Go back{" "}
          <button className="text-emerald-400 underline" onClick={() => navigate("home")}>
            Home
          </button>{" "}
          and pick a deck.
        </EmptyState>
      </Layout>
    );
  }

  if (round.length === 0) {
    return (
      <Layout title="Review">
        <Card accent="border-l-emerald-600" className="p-8 text-center">
          <p className="text-xl font-semibold text-emerald-300">Nothing needs review &#127881;</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-400">
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
      <Layout title="Review">
        <div className="space-y-5">
          <Card accent="border-l-emerald-600" className="p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Review complete
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
                <div className="text-4xl font-bold tabular-nums text-emerald-300">{gotIt}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-neutral-500">Got it</div>
              </div>
              <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4">
                <div className="text-4xl font-bold tabular-nums text-amber-300">{stillShaky}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-neutral-500">
                  Still shaky
                </div>
              </div>
            </div>
            <ProgressBar pct={pct} className="mt-4" />
          </Card>

          <p className="text-sm text-neutral-400">
            {remaining === 0
              ? "Nothing left in the review pool right now. Nice."
              : `${remaining} drink${remaining === 1 ? "" : "s"} still in the review pool.`}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {remaining > 0 && (
              <Button variant="primary" size="lg" onClick={startOver}>
                Review again
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

  const { deckDrink, reasons } = round[index];
  const { deck, drink } = deckDrink;
  const key = `${deck.id}:${drink.id}`;
  const color = baseColorFor(drink.base);
  const saved = !!savedDrinks[key];
  const skipped = !!skippedDrinks[key];
  const documentedFields = CARD_FIELDS.filter(({ field }) => isFieldDocumented(drink, field));
  const shakyForDrink = shakyFieldsMap[key];

  return (
    <Layout title="Review">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Card {index + 1} of {round.length}
            </span>
            <span className="text-xs tabular-nums text-neutral-500">
              {gotIt} got &middot; {stillShaky} shaky
            </span>
          </div>
          <ProgressBar pct={(index / round.length) * 100} />
        </div>

        <Card accent={color.border} className="p-5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {reasons.map((r) => (
              <Badge key={r} className={REASON_STYLES[r]}>
                {r}
              </Badge>
            ))}
          </div>

          <h2 className="text-3xl font-bold leading-tight text-neutral-50">{drink.name}</h2>
          <p className="mt-1.5 text-xs uppercase tracking-widest text-neutral-500">
            {deck.name} &middot; Tier {drink.tier} &middot; {drink.category}
          </p>

          {!revealed ? (
            <p className="mt-4 text-sm leading-relaxed text-neutral-400">
              Say the full build out loud &mdash; glass, ice, ingredients, garnish &mdash; then reveal.
            </p>
          ) : (
            <div className="mt-4 space-y-4 border-t border-neutral-800 pt-4">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {documentedFields.map(({ field, label }) => (
                  <div key={field} className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                      {label}
                    </span>
                    <span className="text-base leading-snug text-neutral-100">
                      {getFieldValue(drink, field)}
                    </span>
                  </div>
                ))}
              </div>

              {drink.ingredients.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                    Ingredients
                  </div>
                  <ul className="list-inside list-disc space-y-0.5 text-base text-neutral-100">
                    {drink.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drink.notes && (
                <p className="text-sm leading-relaxed text-neutral-400">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                    Notes{" "}
                  </span>
                  {drink.notes}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
                <button
                  type="button"
                  onClick={() => toggleSaved(deck.id, drink.id)}
                  className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-sm transition-colors duration-100 ${
                    saved
                      ? "border-sky-600 bg-sky-900/40 text-sky-300"
                      : "border-neutral-700 bg-neutral-900/50 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                  }`}
                >
                  {saved ? "\u2605 Saved \u2014 tap to unsave" : "\u2606 Save for later"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSkipped(deck.id, drink.id)}
                  title="Won't show up in Review or quizzes anymore"
                  className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-sm transition-colors duration-100 ${
                    skipped
                      ? "border-neutral-500 bg-neutral-800 text-neutral-300"
                      : "border-neutral-700 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
                  }`}
                >
                  {skipped ? "\u{1F6AB} Skipped \u2014 tap to unskip" : "\u{1F6AB} Don't need to know this"}
                </button>
              </div>

              <div className="border-t border-neutral-800 pt-3">
                <SectionTitle>Shaky on</SectionTitle>
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  {DRINK_FIELDS.map((field) => {
                    const active = (shakyForDrink ?? EMPTY_FIELDS).includes(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleShakyField(deck.id, drink.id, field)}
                        className={`min-h-[32px] rounded-full border px-3 py-1 text-xs transition-colors duration-100 ${
                          active
                            ? "border-amber-600 bg-amber-900/40 text-amber-300"
                            : "border-neutral-800 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
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
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none transition-colors duration-100 focus:border-neutral-600 focus:ring-2 focus:ring-neutral-700/40"
                />
              </div>
            </div>
          )}
        </Card>

        {!revealed ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setRevealed(true)}>
            Reveal build
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="primary" size="lg" onClick={() => grade(true)}>
              Got it
            </Button>
            <Button variant="warn" size="lg" onClick={() => grade(false)}>
              Still shaky
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
