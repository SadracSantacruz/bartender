import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import type { DrinkField } from "../types";
import {
  getFilteredDrinks,
  getFieldValue,
  isFieldDocumented,
  pickRandom,
  type DeckDrink,
} from "../lib/quiz";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";

const ROUND_SIZE = 10;

// `serve` is skipped here - it's redundant with glass/rim context.
const FIELDS_TO_GRADE: DrinkField[] = ["base", "glass", "rim", "garnish", "ingredients", "prep"];

const FIELD_LABELS: Record<DrinkField, string> = {
  base: "Base",
  glass: "Glass",
  serve: "Serve",
  rim: "Rim",
  garnish: "Garnish",
  ingredients: "Ingredients",
  prep: "Prep",
};

function buildRound(pool: DeckDrink[]): DeckDrink[] {
  return pickRandom(pool, Math.min(ROUND_SIZE, pool.length));
}

interface SummaryEntry {
  deckDrink: DeckDrink;
  wrongFields: DrinkField[];
}

export default function FullBuildRecall() {
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const navigate = useAppStore((s) => s.navigate);
  const recordResult = useProgressStore((s) => s.recordResult);
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter, skippedDrinks);
  }, [selectedDeckIds, tierFilter, categoryFilter, skippedDrinks]);

  const [round, setRound] = useState<DeckDrink[]>(() => buildRound(pool));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Record<DrinkField, string>>>({});
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Partial<Record<DrinkField, boolean>>>({});
  const [summary, setSummary] = useState<SummaryEntry[]>([]);
  const [finished, setFinished] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  const current = round[index];
  const documentedFields = useMemo(
    () => (current ? FIELDS_TO_GRADE.filter((f) => isFieldDocumented(current.drink, f)) : []),
    [current]
  );
  const allMarked = documentedFields.length > 0 && documentedFields.every((f) => grades[f] !== undefined);

  useEffect(() => {
    if (!finished && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [index, finished]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && revealed && !finished) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, finished, index, round, grades]);

  if (pool.length === 0) {
    return (
      <Layout title="Full Build Recall">
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

  function handleReveal() {
    setRevealed(true);
  }

  function handleGrade(field: DrinkField, correct: boolean) {
    if (grades[field] !== undefined) return;
    recordResult(current.deck.id, current.drink.id, correct, field);
    setGrades((g) => ({ ...g, [field]: correct }));
  }

  function goNext() {
    const wrongFields = documentedFields.filter((f) => grades[f] === false);
    setSummary((s) => [...s, { deckDrink: current, wrongFields }]);

    if (index + 1 >= round.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setAnswers({});
    setRevealed(false);
    setGrades({});
  }

  function playAgain() {
    setRound(buildRound(pool));
    setIndex(0);
    setAnswers({});
    setRevealed(false);
    setGrades({});
    setSummary([]);
    setFinished(false);
  }

  if (finished) {
    return (
      <Layout title="Full Build Recall">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Round complete</h2>
          <div className="space-y-3">
            {summary.map((entry, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 ${
                  entry.wrongFields.length === 0
                    ? "border-emerald-800 bg-emerald-950/20"
                    : "border-red-900/60 bg-red-950/20"
                }`}
              >
                <div className="font-medium text-neutral-100">{entry.deckDrink.drink.name}</div>
                {entry.wrongFields.length === 0 ? (
                  <p className="mt-1 text-sm text-emerald-400">All marked fields correct.</p>
                ) : (
                  <p className="mt-1 text-sm text-red-300">
                    Missed: {entry.wrongFields.map((f) => FIELD_LABELS[f]).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={playAgain}
            className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-emerald-300 hover:bg-emerald-900/60"
          >
            Play again
          </button>
        </div>
      </Layout>
    );
  }

  const { deck, drink } = current;

  return (
    <Layout title="Full Build Recall">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          Drink {index + 1} of {round.length}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">{drink.name}</h2>
          <span className="rounded border border-fuchsia-700 bg-fuchsia-950/40 px-1.5 py-0.5 text-xs text-fuchsia-300">
            {deck.name}
          </span>
        </div>

        <div className="space-y-3">
          {documentedFields.map((field, i) => (
            <div key={field} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {FIELD_LABELS[field]}
              </div>
              {field === "ingredients" ? (
                <textarea
                  value={answers[field] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [field]: e.target.value }))}
                  disabled={revealed}
                  rows={3}
                  placeholder="List ingredients..."
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 outline-none focus:border-emerald-600 disabled:opacity-70"
                />
              ) : (
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  type="text"
                  value={answers[field] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [field]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !revealed) handleReveal();
                  }}
                  disabled={revealed}
                  placeholder={`Your answer for ${FIELD_LABELS[field].toLowerCase()}...`}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder-neutral-600 outline-none focus:border-emerald-600 disabled:opacity-70"
                />
              )}

              {revealed && (
                <div className="mt-3 space-y-2 border-t border-neutral-800 pt-3">
                  <div className="text-sm">
                    <span className="text-neutral-500">Correct: </span>
                    <span className="text-emerald-300">{getFieldValue(drink, field)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={grades[field] !== undefined}
                      onClick={() => handleGrade(field, true)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        grades[field] === true
                          ? "border-emerald-600 bg-emerald-900/60 text-emerald-300"
                          : "border-neutral-700 bg-neutral-900/50 text-neutral-300 hover:bg-neutral-900"
                      } disabled:cursor-not-allowed`}
                    >
                      Got it
                    </button>
                    <button
                      type="button"
                      disabled={grades[field] !== undefined}
                      onClick={() => handleGrade(field, false)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        grades[field] === false
                          ? "border-red-700 bg-red-950/60 text-red-300"
                          : "border-neutral-700 bg-neutral-900/50 text-neutral-300 hover:bg-neutral-900"
                      } disabled:cursor-not-allowed`}
                    >
                      Missed it
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {revealed && drink.verify && (
          <div className="space-y-1">
            <span className="inline-block rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-xs text-amber-400">
              unverified
            </span>
            <p className="text-xs text-amber-400">{drink.verify}</p>
          </div>
        )}

        {!revealed ? (
          <button
            type="button"
            onClick={handleReveal}
            className="rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
          >
            Reveal
          </button>
        ) : (
          <div className="space-y-2">
            {!allMarked && (
              <p className="text-sm text-neutral-500">Mark all fields above before moving on (or skip early).</p>
            )}
            <button
              type="button"
              onClick={goNext}
              className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-emerald-300 hover:bg-emerald-900/60"
            >
              Next drink (Space)
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
