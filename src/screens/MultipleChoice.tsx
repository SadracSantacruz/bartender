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
import {
  accuracyText,
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
} from "../components/ui";

const ROUND_LENGTH = 15;
const MAX_GEN_ATTEMPTS = 300;

const QUIZ_FIELDS: DrinkField[] = DRINK_FIELDS.filter((f) => f !== "ingredients") as DrinkField[];

interface Question {
  key: string;
  deckId: string;
  deckName: string;
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
      deckName: deck.name,
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
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);

  const decks = useMemo(
    () => LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck),
    [selectedDeckIds]
  );

  const pool = useMemo(
    () => getFilteredDrinks(decks, tierFilter, categoryFilter, skippedDrinks),
    [decks, tierFilter, categoryFilter, skippedDrinks]
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
        <EmptyState title="No drinks in this pool">
          No drinks match your current selection. Go back Home and select a deck (and check your
          tier/category filters).
        </EmptyState>
      </Layout>
    );
  }

  if (questions.length === 0) {
    return (
      <Layout title="Multiple Choice">
        <EmptyState title="Not enough documented drinks">
          Not enough documented drinks in this pool to build a multiple-choice round. Try selecting
          more decks or clearing your filters.
        </EmptyState>
      </Layout>
    );
  }

  if (finished) {
    const scoreCorrect = questions.length - missed.length;
    const pct = questions.length > 0 ? (scoreCorrect / questions.length) * 100 : 0;
    return (
      <Layout title="Multiple Choice">
        <Card accent="border-l-emerald-600" className="mb-6 p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Round complete
          </p>
          <div className={`mt-2 text-5xl font-bold tabular-nums ${accuracyText(pct)}`}>
            {scoreCorrect}
            <span className="text-2xl font-semibold text-neutral-500">/{questions.length}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">correct</p>
          <ProgressBar pct={pct} className="mt-4" />
        </Card>

        {missed.length > 0 ? (
          <div className="mb-6">
            <SectionTitle
              right={<span className="text-xs tabular-nums text-neutral-500">{missed.length}</span>}
            >
              Missed questions
            </SectionTitle>
            <div className="space-y-2">
              {missed.map((m, i) => (
                <Card key={i} accent="border-l-red-700" className="p-3">
                  <div className="font-medium text-neutral-100">
                    {m.drinkName}{" "}
                    <span className="text-sm font-normal text-neutral-500">
                      &middot; {fieldLabel(m.field)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-red-400">Your answer: {m.yourAnswer}</div>
                  <div className="text-sm text-emerald-400">Correct: {m.correctAnswer}</div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card accent="border-l-emerald-600" className="mb-6 p-4 text-emerald-300">
            Perfect round. Nice work.
          </Card>
        )}

        <Button variant="primary" size="lg" className="w-full" onClick={startNewRound}>
          Play again
        </Button>
      </Layout>
    );
  }

  const answered = index + (revealed ? 1 : 0);

  return (
    <Layout title="Multiple Choice">
      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Question {index + 1} of {questions.length}
          </span>
          <span className="text-xs tabular-nums text-neutral-500">
            {answered - missed.length} correct
          </span>
        </div>
        <ProgressBar pct={(answered / questions.length) * 100} />
      </div>

      <Card className="mb-4 p-5">
        <p className="text-xl font-semibold leading-snug text-neutral-50 sm:text-2xl">
          {questionPrompt(current.drinkName, current.field)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className="border-fuchsia-800 bg-fuchsia-950/40 text-fuchsia-300">
            {current.deckName}
          </Badge>
          {current.verify && (
            <Badge className="border-amber-800 bg-amber-950/50 text-amber-400">unverified</Badge>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-2">
        {current.options.map((opt, i) => {
          const isCorrect = opt === current.correctValue;
          const isPicked = selected === i;
          let cls =
            "border-neutral-800 bg-neutral-900/60 text-neutral-100 hover:border-neutral-600 hover:bg-neutral-900 active:bg-neutral-800";
          let numCls = "border-neutral-700 text-neutral-500";
          if (revealed) {
            if (isCorrect) {
              cls =
                "border-emerald-500 bg-emerald-900/40 text-emerald-100 ring-1 ring-emerald-500/40";
              numCls = "border-emerald-500 text-emerald-300";
            } else if (isPicked) {
              cls = "border-red-600 bg-red-950/50 text-red-100 ring-1 ring-red-500/30";
              numCls = "border-red-600 text-red-300";
            } else {
              cls = "border-neutral-800 bg-neutral-900/30 text-neutral-500 opacity-60";
              numCls = "border-neutral-800 text-neutral-600";
            }
          }
          return (
            <button
              key={i}
              type="button"
              disabled={revealed}
              onClick={() => submitAnswer(i)}
              className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition-colors duration-100 disabled:cursor-default ${cls}`}
            >
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border text-xs font-semibold tabular-nums ${numCls}`}
              >
                {i + 1}
              </span>
              <span className="flex-1">{opt}</span>
              {revealed && isCorrect && (
                <span className="flex-none text-lg leading-none text-emerald-400">&#10003;</span>
              )}
              {revealed && isPicked && !isCorrect && (
                <span className="flex-none text-lg leading-none text-red-400">&#10007;</span>
              )}
            </button>
          );
        })}
      </div>

      {revealed && current.verify && (
        <Card accent="border-l-amber-600" className="mt-3 p-3">
          <div className="mb-1">
            <Badge className="border-amber-800 bg-amber-950/50 text-amber-400">unverified</Badge>
          </div>
          <p className="text-xs leading-relaxed text-amber-400">{current.verify}</p>
        </Card>
      )}

      {revealed && (
        <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={advance}>
          {index + 1 >= questions.length ? "See results" : "Next"}
          <span className="text-xs text-neutral-500">(Enter / Space)</span>
        </Button>
      )}
    </Layout>
  );
}
