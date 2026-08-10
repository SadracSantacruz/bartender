import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import {
  DRINK_FIELDS,
  type Drink,
  type DrinkField,
} from "../types";
import {
  getFilteredDrinks,
  getFieldValue,
  isFieldDocumented,
  fuzzyMatchName,
  pickRandom,
  type DeckDrink,
} from "../lib/quiz";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";

const ROUND_SIZE = 15;

const FIELD_LABELS: Record<DrinkField, string> = {
  base: "Base",
  glass: "Glass",
  serve: "Serve",
  rim: "Rim",
  garnish: "Garnish",
  ingredients: "Ingredients",
  prep: "Prep",
};

type ResultState = "exact" | "wrong" | "close-pending" | "close-correct" | "close-wrong";

interface MissedEntry {
  deckDrink: DeckDrink;
  guess: string;
}

function buildRound(pool: DeckDrink[]): DeckDrink[] {
  return pickRandom(pool, Math.min(ROUND_SIZE, pool.length));
}

function BuildCard({ drink }: { drink: Drink }) {
  const fields = DRINK_FIELDS.filter((f) => isFieldDocumented(drink, f));
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="space-y-2">
        {fields.map((field) => (
          <div key={field} className="flex flex-col gap-0.5 border-b border-neutral-800/60 pb-2 last:border-none">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {FIELD_LABELS[field]}
            </span>
            <span className="text-sm text-neutral-200">{getFieldValue(drink, field)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnverifiedBadge({ drink }: { drink: Drink }) {
  if (!drink.verify) return null;
  return (
    <div className="mt-2 space-y-1">
      <span className="inline-block rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-xs text-amber-400">
        unverified
      </span>
      <p className="text-xs text-amber-400">{drink.verify}</p>
    </div>
  );
}

export default function ReverseRecall() {
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
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const [missed, setMissed] = useState<MissedEntry[]>([]);
  const [finished, setFinished] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const current = round[index];
  const canAdvance = result !== null && result !== "close-pending";

  useEffect(() => {
    if (!finished && inputRef.current && result === null) {
      inputRef.current.focus();
    }
  }, [index, finished, result]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && canAdvance && !finished) {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAdvance, finished, index, round]);

  if (pool.length === 0) {
    return (
      <Layout title="Reverse Recall">
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

  function handleSubmit() {
    if (result !== null) return;
    const { drink } = current;
    const match = fuzzyMatchName(guess, drink.name);
    if (match === "exact") {
      setResult("exact");
      recordResult(current.deck.id, drink.id, true);
    } else if (match === "wrong") {
      setResult("wrong");
      recordResult(current.deck.id, drink.id, false);
      setMissed((m) => [...m, { deckDrink: current, guess }]);
    } else {
      setResult("close-pending");
    }
  }

  function handleSelfGrade(correct: boolean) {
    const { drink } = current;
    recordResult(current.deck.id, drink.id, correct);
    setResult(correct ? "close-correct" : "close-wrong");
    if (!correct) {
      setMissed((m) => [...m, { deckDrink: current, guess }]);
    }
  }

  function goNext() {
    if (index + 1 >= round.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setGuess("");
    setResult(null);
  }

  function playAgain() {
    setRound(buildRound(pool));
    setIndex(0);
    setGuess("");
    setResult(null);
    setMissed([]);
    setFinished(false);
  }

  if (finished) {
    return (
      <Layout title="Reverse Recall">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Round complete</h2>
          <p className="text-neutral-400">
            {round.length - missed.length} / {round.length} correct.
          </p>
          {missed.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Missed</h3>
              <div className="space-y-3">
                {missed.map((m, i) => (
                  <div key={i} className="rounded-lg border border-red-900/60 bg-red-950/20 p-4">
                    <BuildCard drink={m.deckDrink.drink} />
                    <div className="mt-3 space-y-1 text-sm">
                      <p className="text-neutral-400">
                        Your guess: <span className="text-red-300">{m.guess || "(blank)"}</span>
                      </p>
                      <p className="text-neutral-400">
                        Correct: <span className="text-emerald-300">{m.deckDrink.drink.name}</span>
                      </p>
                    </div>
                    <UnverifiedBadge drink={m.deckDrink.drink} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-emerald-400">Perfect round. Nice work.</p>
          )}
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
    <Layout title="Reverse Recall">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          Question {index + 1} of {round.length}
        </p>

        <BuildCard drink={drink} />

        <div>
          <input
            ref={inputRef}
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            disabled={result !== null}
            placeholder="Name this drink..."
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-lg text-neutral-100 placeholder-neutral-600 outline-none focus:border-emerald-600 disabled:opacity-70"
          />
        </div>

        {result === null && (
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
          >
            Submit
          </button>
        )}

        {result === "exact" && (
          <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-emerald-300">
            Correct — {drink.name} <span className="text-xs text-emerald-400/70">({deck.name})</span>
            <UnverifiedBadge drink={drink} />
          </div>
        )}

        {result === "wrong" && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">
            Not quite. Correct answer:{" "}
            <span className="font-medium">
              {drink.name} <span className="text-xs font-normal text-red-400/70">({deck.name})</span>
            </span>
            <UnverifiedBadge drink={drink} />
          </div>
        )}

        {result === "close-pending" && (
          <div className="rounded-lg border border-amber-700 bg-amber-950/40 p-4 text-amber-300">
            <p>Close — check spelling. Correct spelling: <span className="font-medium">{drink.name}</span></p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => handleSelfGrade(true)}
                className="rounded-lg border border-emerald-700 bg-emerald-900/40 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-900/60"
              >
                Count as correct
              </button>
              <button
                type="button"
                onClick={() => handleSelfGrade(false)}
                className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/60"
              >
                Count as wrong
              </button>
            </div>
          </div>
        )}

        {result === "close-correct" && (
          <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-emerald-300">
            Marked correct — {drink.name} <span className="text-xs text-emerald-400/70">({deck.name})</span>
            <UnverifiedBadge drink={drink} />
          </div>
        )}

        {result === "close-wrong" && (
          <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">
            Marked wrong. Correct answer:{" "}
            <span className="font-medium">
              {drink.name} <span className="text-xs font-normal text-red-400/70">({deck.name})</span>
            </span>
            <UnverifiedBadge drink={drink} />
          </div>
        )}

        {canAdvance && (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-neutral-200 hover:bg-neutral-900"
          >
            Next (Space)
          </button>
        )}
      </div>
    </Layout>
  );
}
