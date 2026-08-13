import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { fuzzyMatchName, getFilteredDrinks, pickRandom, type DeckDrink } from "../lib/quiz";
import { Badge, Button, Card, EmptyState, ProgressBar, SectionTitle } from "../components/ui";

const MIN_TICKETS = 5;
const MAX_TICKETS = 8;

function pickTicketCount(poolSize: number): number {
  const max = Math.min(MAX_TICKETS, poolSize);
  const min = Math.min(MIN_TICKETS, max);
  if (max <= min) return max;
  return min + Math.floor(Math.random() * (max - min + 1));
}

interface TicketResult {
  drink: DeckDrink;
  glassGuess: string;
  baseGuess: string;
  glassCorrect: boolean;
  baseCorrect: boolean;
}

function isCorrect(guess: string, target: string): boolean {
  const result = fuzzyMatchName(guess, target);
  return result === "exact" || result === "close";
}

function formatElapsed(ms: number): string {
  const totalMs = Math.max(0, ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const tenths = Math.floor((totalMs % 1000) / 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}

type RoundState = "playing" | "done";

export default function TicketMode() {
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const recordResult = useProgressStore((s) => s.recordResult);
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter, skippedDrinks);
  }, [selectedDeckIds, tierFilter, categoryFilter, skippedDrinks]);

  const [tickets, setTickets] = useState<DeckDrink[]>(() =>
    pool.length > 0 ? pickRandom(pool, pickTicketCount(pool.length)) : []
  );
  const [index, setIndex] = useState(0);
  const [glassInput, setGlassInput] = useState("");
  const [baseInput, setBaseInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<TicketResult[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [roundState, setRoundState] = useState<RoundState>(pool.length > 0 ? "playing" : "done");

  const startTimeRef = useRef<number>(Date.now());
  const glassRef = useRef<HTMLInputElement>(null);
  const baseRef = useRef<HTMLInputElement>(null);

  function startRound() {
    const freshTickets = pickRandom(pool, pickTicketCount(pool.length));
    setTickets(freshTickets);
    setIndex(0);
    setGlassInput("");
    setBaseInput("");
    setRevealed(false);
    setResults([]);
    setElapsedMs(0);
    startTimeRef.current = Date.now();
    setRoundState(freshTickets.length > 0 ? "playing" : "done");
  }

  // Running stopwatch
  useEffect(() => {
    if (roundState !== "playing") return;
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
    return () => clearInterval(interval);
  }, [roundState]);

  // Focus glass input on each new ticket
  useEffect(() => {
    if (roundState === "playing" && !revealed) glassRef.current?.focus();
  }, [index, revealed, roundState]);

  // While revealed, Enter advances to next ticket (or finishes round)
  useEffect(() => {
    if (!revealed) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, index, tickets]);

  function submitTicket() {
    if (revealed || roundState !== "playing") return;
    const current = tickets[index];
    if (!current) return;

    const glassOk = isCorrect(glassInput, current.drink.glass);
    const baseOk = isCorrect(baseInput, current.drink.base);

    setResults((r) => [
      ...r,
      {
        drink: current,
        glassGuess: glassInput,
        baseGuess: baseInput,
        glassCorrect: glassOk,
        baseCorrect: baseOk,
      },
    ]);

    recordResult(current.deck.id, current.drink.id, glassOk, "glass");
    recordResult(current.deck.id, current.drink.id, baseOk, "base");

    setRevealed(true);
  }

  function advance() {
    if (index + 1 >= tickets.length) {
      setRoundState("done");
      return;
    }
    setIndex((i) => i + 1);
    setGlassInput("");
    setBaseInput("");
    setRevealed(false);
  }

  function handleGlassKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      baseRef.current?.focus();
    }
  }

  function handleBaseKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitTicket();
    }
  }

  if (pool.length === 0) {
    return (
      <Layout title="Ticket Mode">
        <EmptyState title="No drinks in this pool">
          No drinks match your current selection. Go back home and select a deck (and check your
          tier/category filters).
        </EmptyState>
      </Layout>
    );
  }

  if (roundState === "done") {
    const glassCorrectCount = results.filter((r) => r.glassCorrect).length;
    const baseCorrectCount = results.filter((r) => r.baseCorrect).length;
    const missed = results.filter((r) => !r.glassCorrect || !r.baseCorrect);
    const total = results.length * 2;
    const pct = total > 0 ? ((glassCorrectCount + baseCorrectCount) / total) * 100 : 0;

    return (
      <Layout title="Ticket Mode">
        <div className="space-y-6">
          <Card accent="border-l-emerald-600" className="p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Shift time
            </p>
            <div className="mt-2 text-6xl font-bold tabular-nums text-emerald-400">
              {formatElapsed(elapsedMs)}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="text-xs uppercase tracking-widest text-neutral-500">Glass</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-100">
                  {glassCorrectCount}
                  <span className="text-sm text-neutral-500">/{results.length}</span>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
                <div className="text-xs uppercase tracking-widest text-neutral-500">Base</div>
                <div className="mt-0.5 text-xl font-semibold tabular-nums text-neutral-100">
                  {baseCorrectCount}
                  <span className="text-sm text-neutral-500">/{results.length}</span>
                </div>
              </div>
            </div>
            <ProgressBar pct={pct} className="mt-4" />
          </Card>

          {missed.length > 0 && (
            <div>
              <SectionTitle
                right={
                  <span className="text-xs tabular-nums text-neutral-500">{missed.length}</span>
                }
              >
                Tickets with misses
              </SectionTitle>
              <div className="space-y-2">
                {missed.map((r, i) => (
                  <Card key={i} accent="border-l-red-700" className="p-3">
                    <div className="font-medium text-neutral-50">{r.drink.drink.name}</div>
                    {!r.glassCorrect && (
                      <div className="mt-1 text-sm">
                        <span className="text-red-400">Glass: {r.glassGuess || "(blank)"}</span>
                        <span className="text-neutral-500"> &mdash; correct: </span>
                        <span className="text-emerald-400">{r.drink.drink.glass}</span>
                      </div>
                    )}
                    {!r.baseCorrect && (
                      <div className="mt-1 text-sm">
                        <span className="text-red-400">Base: {r.baseGuess || "(blank)"}</span>
                        <span className="text-neutral-500"> &mdash; correct: </span>
                        <span className="text-emerald-400">{r.drink.drink.base}</span>
                      </div>
                    )}
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

  const current = tickets[index];
  const lastResult = revealed ? results[results.length - 1] : null;

  function fieldClass(ok: boolean | undefined) {
    if (!revealed) return "border-neutral-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";
    return ok
      ? "border-emerald-500 bg-emerald-950/30 text-emerald-100"
      : "border-red-500 bg-red-950/30 text-red-100";
  }

  return (
    <Layout title="Ticket Mode">
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 flex items-end justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Ticket {index + 1} of {tickets.length}
            </span>
            <span className="text-3xl font-bold leading-none tabular-nums text-neutral-50">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <ProgressBar pct={((index + (revealed ? 1 : 0)) / tickets.length) * 100} />
        </div>

        <Card className="border-dashed bg-neutral-950/60 p-6 text-center">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Ticket
          </div>
          <div className="font-mono text-3xl font-bold leading-tight text-neutral-50">
            {current?.drink.name}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {current ? (
              <Badge className="border-fuchsia-800 bg-fuchsia-950/40 text-fuchsia-300">
                {current.deck.name}
              </Badge>
            ) : null}
            {current?.drink.verify ? (
              <Badge className="border-amber-800 bg-amber-950/50 text-amber-400">unverified</Badge>
            ) : null}
          </div>
          {current?.drink.verify && (
            <p className="mt-2 text-xs leading-relaxed text-amber-400">{current.drink.verify}</p>
          )}
        </Card>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Glass
            </label>
            <input
              ref={glassRef}
              type="text"
              value={glassInput}
              onChange={(e) => setGlassInput(e.target.value)}
              onKeyDown={handleGlassKeyDown}
              disabled={revealed}
              autoComplete="off"
              className={`min-h-[52px] w-full rounded-xl border-2 bg-neutral-900 px-4 py-2 text-lg text-neutral-100 outline-none transition-colors duration-100 ${fieldClass(
                lastResult?.glassCorrect
              )}`}
            />
            {revealed && !lastResult?.glassCorrect && (
              <p className="mt-1 text-sm text-emerald-400">Correct: {current?.drink.glass}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Base
            </label>
            <input
              ref={baseRef}
              type="text"
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              onKeyDown={handleBaseKeyDown}
              disabled={revealed}
              autoComplete="off"
              className={`min-h-[52px] w-full rounded-xl border-2 bg-neutral-900 px-4 py-2 text-lg text-neutral-100 outline-none transition-colors duration-100 ${fieldClass(
                lastResult?.baseCorrect
              )}`}
            />
            {revealed && !lastResult?.baseCorrect && (
              <p className="mt-1 text-sm text-emerald-400">Correct: {current?.drink.base}</p>
            )}
          </div>
        </div>

        <Button
          variant={revealed ? "secondary" : "primary"}
          size="lg"
          className="w-full"
          onClick={revealed ? advance : submitTicket}
        >
          {revealed ? (index + 1 >= tickets.length ? "Finish" : "Next ticket") : "Fire"}
          <span className="text-xs opacity-60">(Enter)</span>
        </Button>
      </div>
    </Layout>
  );
}
