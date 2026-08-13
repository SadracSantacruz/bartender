import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared visual primitives. Every screen composes these so spacing, radii,
 * borders and tap-target sizes stay consistent — especially important since
 * this app is used one-handed on a phone in a dim bar.
 *
 * Palette lives in index.css as `ink-*` (warm dark ramp) and `brass-*` (brand).
 */

export function Card({
  children,
  className = "",
  accent,
  muted,
  glow,
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind border-color class for the 4px left accent stripe. */
  accent?: string;
  muted?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-ink-800 bg-ink-900/80 shadow-lg shadow-black/40 ${
        accent ? `border-l-4 ${accent}` : ""
      } ${glow ? "ring-1 ring-brass-500/20" : ""} ${muted ? "opacity-45 saturate-50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brass-500">
        {children}
      </h2>
      {right}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warn" | "success";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-brass-500/60 bg-gradient-to-b from-brass-400/25 to-brass-600/15 text-brass-300 hover:from-brass-400/35 hover:to-brass-600/25 hover:border-brass-400 active:from-brass-400/45",
  success:
    "border-emerald-500/60 bg-gradient-to-b from-emerald-400/25 to-emerald-600/15 text-emerald-300 hover:from-emerald-400/35 hover:border-emerald-400",
  secondary:
    "border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-600 hover:bg-ink-800 active:bg-ink-700",
  ghost: "border-transparent bg-transparent text-ink-400 hover:bg-ink-850 hover:text-ink-100",
  danger:
    "border-rose-600/60 bg-gradient-to-b from-rose-500/25 to-rose-700/15 text-rose-300 hover:border-rose-500 hover:from-rose-500/35",
  warn: "border-amber-500/60 bg-gradient-to-b from-amber-400/25 to-amber-600/15 text-amber-300 hover:border-amber-400 hover:from-amber-400/35",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "min-h-[38px] px-3.5 py-1.5 text-sm",
    md: "min-h-[46px] px-5 py-2 text-sm",
    lg: "min-h-[54px] px-6 py-3 text-base",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-semibold tracking-tight shadow-sm shadow-black/30 transition-all duration-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 ${VARIANTS[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  onClick,
  label,
  activeClass,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClass?: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[38px] rounded-full border px-3.5 py-1 text-sm font-medium transition-all duration-100 active:scale-[0.97] ${
        active
          ? (activeClass ??
            "border-brass-500 bg-brass-500/20 text-brass-300 shadow-sm shadow-brass-900/40")
          : "border-ink-700 bg-ink-850/80 text-ink-400 hover:border-ink-600 hover:text-ink-200"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 tabular-nums opacity-60">{count}</span>}
    </button>
  );
}

export function Badge({
  children,
  className = "",
  plain,
}: {
  children: ReactNode;
  className?: string;
  /**
   * Skip the uppercase treatment. Short labels ("TIER 1") read well shouted;
   * long values like a full pour spec do not.
   */
  plain?: boolean;
}) {
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-tight ${
        plain ? "" : "uppercase tracking-wide"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  pct,
  className = "",
  tone = "score",
}: {
  pct: number;
  className?: string;
  /**
   * "score" grades the value green/amber/red — use it for accuracy.
   * "brand" is a flat brass fill — use it for "how far through this round am
   * I", where a low value means "just started", not "doing badly".
   */
  tone?: "score" | "brand";
}) {
  const color =
    tone === "brand"
      ? "from-brass-600 to-brass-400"
      : pct >= 80
        ? "from-emerald-500 to-emerald-400"
        : pct >= 50
          ? "from-amber-500 to-amber-400"
          : "from-rose-600 to-rose-500";
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-ink-800 ${className}`}>
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-150 ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-10 text-center">
      <p className="font-display text-xl font-semibold text-ink-100">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-sm text-sm text-ink-400">{children}</div>}
    </Card>
  );
}

export const accuracyText = (pct: number) =>
  pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-rose-400";
