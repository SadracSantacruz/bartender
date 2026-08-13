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
import {
  accuracyText,
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
} from "../components/ui";

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

const INPUT_CLASS =
  "min-h-[48px] w-full rounded-lg border-2 border-neutral-700 bg-neutral-900 px-3 py-2 text-base text-neutral-100 placeholder-neutral-600 outline-none transition-colors duration-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-70";

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
    const cleanCount = summary.filter((e) => e.wrongFields.length === 0).length;
    const pct = summary.length > 0 ? (cleanCount / summary.length) * 100 : 0;
    return (
      <Layout title="Full Build Recall">
        <div className="space-y-6">
          <Card accent="border-l-emerald-600" className="p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Round complete
            </p>
            <div className={`mt-2 text-5xl font-bold tabular-nums ${accuracyText(pct)}`}>
              {cleanCount}
              <span className="text-2xl font-semibold text-neutral-500">/{summary.length}</span>
            </div>
            <p className="mt-1 text-sm text-neutral-400">clean builds</p>
            <ProgressBar pct={pct} className="mt-4" />
          </Card>

          <div>
            <SectionTitle>Every drink this round</SectionTitle>
            <div className="space-y-2">
              {summary.map((entry, i) => (
                <Card
                  key={i}
                  accent={
                    entry.wrongFields.length === 0 ? "border-l-emerald-600" : "border-l-red-700"
                  }
                  className="p-4"
                >
                  <div className="font-medium text-neutral-50">{entry.deckDrink.drink.name}</div>
                  {entry.wrongFields.length === 0 ? (
                    <p className="mt-1 text-sm text-emerald-400">All marked fields correct.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-neutral-500">Missed:</span>
                      {entry.wrongFields.map((f) => (
                        <Badge key={f} className="border-red-800 bg-red-950/50 text-red-300">
                          {FIELD_LABELS[f]}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          <Button variant="primary" size="lg" className="w-full" onClick={playAgain}>
            Play again
          </Button>
        </div>
      </Layout>
    );
  }

  const { deck, drink } = current;

  return (
    <Layout title="Full Build Recall">
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Drink {index + 1} of {round.length}
            </span>
            {revealed && (
              <span className="text-xs tabular-nums text-neutral-500">
                {documentedFields.filter((f) => grades[f] !== undefined).length}/
                {documentedFields.length} marked
              </span>
            )}
          </div>
          <ProgressBar pct={(index / round.length) * 100} />
        </div>

        <div>
          <h2 className="text-3xl font-bold leading-tight text-neutral-50">{drink.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="border-fuchsia-800 bg-fuchsia-950/40 text-fuchsia-300">
              {deck.name}
            </Badge>
            {drink.verify && (
              <Badge className="border-amber-800 bg-amber-950/50 text-amber-400">unverified</Badge>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {documentedFields.map((field, i) => {
            const graded = grades[field];
            const accent =
              graded === true
                ? "border-l-emerald-600"
                : graded === false
                  ? "border-l-red-700"
                  : undefined;
            return (
              <Card key={field} accent={accent} className="p-4">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  {FIELD_LABELS[field]}
                </div>
                {field === "ingredients" ? (
                  <textarea
                    value={answers[field] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [field]: e.target.value }))}
                    disabled={revealed}
                    rows={3}
                    placeholder="List ingredients..."
                    className={INPUT_CLASS}
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
                    className={INPUT_CLASS}
                  />
                )}

                {revealed && (
                  <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                        Correct
                      </div>
                      <div className="mt-0.5 text-base leading-snug text-emerald-300">
                        {getFieldValue(drink, field)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={graded === true ? "primary" : "secondary"}
                        size="md"
                        disabled={graded !== undefined}
                        onClick={() => handleGrade(field, true)}
                        className={graded === true ? "disabled:opacity-100! ring-2 ring-emerald-500/40" : ""}
                      >
                        &#10003; Got it
                      </Button>
                      <Button
                        variant={graded === false ? "danger" : "secondary"}
                        size="md"
                        disabled={graded !== undefined}
                        onClick={() => handleGrade(field, false)}
                        className={graded === false ? "disabled:opacity-100! ring-2 ring-red-500/40" : ""}
                      >
                        &#10007; Missed it
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {revealed && drink.verify && (
          <Card accent="border-l-amber-600" className="p-3">
            <div className="mb-1">
              <Badge className="border-amber-800 bg-amber-950/50 text-amber-400">unverified</Badge>
            </div>
            <p className="text-xs leading-relaxed text-amber-400">{drink.verify}</p>
          </Card>
        )}

        {!revealed ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={handleReveal}>
            Reveal <span className="text-xs text-neutral-500">(Enter)</span>
          </Button>
        ) : (
          <div className="space-y-2">
            {!allMarked && (
              <p className="text-sm text-neutral-500">
                Mark all fields above before moving on (or skip early).
              </p>
            )}
            <Button variant="primary" size="lg" className="w-full" onClick={goNext}>
              {index + 1 >= round.length ? "See results" : "Next drink"}
              <span className="text-xs text-emerald-500/70">(Space)</span>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
