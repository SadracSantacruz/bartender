import { useMemo, useRef, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { DRINK_FIELDS, type DrinkField } from "../types";
import { useProgressStore } from "../store/progressStore";
import {
  buildSaveFile,
  downloadJson,
  mergeSaves,
  parseSaveFile,
  saveFileName,
  summarizeSave,
  type SaveFile,
  type SaveSummary,
} from "../lib/saveFile";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionTitle,
  accuracyText,
} from "../components/ui";

const FIELD_LABELS: Record<DrinkField, string> = {
  base: "Base",
  glass: "Glass",
  serve: "Serve",
  rim: "Rim",
  garnish: "Garnish",
  ingredients: "Ingredients",
  prep: "Prep",
};

type Pending = { save: SaveFile; summary: SaveSummary; filename: string };

export default function Dashboard() {
  const getMasteryPercent = useProgressStore((s) => s.getMasteryPercent);
  const getDeckMastery = useProgressStore((s) => s.getDeckMastery);
  const getWeakest = useProgressStore((s) => s.getWeakest);
  const getFieldBreakdown = useProgressStore((s) => s.getFieldBreakdown);
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const exportPayload = useProgressStore((s) => s.exportPayload);
  const replaceProgress = useProgressStore((s) => s.replaceProgress);
  const stats = useProgressStore((s) => s.stats);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allKeys = useMemo(
    () =>
      LOADED_DECKS.flatMap(({ deck }) =>
        deck.drinks.map((drink) => ({ deckId: deck.id, drinkId: drink.id }))
      ),
    []
  );

  const hasAnyProgress = Object.keys(stats).length > 0;
  const overallMastery = getMasteryPercent(allKeys);
  const weakest = getWeakest(allKeys, 10);
  const fieldBreakdown = getFieldBreakdown(allKeys);

  const fieldEntries = useMemo(
    () =>
      DRINK_FIELDS.filter((f) => (fieldBreakdown[f]?.seen ?? 0) > 0)
        .map((f) => {
          const stat = fieldBreakdown[f]!;
          return { field: f, ...stat, pct: Math.round((stat.correct / stat.seen) * 100) };
        })
        .sort((a, b) => a.pct - b.pct),
    [fieldBreakdown]
  );

  const drinkLookup = useMemo(() => {
    const map = new Map<string, { drinkName: string; deckName: string }>();
    for (const { deck } of LOADED_DECKS) {
      for (const drink of deck.drinks) {
        map.set(`${deck.id}:${drink.id}`, { drinkName: drink.name, deckName: deck.name });
      }
    }
    return map;
  }, []);

  function showFlash(message: string) {
    setFlash(message);
    setTimeout(() => setFlash(null), 3000);
  }

  function handleExport() {
    const now = new Date();
    downloadJson(saveFileName(now), buildSaveFile(exportPayload(), now));
    showFlash("Save file downloaded. Keep it somewhere safe — that's your backup.");
  }

  async function handleFile(file: File) {
    setImportError(null);
    setPending(null);
    const text = await file.text();
    const result = parseSaveFile(text);
    if (!result.ok || !result.save) {
      setImportError(result.error ?? "Could not read that save file.");
      return;
    }
    setPending({
      save: result.save,
      summary: summarizeSave(result.save),
      filename: file.name,
    });
  }

  function applyPending(mode: "replace" | "merge") {
    if (!pending) return;
    const incoming = pending.save;
    if (mode === "replace") {
      replaceProgress(incoming);
    } else {
      replaceProgress(mergeSaves(exportPayload(), incoming));
    }
    setPending(null);
    showFlash(mode === "replace" ? "Progress restored from save file." : "Save file merged into your progress.");
  }

  return (
    <Layout title="Dashboard">
      <div className="space-y-8">
        {flash && (
          <div className="rounded-2xl border border-emerald-700/70 bg-emerald-950/40 p-3.5 text-sm text-emerald-200">
            {flash}
          </div>
        )}

        {!hasAnyProgress ? (
          <EmptyState title="No progress yet">
            Play a round in any mode to start tracking mastery — or restore a save file below.
          </EmptyState>
        ) : (
          <>
            <section>
              <SectionTitle>Overall Mastery</SectionTitle>
              <Card glow className="p-6">
                <div className="flex items-end justify-between gap-4">
                  <div
                    className={`font-display text-7xl font-bold leading-none tabular-nums ${accuracyText(
                      overallMastery
                    )}`}
                  >
                    {overallMastery}%
                  </div>
                  <div className="text-right text-sm text-ink-400">
                    <span className="tabular-nums">{Object.keys(stats).length}</span> drinks drilled
                  </div>
                </div>
                <ProgressBar pct={overallMastery} className="mt-5 h-3" />
              </Card>
            </section>

            <section>
              <SectionTitle>Per-Deck Mastery</SectionTitle>
              <div className="space-y-2">
                {LOADED_DECKS.map(({ deck }) => {
                  const pct = getDeckMastery(deck.id, deck.drinks.map((d) => d.id));
                  return (
                    <Card key={deck.id} className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-display font-semibold text-ink-100">{deck.name}</span>
                        <span
                          className={`font-display text-lg font-bold tabular-nums ${accuracyText(pct)}`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <ProgressBar pct={pct} className="h-1.5" />
                    </Card>
                  );
                })}
              </div>
            </section>

            <section>
              <SectionTitle>Weakest Drinks</SectionTitle>
              <div className="space-y-2">
                {weakest.map((entry) => {
                  const info = drinkLookup.get(`${entry.deckId}:${entry.drinkId}`);
                  const notYetDrilled = entry.stats.seen === 0;
                  const pct = notYetDrilled ? null : Math.round(entry.accuracy * 100);
                  return (
                    <Card
                      key={`${entry.deckId}:${entry.drinkId}`}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-display font-semibold text-ink-100">
                          {info?.drinkName ?? entry.drinkId}
                        </div>
                        <div className="truncate text-sm text-ink-400">
                          {info?.deckName ?? entry.deckId}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge className="border-ink-700 bg-ink-850 text-ink-300">
                          Box {entry.stats.leitnerBox}
                        </Badge>
                        {notYetDrilled ? (
                          <span className="text-sm text-ink-400">not yet drilled</span>
                        ) : (
                          <span
                            className={`font-display text-base font-bold tabular-nums ${accuracyText(pct!)}`}
                          >
                            {pct}%
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>

            {fieldEntries.length > 0 && (
              <section>
                <SectionTitle>Per-Field Breakdown</SectionTitle>
                <div className="space-y-2">
                  {fieldEntries.map((entry) => (
                    <Card key={entry.field} className="p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="font-display font-semibold text-ink-100">
                          {FIELD_LABELS[entry.field]}
                        </span>
                        <span
                          className={`font-display text-lg font-bold tabular-nums ${accuracyText(
                            entry.pct
                          )}`}
                        >
                          {entry.pct}%{" "}
                          <span className="text-sm font-normal text-ink-400">
                            ({entry.correct}/{entry.seen})
                          </span>
                        </span>
                      </div>
                      <ProgressBar pct={entry.pct} className="h-1.5" />
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section>
          <SectionTitle>Save File</SectionTitle>
          <Card accent="border-l-brass-500" className="space-y-4 p-5">
            <p className="text-sm leading-relaxed text-ink-300">
              Your progress lives in this browser only. Export a save file to back it up or move it to
              another phone or computer — then import it there to pick up where you left off.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleExport}>
                ⬇ Export save file
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                ⬆ Import save file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            {importError && (
              <div className="rounded-xl border border-rose-700/70 bg-rose-950/40 p-3 text-sm text-rose-200">
                {importError}
              </div>
            )}

            {pending && (
              <div className="rounded-2xl border border-amber-700/70 bg-amber-950/30 p-4">
                <div className="mb-1 font-display text-base font-semibold text-amber-200">
                  {pending.filename}
                </div>
                <p className="mb-3 text-xs text-amber-400/80">
                  {pending.summary.exportedAt
                    ? `Exported ${new Date(pending.summary.exportedAt).toLocaleString()}`
                    : "No export date recorded"}
                </p>
                <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-200 sm:grid-cols-3">
                  <Stat label="Drinks tracked" value={pending.summary.drinksTracked} />
                  <Stat label="Answers logged" value={pending.summary.totalAnswers} />
                  <Stat
                    label="Accuracy"
                    value={
                      pending.summary.totalAnswers > 0
                        ? `${Math.round(
                            (pending.summary.totalCorrect / pending.summary.totalAnswers) * 100
                          )}%`
                        : "—"
                    }
                  />
                  <Stat label="Saved" value={pending.summary.savedCount} />
                  <Stat label="Skipped" value={pending.summary.skippedCount} />
                  <Stat label="Notes" value={pending.summary.noteCount} />
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button variant="warn" onClick={() => applyPending("replace")}>
                    Replace my progress
                  </Button>
                  <Button variant="secondary" onClick={() => applyPending("merge")}>
                    Merge into my progress
                  </Button>
                  <Button variant="ghost" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-400">
                  <strong className="font-semibold text-ink-200">Replace</strong> wipes what's in this
                  browser and uses the file instead.{" "}
                  <strong className="font-semibold text-ink-200">Merge</strong> keeps both, preferring
                  whichever has more answers logged per drink.
                </p>
              </div>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>Danger Zone</SectionTitle>
          {!confirmingReset ? (
            <Button variant="danger" onClick={() => setConfirmingReset(true)}>
              Reset progress
            </Button>
          ) : (
            <Card accent="border-l-rose-600" className="border-rose-900/70 bg-rose-950/30 p-5">
              <p className="mb-3 text-sm leading-relaxed text-rose-200">
                This wipes all mastery data, saved/skipped flags, and personal notes in this browser.
                It cannot be undone — export a save file first if you might want it back.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    resetProgress();
                    setConfirmingReset(false);
                    showFlash("Progress reset.");
                  }}
                >
                  Yes, reset everything
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}
        </section>
      </div>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="font-display font-semibold tabular-nums text-ink-100">{value}</dd>
    </div>
  );
}
