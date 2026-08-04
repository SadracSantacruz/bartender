import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import {
  buildInvertedQuestions,
  fuzzyMatchName,
  getFilteredDrinks,
  normalize,
  shuffle,
  type DeckDrink,
  type InvertedQuestion,
} from "../lib/quiz";
import type { DrinkField } from "../types";

const ROUND_SECONDS = 60;

const FIELD_TEMPLATES: Partial<Record<DrinkField, (value: string, plural: boolean) => string>> = {
  base: (value, plural) => `Which drink${plural ? "s" : ""} use${plural ? "" : "s"} ${value}?`,
  glass: (value, plural) =>
    `Which drink${plural ? "s" : ""} ${plural ? "are" : "is"} served in a ${value}?`,
  serve: (value, plural) => `Which drink${plural ? "s" : ""} ${plural ? "are" : "is"} served ${value}?`,
  rim: (value, plural) => `Which drink${plural ? "s" : ""} ${plural ? "have" : "has"} a ${value} rim?`,
  garnish: (value, plural) =>
    `Which drink${plural ? "s" : ""} ${plural ? "are" : "is"} garnished with ${value}?`,
};

const SKIP_VALUES = new Set(["none", "none listed", ""]);

function buildIngredientQuestions(pool: DeckDrink[]): InvertedQuestion[] {
  const groups = new Map<string, { value: string; ids: string[] }>();

  for (const { deck, drink } of pool) {
    for (const raw of drink.ingredients) {
      const key = normalize(raw);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, { value: raw, ids: [] });
      const group = groups.get(key)!;
      const id = `${deck.id}:${drink.id}`;
      if (!group.ids.includes(id)) group.ids.push(id);
    }
  }

  const questions: InvertedQuestion[] = [];
  for (const { value, ids } of groups.values()) {
    if (ids.length < 1 || ids.length > 2) continue;
    questions.push({
      prompt: `Which drink${ids.length > 1 ? "s" : ""} use${ids.length > 1 ? "" : "s"} ${value}?`,
      answerDrinkIds: ids,
      field: "ingredients",
      value,
    });
  }
  return questions;
}

function buildQuestionBank(pool: DeckDrink[]): InvertedQuestion[] {
  const questions: InvertedQuestion[] = [];

  for (const field of Object.keys(FIELD_TEMPLATES) as DrinkField[]) {
    const template = FIELD_TEMPLATES[field]!;
    const generated = buildInvertedQuestions(pool, field, template).filter(
      (q) => !SKIP_VALUES.has(q.value.trim().toLowerCase())
    );
    questions.push(...generated);
  }

  questions.push(...buildIngredientQuestions(pool));

  return shuffle(questions);
}

interface Miss {
  prompt: string;
  answerNames: string[];
}

type RoundState = "playing" | "done";

function findDrink(pool: DeckDrink[], key: string): DeckDrink | undefined {
  const [deckId, drinkId] = key.split(":");
  return pool.find((d) => d.deck.id === deckId && d.drink.id === drinkId);
}

