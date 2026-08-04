import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { fuzzyMatchName, getFilteredDrinks, pickRandom, type DeckDrink } from "../lib/quiz";

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

  const pool = useMemo(() => {
    const decks = LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck);
    return getFilteredDrinks(decks, tierFilter, categoryFilter);
  }, [selectedDeckIds, tierFilter, categoryFilter]);

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
        <p className="text-neutral-400">
          No drinks match your current selection. Go back home and select a deck (and check your
          tier/category filters).
        </p>
      </Layout>
    );
  }

  if (roundState === "done") {
    const glassCorrectCount = results.filter((r) => r.glassCorrect).length;
    const baseCorrectCount = results.filter((r) => r.baseCorrect).length;
    const missed = results.filter((r) => !r.glassCorrect || !r.baseCorrect);

    return (
      <Layout title="Ticket Mode">
        <div className="space-y-6">
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 text-center">
            <div className="text-4xl font-bold tabular-nums text-emerald-400">
              {formatElapsed(elapsedMs)}
            </div>
            <p className="mt-1 text-neutral-400">
              Glass: {glassCorrectCount}/{results.length} - Base: {baseCorrectCount}/{results.length}
            </p>
          </div>

          {missed.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
                Tickets with misses
              </h2>
              <div className="space-y-2">
                {missed.map((r, i) => (
                  <div key={i} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3">
                    <div className="font-medium text-neutral-200">{r.drink.drink.name}</div>
                    {!r.glassCorrect && (
                      <div className="mt-1 text-sm">
                        <span className="text-red-400">Glass: {r.glassGuess || "(blank)"}</span>
                        <span className="text-neutral-500"> -- correct: </span>
                        <span className="text-emerald-400">{r.drink.drink.glass}</span>
                      </div>
                    )}
                    {!r.baseCorrect && (
                      <div className="mt-1 text-sm">
                        <span className="text-red-400">Base: {r.baseGuess || "(blank)"}</span>
                        <span className="text-neutral-500"> -- correct: </span>
                        <span className="text-emerald-400">{r.drink.drink.base}</span>
                      </div>
                    )}
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

  const current = tickets[index];
  const lastResult = revealed ? results[results.length - 1] : null;

  return (
    <Layout title="Ticket Mode">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-neutral-500">
            Ticket {index + 1} of {tickets.length}
          </div>
          <div className="text-2xl font-bold tabular-nums text-neutral-100">
            {formatElapsed(elapsedMs)}
          </div>
        </div>

        <div className="rounded-lg border-2 border-dashed border-neutral-700 bg-neutral-900/50 p-6 text-center">
          <div className="mb-1 text-xs uppercase tracking-widest text-neutral-500">Ticket</div>
          <div className="font-mono text-2xl font-semibold text-neutral-100">
            {current?.drink.name}
            {current?.drink.verify ? (
              <span className="ml-2 align-middle rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-xs font-sans text-amber-400">
                unverified
              </span>
            ) : null}
          </div>
          {current?.drink.verify && (
            <p className="mt-2 text-xs text-amber-400">{current.drink.verify}</p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-500">Glass</label>
            <input
              ref={glassRef}
              type="text"
              value={glassInput}
              onChange={(e) => setGlassInput(e.target.value)}
              onKeyDown={handleGlassKeyDown}
              disabled={revealed}
              autoComplete="off"
              className={`min-h-[48px] w-full rounded-lg border-2 bg-neutral-900 px-4 py-2 text-lg text-neutral-100 outline-none transition-colors duration-150 ${
                revealed
                  ? lastResult?.glassCorrect
                    ? "border-emerald-500"
                    : "border-red-500"
                  : "border-neutral-700 focus:border-neutral-500"
              }`}
            />
            {revealed && !lastResult?.glassCorrect && (
              <p className="mt-1 text-sm text-emerald-400">Correct: {current?.drink.glass}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-500">Base</label>
            <input
              ref={baseRef}
              type="text"
              value={baseInput}
              onChange={(e) => setBaseInput(e.target.value)}
              onKeyDown={handleBaseKeyDown}
              disabled={revealed}
              autoComplete="off"
              className={`min-h-[48px] w-full rounded-lg border-2 bg-neutral-900 px-4 py-2 text-lg text-neutral-100 outline-none transition-colors duration-150 ${
                revealed
                  ? lastResult?.baseCorrect
                    ? "border-emerald-500"
                    : "border-red-500"
                  : "border-neutral-700 focus:border-neutral-500"
              }`}
            />
            {revealed && !lastResult?.baseCorrect && (
              <p className="mt-1 text-sm text-emerald-400">Correct: {current?.drink.base}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={revealed ? advance : submitTicket}
          className="min-h-[52px] w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 font-medium text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700"
        >
          {revealed ? (index + 1 >= tickets.length ? "Finish" : "Next ticket") : "Fire"}
        </button>
      </div>
    </Layout>
  );
}