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
import {
  accuracyText,
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
} from "../components/ui";

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

function BuildCard({ drink, className = "" }: { drink: Drink; className?: string }) {
  const fields = DRINK_FIELDS.filter((f) => isFieldDocumented(drink, f));
  return (
    <Card className={`p-5 ${className}`}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field} className="flex flex-col gap-0.5">
            <span className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-brass-500">
              {FIELD_LABELS[field]}
            </span>
            <span className="text-lg font-medium leading-snug text-ink-100">
              {getFieldValue(drink, field)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function UnverifiedBadge({ drink }: { drink: Drink }) {
  if (!drink.verify) return null;
  return (
    <div className="mt-3 space-y-1">
      <Badge className="border-amber-600/60 bg-amber-950/60 text-amber-300">unverified</Badge>
      <p className="text-xs leading-relaxed text-amber-200/90">{drink.verify}</p>
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
        <EmptyState title="No drinks in this pool">
          No drinks match your current selection. Go back{" "}
          <button className="font-medium text-brass-400 underline underline-offset-2" onClick={() => navigate("home")}>
            Home
          </button>{" "}
          and pick a deck.
        </EmptyState>
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
    const correctCount = round.length - missed.length;
    const pct = round.length > 0 ? (correctCount / round.length) * 100 : 0;
    return (
      <Layout title="Reverse Recall">
        <div className="space-y-6">
          <Card accent="border-l-emerald-600" className="p-6 text-center">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brass-500">
              Round complete
            </p>
            <div
              className={`mt-2 font-display text-5xl font-bold tabular-nums ${accuracyText(pct)}`}
            >
              {correctCount}
              <span className="text-2xl font-semibold text-ink-500">/{round.length}</span>
            </div>
            <p className="mt-1 text-sm text-ink-400">correct</p>
            <ProgressBar pct={pct} className="mt-4" />
          </Card>

          {missed.length > 0 ? (
            <div>
              <SectionTitle
                right={
                  <span className="text-xs tabular-nums text-ink-400">{missed.length}</span>
                }
              >
                Missed
              </SectionTitle>
              <div className="space-y-3">
                {missed.map((m, i) => (
                  <Card key={i} accent="border-l-rose-600" className="p-4">
                    <div className="font-display text-xl font-semibold text-ink-100">
                      {m.deckDrink.drink.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge className="border-fuchsia-700/70 bg-fuchsia-950/50 text-fuchsia-300">
                        {m.deckDrink.deck.name}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-400">
                      Your guess: <span className="text-rose-300">{m.guess || "(blank)"}</span>
                    </p>
                    <BuildCard drink={m.deckDrink.drink} className="mt-3 bg-ink-950/40" />
                    <UnverifiedBadge drink={m.deckDrink.drink} />
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card accent="border-l-emerald-600" className="p-4 text-emerald-300">
              Perfect round. Nice work.
            </Card>
          )}

          <Button variant="primary" size="lg" className="w-full" onClick={playAgain}>
            Play again
          </Button>
        </div>
      </Layout>
    );
  }

  const { deck, drink } = current;

  return (
    <Layout title="Reverse Recall">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brass-500">
              Question <span className="tabular-nums">{index + 1}</span> of{" "}
              <span className="tabular-nums">{round.length}</span>
            </span>
            <span className="text-xs tabular-nums text-ink-400">
              {index - missed.length + (canAdvance ? 1 : 0)} correct
            </span>
          </div>
          <ProgressBar tone="brand" pct={((index + (canAdvance ? 1 : 0)) / round.length) * 100} />
        </div>

        <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brass-500">
          Name this build
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
            className="min-h-[60px] w-full rounded-xl border-2 border-ink-700 bg-ink-900/80 px-4 py-3 font-display text-xl text-ink-100 shadow-inner shadow-black/30 outline-none transition-colors duration-100 placeholder:font-sans placeholder:text-base placeholder:text-ink-500 focus:border-brass-500 focus:ring-2 focus:ring-brass-500/30 disabled:opacity-70"
          />
        </div>

        {result === null && (
          <Button variant="secondary" size="lg" className="w-full" onClick={handleSubmit}>
            Submit <span className="text-xs font-normal text-ink-400">(Enter)</span>
          </Button>
        )}

        {result === "exact" && (
          <Card accent="border-l-emerald-500" glow className="bg-emerald-950/50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none text-emerald-400">&#10003;</span>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Correct
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-emerald-100">{drink.name}</p>
                <Badge className="mt-2 border-fuchsia-700/70 bg-fuchsia-950/50 text-fuchsia-300">
                  {deck.name}
                </Badge>
                <UnverifiedBadge drink={drink} />
              </div>
            </div>
          </Card>
        )}

        {result === "wrong" && (
          <Card accent="border-l-rose-500" className="bg-rose-950/50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none text-rose-400">&#10007;</span>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
                  Not quite &mdash; correct answer
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-rose-100">{drink.name}</p>
                <Badge className="mt-2 border-fuchsia-700/70 bg-fuchsia-950/50 text-fuchsia-300">
                  {deck.name}
                </Badge>
                <UnverifiedBadge drink={drink} />
              </div>
            </div>
          </Card>
        )}

        {result === "close-pending" && (
          <Card accent="border-l-amber-500" className="bg-amber-950/50 p-5">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
              Close &mdash; check spelling
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-amber-100">{drink.name}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="primary" size="lg" onClick={() => handleSelfGrade(true)}>
                Count as correct
              </Button>
              <Button variant="danger" size="lg" onClick={() => handleSelfGrade(false)}>
                Count as wrong
              </Button>
            </div>
          </Card>
        )}

        {result === "close-correct" && (
          <Card accent="border-l-emerald-500" glow className="bg-emerald-950/50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none text-emerald-400">&#10003;</span>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Marked correct
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-emerald-100">{drink.name}</p>
                <Badge className="mt-2 border-fuchsia-700/70 bg-fuchsia-950/50 text-fuchsia-300">
                  {deck.name}
                </Badge>
                <UnverifiedBadge drink={drink} />
              </div>
            </div>
          </Card>
        )}

        {result === "close-wrong" && (
          <Card accent="border-l-rose-500" className="bg-rose-950/50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none text-rose-400">&#10007;</span>
              <div>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-rose-400">
                  Marked wrong &mdash; correct answer
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-rose-100">{drink.name}</p>
                <Badge className="mt-2 border-fuchsia-700/70 bg-fuchsia-950/50 text-fuchsia-300">
                  {deck.name}
                </Badge>
                <UnverifiedBadge drink={drink} />
              </div>
            </div>
          </Card>
        )}

        {canAdvance && (
          <Button variant="secondary" size="lg" className="w-full" onClick={goNext}>
            {index + 1 >= round.length ? "See results" : "Next"}
            <span className="text-xs font-normal text-ink-400">(Space)</span>
          </Button>
        )}
      </div>
    </Layout>
  );
}
