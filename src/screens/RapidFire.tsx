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
import { Button, Card, EmptyState, ProgressBar, SectionTitle } from "../components/ui";

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
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter, skippedDrinks);
  }, [selectedDeckIds, tierFilter, categoryFilter, skippedDrinks]);

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
        <EmptyState title="No drinks in this pool">
          No drinks match your current selection. Go back home and select a deck (and check your
          tier/category filters).
        </EmptyState>
      </Layout>
    );
  }

  if (roundState === "done") {
    const attempted = score + misses.length;
    const pct = attempted > 0 ? (score / attempted) * 100 : 0;
    return (
      <Layout title="Rapid Fire">
        <div className="space-y-6">
          <Card accent="border-l-emerald-600" className="p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Time&rsquo;s up
            </p>
            <div className="mt-2 text-6xl font-bold tabular-nums text-emerald-400">{score}</div>
            <p className="mt-1 text-sm text-neutral-400">
              correct out of {attempted} attempted
            </p>
            <ProgressBar pct={pct} className="mt-4" />
          </Card>

          {misses.length > 0 && (
            <div>
              <SectionTitle
                right={
                  <span className="text-xs tabular-nums text-neutral-500">{misses.length}</span>
                }
              >
                Missed questions
              </SectionTitle>
              <div className="space-y-2">
                {misses.map((m, i) => (
                  <Card key={i} accent="border-l-red-700" className="p-3">
                    <div className="text-neutral-100">{m.prompt}</div>
                    <div className="mt-1 text-sm text-emerald-400">
                      Answer: {m.answerNames.join(" or ")}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <Button variant="primary" size="lg" className="w-full" onClick={startRound}>
            Play again
          </Button>
        </div>
      </Layout>
    );
  }

  const timerTone =
    secondsLeft <= 10 ? "text-red-400" : secondsLeft <= 20 ? "text-amber-400" : "text-neutral-50";
  const timerBar =
    secondsLeft <= 10 ? "bg-red-500" : secondsLeft <= 20 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <Layout title="Rapid Fire">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Time left
              </div>
              <div className={`text-5xl font-bold leading-none tabular-nums ${timerTone}`}>
                0:{secondsLeft.toString().padStart(2, "0")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                Score
              </div>
              <div className="text-5xl font-bold leading-none tabular-nums text-emerald-400">
                {score}
              </div>
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className={`h-full rounded-full transition-[width] duration-100 ease-linear ${timerBar}`}
              style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }}
            />
          </div>
        </div>

        <Card className="p-6 text-center">
          <p className="text-2xl font-semibold leading-snug text-neutral-50">{current?.prompt}</p>
        </Card>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the drink name and press Enter"
          autoComplete="off"
          className={`min-h-[56px] w-full rounded-xl border-2 bg-neutral-900 px-4 py-3 text-lg text-neutral-100 placeholder-neutral-600 outline-none transition-colors duration-100 ${
            flash === "correct"
              ? "border-emerald-500 bg-emerald-950/40 text-emerald-100"
              : flash === "wrong"
                ? "border-red-500 bg-red-950/40 text-red-100"
                : "border-neutral-700 focus:border-emerald-500"
          }`}
        />
      </div>
    </Layout>
  );
}
