import { useEffect, useMemo, useState, useCallback } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import {
  getFilteredDrinks,
  getFieldValue,
  isFieldDocumented,
  pickDistractors,
  shuffle,
  type DeckDrink,
} from "../lib/quiz";
import { DRINK_FIELDS, type DrinkField } from "../types";

const ROUND_LENGTH = 15;
const MAX_GEN_ATTEMPTS = 300;

const QUIZ_FIELDS: DrinkField[] = DRINK_FIELDS.filter((f) => f !== "ingredients") as DrinkField[];

interface Question {
  key: string;
  deckId: string;
  drinkId: string;
  drinkName: string;
  field: DrinkField;
  correctValue: string;
  options: string[];
  verify?: string;
}

function fieldLabel(field: DrinkField): string {
  switch (field) {
    case "base":
      return "base spirit";
    case "glass":
      return "glass";
    case "serve":
      return "serve style";
    case "rim":
      return "rim";
    case "garnish":
      return "garnish";
    case "prep":
      return "prep";
    default:
      return field;
  }
}

function questionPrompt(drinkName: string, field: DrinkField): string {
  switch (field) {
    case "base":
      return `What is the base spirit of ${drinkName}?`;
    case "glass":
      return `What glass is ${drinkName} served in?`;
    case "serve":
      return `How is ${drinkName} served?`;
    case "rim":
      return `What is the rim on ${drinkName}?`;
    case "garnish":
      return `What garnish goes on ${drinkName}?`;
    case "prep":
      return `What is the prep method for ${drinkName}?`;
    default:
      return `What is the ${fieldLabel(field)} of ${drinkName}?`;
  }
}