export default function RapidFire() {
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const recordResult = useProgressStore((s) => s.recordResult);

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter);
  }, [selectedDeckIds, tierFilter, categoryFilter]);

  const [bank, setBank] = useState<InvertedQuestion[]>(() => buildQuestionBank(pool));
  const [bankIndex, setBankIndex] = useState(0);
  const [current, setCurrent] = useState<InvertedQuestion | null>(bank[0] ?? null);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [roundState, setRoundState] = useState<RoundState>(pool.length > 0 ? "playing" : "done");
  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startRound() {
    const freshBank = buildQuestionBank(pool);
    setBank(freshBank);
    setBankIndex(freshBank.length > 0 ? 1 : 0);
    setCurrent(freshBank[0] ?? null);
    setInput("");
    setFlash(null);
    setScore(0);
    setMisses([]);
    setSecondsLeft(ROUND_SECONDS);
    setRoundState(freshBank.length > 0 ? "playing" : "done");
  }

  // Countdown timer
  useEffect(() => {
    if (roundState !== "playing") return;
    if (secondsLeft <= 0) {
      setRoundState("done");
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [roundState, secondsLeft]);

  // Auto-focus input for each new question
  useEffect(() => {
    if (roundState === "playing") inputRef.current?.focus();
  }, [current, roundState]);

  useEffect(() => {
    return () => {
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, []);

  function nextQuestion() {
    if (bank.length === 0) return;
    let idx = bankIndex;
    let nextBank = bank;
    if (idx >= nextBank.length) {
      nextBank = shuffle(bank);
      idx = 0;
      setBank(nextBank);
    }
    setCurrent(nextBank[idx]);
    setBankIndex(idx + 1);
  }

  function submitAnswer() {
    if (!current || roundState !== "playing") return;

    const answerDrinks = current.answerDrinkIds
      .map((key) => findDrink(pool, key))
      .filter((d): d is DeckDrink => Boolean(d));

    let matchedDrink: DeckDrink | null = null;
    for (const d of answerDrinks) {
      const result = fuzzyMatchName(input, d.drink.name);
      if (result === "exact" || result === "close") {
        matchedDrink = d;
        break;
      }
    }

    const correct = matchedDrink !== null;

    if (correct && matchedDrink) {
      setScore((s) => s + 1);
      recordResult(matchedDrink.deck.id, matchedDrink.drink.id, true);
    } else {
      setMisses((m) => [
        ...m,
        { prompt: current.prompt, answerNames: answerDrinks.map((d) => d.drink.name) },
      ]);
      // Best-effort: mark the first answer drink wrong (don't penalize the other in a 2-answer set)
      if (answerDrinks[0]) {
        recordResult(answerDrinks[0].deck.id, answerDrinks[0].drink.id, false);
      }
    }

    setFlash(correct ? "correct" : "wrong");
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(() => setFlash(null), 150);

    setInput("");
    nextQuestion();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitAnswer();
    }
  }

  if (pool.length === 0) {
    return (
      <Layout title="Rapid Fire">
        <p className="text-neutral-400">
          No drinks match your current selection. Go back home and select a deck (and check your
          tier/category filters).
        </p>
      </Layout>
    );
  }

  if (roundState === "done") {
    return (
      <Layout title="Rapid Fire">
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 text-center">
            <div className="text-4xl font-bold text-emerald-400">{score} correct</div>
            <p className="mt-1 text-neutral-400">out of {score + misses.length} attempted</p>
          </div>

          {misses.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
                Missed questions
              </h2>
              <div className="space-y-2">
                {misses.map((m, i) => (
                  <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                    <div className="text-neutral-200">{m.prompt}</div>
                    <div className="mt-1 text-sm text-emerald-400">
                      Answer: {m.answerNames.join(" or ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startRound}
            className="min-h-[52px] w-full rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-3 font-medium text-emerald-300 hover:bg-emerald-900/60 active:bg-emerald-900"
          >
            Play again
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Rapid Fire">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-3xl font-bold tabular-nums text-neutral-100">
            0:{secondsLeft.toString().padStart(2, "0")}
          </div>
          <div className="text-lg text-neutral-400">
            Score: <span className="font-semibold text-emerald-400">{score}</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-6 text-center">
          <p className="text-xl font-medium text-neutral-100">{current?.prompt}</p>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the drink name and press Enter"
          autoComplete="off"
          className={`min-h-[52px] w-full rounded-lg border-2 bg-neutral-900 px-4 py-3 text-lg text-neutral-100 outline-none transition-colors duration-150 ${
            flash === "correct"
              ? "border-emerald-500"
              : flash === "wrong"
                ? "border-red-500"
                : "border-neutral-700 focus:border-neutral-500"
          }`}
        />
      </div>
    </Layout>
  );
}
