import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { getFilteredDrinks, getFieldValue, isFieldDocumented, shuffle } from "../lib/quiz";
import { buildReviewPool, type ReviewEntry, type ReviewReason } from "../lib/reviewPool";
import { baseColorFor } from "../lib/baseColors";
import { DRINK_FIELDS, type DrinkField } from "../types";

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
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-neutral-400">
          No drinks match your current selection. Go back{" "}
          <button className="text-emerald-400 underline" onClick={() => navigate("home")}>
            Home
          </button>{" "}
          and pick a deck.
        </div>
      </Layout>
    );
  }

  if (round.length === 0) {
    return (
      <Layout title="Review">
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 text-center">
          <p className="text-lg font-medium text-emerald-300">Nothing needs review 🎉</p>
          <p className="mt-2 text-sm text-neutral-400">
            Every drink in your selection is either mastered or not flagged. Save drinks from Browse, or
            keep quizzing — anything you miss lands back here.
          </p>
          <button
            type="button"
            onClick={() => navigate("browse")}
            className="mt-4 rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
          >
            Go to Browse
          </button>
        </div>
      </Layout>
    );
  }

  if (finished) {
    const remaining = buildRound().length;
    return (
      <Layout title="Review">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Review complete</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-center">
              <div className="text-3xl font-semibold text-emerald-300">{gotIt}</div>
              <div className="text-sm text-neutral-400">Got it</div>
            </div>
            <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-center">
              <div className="text-3xl font-semibold text-amber-300">{stillShaky}</div>
              <div className="text-sm text-neutral-400">Still shaky</div>
            </div>
          </div>
          <p className="text-sm text-neutral-400">
            {remaining === 0
              ? "Nothing left in the review pool right now. Nice."
              : `${remaining} drink${remaining === 1 ? "" : "s"} still in the review pool.`}
          </p>
          <div className="flex gap-2">
            {remaining > 0 && (
              <button
                type="button"
                onClick={startOver}
                className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-emerald-300 hover:bg-emerald-900/60"
              >
                Review again
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("home")}
              className="rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
            >
              Home
            </button>
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

  return (
    <Layout title="Review">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          Card {index + 1} of {round.length}
        </p>

        <div className={`rounded-lg border border-neutral-800 border-l-4 bg-neutral-900/50 p-5 ${color.border}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {reasons.map((r) => (
              <span key={r} className={`rounded border px-1.5 py-0.5 text-xs ${REASON_STYLES[r]}`}>
                {r}
              </span>
            ))}
          </div>

          <h2 className="text-2xl font-semibold">{drink.name}</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {deck.name} · Tier {drink.tier} · {drink.category}
          </p>

          {!revealed ? (
            <p className="mt-4 text-sm text-neutral-400">
              Say the full build out loud — glass, ice, ingredients, garnish — then reveal.
            </p>
          ) : (
            <div className="mt-4 space-y-3 border-t border-neutral-800 pt-4">
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {documentedFields.map(({ field, label }) => (
                  <div key={field}>
                    <span className="text-neutral-500">{label}: </span>
                    <span className="text-neutral-200">{getFieldValue(drink, field)}</span>
                  </div>
                ))}
              </div>

              {drink.ingredients.length > 0 && (
                <div className="text-sm">
                  <div className="mb-1 text-neutral-500">Ingredients</div>
                  <ul className="list-inside list-disc space-y-0.5 text-neutral-200">
                    {drink.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
              )}

              {drink.notes && (
                <p className="text-sm text-neutral-400">
                  <span className="text-neutral-500">Notes: </span>
                  {drink.notes}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleSaved(deck.id, drink.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    saved
                      ? "border-sky-600 bg-sky-900/40 text-sky-300"
                      : "border-neutral-700 bg-neutral-900/50 text-neutral-400 hover:border-neutral-600"
                  }`}
                >
                  {saved ? "★ Saved — tap to unsave" : "☆ Save for later"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSkipped(deck.id, drink.id)}
                  title="Won't show up in Review or quizzes anymore"
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    skipped
                      ? "border-neutral-500 bg-neutral-800 text-neutral-300"
                      : "border-neutral-700 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600"
                  }`}
                >
                  {skipped ? "🚫 Skipped — tap to unskip" : "🚫 Don't need to know this"}
                </button>
              </div>

              <div className="border-t border-neutral-800 pt-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs text-neutral-500">Shaky on:</span>
                  {DRINK_FIELDS.map((field) => {
                    const active = (shakyFieldsMap[key] ?? []).includes(field);
                    return (
                      <button
                        key={field}
                        type="button"
                        onClick={() => toggleShakyField(deck.id, drink.id, field)}
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          active
                            ? "border-amber-600 bg-amber-900/40 text-amber-300"
                            : "border-neutral-700 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600"
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
                  placeholder="Personal note — e.g. 'confused vodka for tequila', 'forgot the cherry garnish'..."
                  rows={2}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-600"
                />
              </div>
            </div>
          )}
        </div>

        {!revealed ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="min-h-[52px] w-full rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
          >
            Reveal build
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => grade(true)}
              className="min-h-[52px] rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 font-medium text-emerald-300 hover:bg-emerald-900/60"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={() => grade(false)}
              className="min-h-[52px] rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-2 font-medium text-amber-300 hover:bg-amber-950/60"
            >
              Still shaky
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
