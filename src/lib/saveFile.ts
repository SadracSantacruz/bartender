import type { DrinkField } from "../types";
import type { DrinkStats } from "../store/progressStore";

/**
 * Save-file format. There's no backend, so a user's progress lives in
 * localStorage — which is per-browser and easy to lose (clearing site data,
 * new phone, different browser). Exporting to a file is the only way to move
 * or back up progress.
 *
 * `version` exists so a future format change can migrate old files instead of
 * rejecting them.
 */
export const SAVE_VERSION = 1;

export interface SaveFile {
  format: "bar-drill-save";
  version: number;
  exportedAt: string;
  stats: Record<string, DrinkStats>;
  savedDrinks: Record<string, true>;
  skippedDrinks: Record<string, true>;
  personalNotes: Record<string, string>;
  shakyFields: Record<string, DrinkField[]>;
}

export interface SavePayload {
  stats: Record<string, DrinkStats>;
  savedDrinks: Record<string, true>;
  skippedDrinks: Record<string, true>;
  personalNotes: Record<string, string>;
  shakyFields: Record<string, DrinkField[]>;
}

export function buildSaveFile(payload: SavePayload, now: Date): SaveFile {
  return {
    format: "bar-drill-save",
    version: SAVE_VERSION,
    exportedAt: now.toISOString(),
    stats: payload.stats,
    savedDrinks: payload.savedDrinks,
    skippedDrinks: payload.skippedDrinks,
    personalNotes: payload.personalNotes,
    shakyFields: payload.shakyFields,
  };
}

export interface SaveSummary {
  exportedAt: string | null;
  drinksTracked: number;
  totalAnswers: number;
  totalCorrect: number;
  savedCount: number;
  skippedCount: number;
  noteCount: number;
  shakyCount: number;
}

export function summarizeSave(save: SavePayload & { exportedAt?: string }): SaveSummary {
  let totalAnswers = 0;
  let totalCorrect = 0;
  for (const s of Object.values(save.stats)) {
    totalAnswers += s.seen;
    totalCorrect += s.correct;
  }
  return {
    exportedAt: save.exportedAt ?? null,
    drinksTracked: Object.keys(save.stats).length,
    totalAnswers,
    totalCorrect,
    savedCount: Object.keys(save.savedDrinks).length,
    skippedCount: Object.keys(save.skippedDrinks).length,
    noteCount: Object.keys(save.personalNotes).length,
    shakyCount: Object.keys(save.shakyFields).length,
  };
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  save?: SaveFile;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseStats(raw: unknown): Record<string, DrinkStats> | null {
  if (!isPlainObject(raw)) return null;
  const out: Record<string, DrinkStats> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isPlainObject(value)) return null;
    const { seen, correct, lastSeen, leitnerBox, fields } = value;
    if (
      typeof seen !== "number" ||
      typeof correct !== "number" ||
      typeof lastSeen !== "number" ||
      typeof leitnerBox !== "number"
    ) {
      return null;
    }
    const parsedFields: DrinkStats["fields"] = {};
    if (fields !== undefined) {
      if (!isPlainObject(fields)) return null;
      for (const [f, stat] of Object.entries(fields)) {
        if (!isPlainObject(stat)) return null;
        if (typeof stat.seen !== "number" || typeof stat.correct !== "number") return null;
        parsedFields[f as DrinkField] = { seen: stat.seen, correct: stat.correct };
      }
    }
    out[key] = { seen, correct, lastSeen, leitnerBox, fields: parsedFields };
  }
  return out;
}

function parseFlagMap(raw: unknown): Record<string, true> | null {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) return null;
  const out: Record<string, true> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === true) out[key] = true;
  }
  return out;
}

function parseStringMap(raw: unknown): Record<string, string> | null {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") return null;
    out[key] = value;
  }
  return out;
}

function parseFieldListMap(raw: unknown): Record<string, DrinkField[]> | null {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) return null;
  const out: Record<string, DrinkField[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) return null;
    out[key] = value as DrinkField[];
  }
  return out;
}

export function parseSaveFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `That file isn't valid JSON: ${(e as Error).message}` };
  }

  if (!isPlainObject(raw)) {
    return { ok: false, error: "That file doesn't look like a save file (expected a JSON object)." };
  }

  if (raw.format !== "bar-drill-save") {
    return {
      ok: false,
      error:
        "That file isn't a Bar Drill save file. Make sure you're picking the file you exported from this app, not a deck file.",
    };
  }

  if (typeof raw.version !== "number" || raw.version > SAVE_VERSION) {
    return {
      ok: false,
      error: `That save file was made by a newer version of the app (file version ${String(
        raw.version
      )}, this app understands up to ${SAVE_VERSION}).`,
    };
  }

  const stats = parseStats(raw.stats);
  if (!stats) return { ok: false, error: "The save file's progress data is malformed." };

  const savedDrinks = parseFlagMap(raw.savedDrinks);
  const skippedDrinks = parseFlagMap(raw.skippedDrinks);
  const personalNotes = parseStringMap(raw.personalNotes);
  const shakyFields = parseFieldListMap(raw.shakyFields);

  if (!savedDrinks || !skippedDrinks || !personalNotes || !shakyFields) {
    return { ok: false, error: "The save file's flags or notes are malformed." };
  }

  return {
    ok: true,
    save: {
      format: "bar-drill-save",
      version: raw.version,
      exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
      stats,
      savedDrinks,
      skippedDrinks,
      personalNotes,
      shakyFields,
    },
  };
}

/**
 * Merge an incoming save into existing progress rather than replacing it.
 * Per drink, the entry with more answers recorded wins (that's the one with
 * more real drilling behind it); flags and notes union, with the incoming
 * file winning ties on notes.
 */
export function mergeSaves(current: SavePayload, incoming: SavePayload): SavePayload {
  const stats: Record<string, DrinkStats> = { ...current.stats };
  for (const [key, incomingStat] of Object.entries(incoming.stats)) {
    const existing = stats[key];
    if (!existing || incomingStat.seen >= existing.seen) {
      stats[key] = incomingStat;
    }
  }
  return {
    stats,
    savedDrinks: { ...current.savedDrinks, ...incoming.savedDrinks },
    skippedDrinks: { ...current.skippedDrinks, ...incoming.skippedDrinks },
    personalNotes: { ...current.personalNotes, ...incoming.personalNotes },
    shakyFields: { ...current.shakyFields, ...incoming.shakyFields },
  };
}

export function saveFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `bar-drill-save-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}.json`;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