function pickWeightedDrink(
  pool: DeckDrink[],
  weightFor: (deckId: string, drinkId: string, tier: number) => number
): DeckDrink {
  const weights = pool.map((dd) => Math.max(0.001, weightFor(dd.deck.id, dd.drink.id, dd.drink.tier)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function generateRound(
  pool: DeckDrink[],
  weightFor: (deckId: string, drinkId: string, tier: number) => number
): Question[] {
  const questions: Question[] = [];
  const usedKeys = new Set<string>();
  let attempts = 0;

  while (questions.length < ROUND_LENGTH && attempts < MAX_GEN_ATTEMPTS) {
    attempts++;
    const dd = pickWeightedDrink(pool, weightFor);
    const { deck, drink } = dd;

    const candidateFields = QUIZ_FIELDS.filter((f) => isFieldDocumented(drink, f));
    if (candidateFields.length === 0) continue;
    const field = candidateFields[Math.floor(Math.random() * candidateFields.length)];

    const qKey = `${deck.id}:${drink.id}:${field}`;
    if (usedKeys.has(qKey) && attempts < MAX_GEN_ATTEMPTS - 20) continue;

    const correctValue = getFieldValue(drink, field);
    const distractors = pickDistractors(pool, dd, field, 3);
    if (distractors.length === 0) continue;

    const options = shuffle([correctValue, ...distractors]);

    usedKeys.add(qKey);
    questions.push({
      key: `${qKey}:${questions.length}`,
      deckId: deck.id,
      drinkId: drink.id,
      drinkName: drink.name,
      field,
      correctValue,
      options,
      verify: drink.verify,
    });
  }

  return questions;
}

interface MissedEntry {
  drinkName: string;
  field: DrinkField;
  yourAnswer: string;
  correctAnswer: string;
}

export default function MultipleChoice() {
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const recordResult = useProgressStore((s) => s.recordResult);
  const weightFor = useProgressStore((s) => s.weightFor);

  const decks = useMemo(
    () => LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck),
    [selectedDeckIds]
  );

  const pool = useMemo(
    () => getFilteredDrinks(decks, tierFilter, categoryFilter),
    [decks, tierFilter, categoryFilter]
  );

  const [questions, setQuestions] = useState<Question[]>(() => generateRound(pool, weightFor));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [missed, setMissed] = useState<MissedEntry[]>([]);
  const [finished, setFinished] = useState(false);

  const startNewRound = useCallback(() => {
    setQuestions(generateRound(pool, weightFor));
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setMissed([]);
    setFinished(false);
  }, [pool, weightFor]);

  const current = questions[index];

  const submitAnswer = useCallback(
    (optionIndex: number) => {
      if (!current || revealed) return;
      const chosen = current.options[optionIndex];
      const correct = chosen === current.correctValue;
      setSelected(optionIndex);
      setRevealed(true);
      recordResult(current.deckId, current.drinkId, correct, current.field);
      if (!correct) {
        setMissed((m) => [
          ...m,
          {
            drinkName: current.drinkName,
            field: current.field,
            yourAnswer: chosen,
            correctAnswer: current.correctValue,
          },
        ]);
      }
    },
    [current, revealed, recordResult]
  );

  const advance = useCallback(() => {
    if (!revealed) return;
    if (index + 1 >= questions.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setRevealed(false);
    }
  }, [revealed, index, questions.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (finished) return;
      if (!current) return;
      if (["1", "2", "3", "4"].includes(e.key)) {
        const optionIndex = Number(e.key) - 1;
        if (optionIndex < current.options.length && !revealed) {
          submitAnswer(optionIndex);
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        if (revealed) {
          e.preventDefault();
          advance();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, revealed, finished, submitAnswer, advance]);

  if (pool.length === 0) {
    return (
      <Layout title="Multiple Choice">
        <p className="text-neutral-400">
          No drinks match your current selection. Go back Home and select a deck (and check your
          tier/category filters).
        </p>
      </Layout>
    );
  }

  if (questions.length === 0) {
    return (
      <Layout title="Multiple Choice">
        <p className="text-neutral-400">
          Not enough documented drinks in this pool to build a multiple-choice round. Try selecting
          more decks or clearing your filters.
        </p>
      </Layout>
    );
  }

  if (finished) {
    const scoreCorrect = questions.length - missed.length;
    return (
      <Layout title="Multiple Choice">
        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="mb-1 text-xl font-semibold">Round complete</h2>
          <p className="text-neutral-400">
            {scoreCorrect} / {questions.length} correct
          </p>
        </div>

        {missed.length > 0 ? (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
              Missed questions
            </h3>
            <div className="space-y-2">
              {missed.map((m, i) => (
                <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                  <div className="font-medium">
                    {m.drinkName} — {fieldLabel(m.field)}
                  </div>
                  <div className="text-sm text-red-400">Your answer: {m.yourAnswer}</div>
                  <div className="text-sm text-emerald-400">Correct: {m.correctAnswer}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mb-6 text-emerald-400">Perfect round. Nice work.</p>
        )}

        <button
          type="button"
          onClick={startNewRound}
          className="min-h-[52px] w-full rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-3 font-medium text-emerald-300 hover:bg-emerald-900/60 active:bg-emerald-900"
        >
          Play again
        </button>
      </Layout>
    );
  }

  return (
    <Layout title="Multiple Choice">
      <p className="mb-2 text-sm text-neutral-500">
        Question {index + 1} of {questions.length}
      </p>

      <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{current.drinkName}</h2>
          {current.verify && (
            <span className="rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-xs text-amber-400">
              unverified
            </span>
          )}
        </div>
        <p className="text-neutral-300">{questionPrompt(current.drinkName, current.field)}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {current.options.map((opt, i) => {
          const isCorrect = opt === current.correctValue;
          const isPicked = selected === i;
          let cls =
            "border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 active:bg-neutral-900";
          if (revealed) {
            if (isCorrect) {
              cls = "border-emerald-600 bg-emerald-900/40 text-emerald-200";
            } else if (isPicked) {
              cls = "border-red-700 bg-red-950/40 text-red-200";
            } else {
              cls = "border-neutral-800 bg-neutral-900/30 opacity-60";
            }
          }
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => submitAnswer(i)}
              className={`min-h-[52px] rounded-lg border px-4 py-3 text-left transition-colors duration-100 ${cls}`}
            >
              <span className="mr-2 text-neutral-500">{i + 1}.</span>
              {opt}
            </button>
          );
        })}
      </div>

      {revealed && current.verify && (
        <p className="mt-3 rounded border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-400">
          {current.verify}
        </p>
      )}

      {revealed && (
        <button
          type="button"
          onClick={advance}
          className="mt-4 min-h-[52px] w-full rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-3 font-medium text-neutral-200 hover:bg-neutral-900 active:bg-neutral-800"
        >
          {index + 1 >= questions.length ? "See results" : "Next"} (Enter / Space)
        </button>
      )}
    </Layout>
  );
}
