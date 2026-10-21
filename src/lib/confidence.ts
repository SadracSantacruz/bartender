import type { Confidence } from "../store/progressStore";

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  got: "Got it",
  kinda: "Kind of got it",
  nope: "Don't got it",
};

/** Selected/emphasized styling for each rating. */
export const CONFIDENCE_ACTIVE: Record<Confidence, string> = {
  got: "border-emerald-600 bg-emerald-900/40 text-emerald-200",
  kinda: "border-yellow-600 bg-yellow-900/40 text-yellow-200",
  nope: "border-rose-600 bg-rose-900/40 text-rose-200",
};
