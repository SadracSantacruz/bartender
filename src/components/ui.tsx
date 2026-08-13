import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Shared visual primitives. Every screen composes these so spacing, radii,
 * borders and tap-target sizes stay consistent — especially important since
 * this app is used one-handed on a phone in a dim bar.
 */

export function Card({
  children,
  className = "",
  accent,
  muted,
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind border-color class for the 4px left accent stripe. */
  accent?: string;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-neutral-800 bg-neutral-900/60 shadow-sm shadow-black/30 ${
        accent ? `border-l-4 ${accent}` : ""
      } ${muted ? "opacity-50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{children}</h2>
      {right}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warn";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-emerald-600 bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60 active:bg-emerald-900/80",
  secondary:
    "border-neutral-700 bg-neutral-900/60 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-900 active:bg-neutral-800",
  ghost:
    "border-transparent bg-transparent text-neutral-400 hover:border-neutral-700 hover:text-neutral-200",
  danger: "border-red-800 bg-red-950/40 text-red-300 hover:bg-red-950/60 active:bg-red-950/80",
  warn: "border-amber-700 bg-amber-950/40 text-amber-300 hover:bg-amber-950/60 active:bg-amber-950/80",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "min-h-[36px] px-3 py-1.5 text-sm",
    md: "min-h-[44px] px-4 py-2 text-sm",
    lg: "min-h-[52px] px-5 py-3 text-base",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${sizes[size]} ${className}`}
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
      className={`min-h-[36px] rounded-full border px-3 py-1 text-sm transition-colors duration-100 ${
        active
          ? (activeClass ?? "border-emerald-600 bg-emerald-900/40 text-emerald-200")
          : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1 opacity-60">({count})</span>}
    </button>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rounded-md border px-1.5 py-0.5 text-xs font-medium leading-tight ${className}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-neutral-800 ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-150 ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-8 text-center">
      <p className="text-lg font-medium text-neutral-200">{title}</p>
      {children && <div className="mt-2 text-sm text-neutral-400">{children}</div>}
    </Card>
  );
}

export const accuracyText = (pct: number) =>
  pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
