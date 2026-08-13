import type { ReactNode } from "react";
import { useAppStore } from "../store/appStore";
import { Button } from "./ui";

export function Layout({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const screen = useAppStore((s) => s.screen);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 shadow-sm shadow-black/40 backdrop-blur-md supports-[backdrop-filter]:bg-neutral-950/70">
        <div className="mx-auto flex min-h-[56px] max-w-3xl items-center gap-3 px-4 py-2">
          <button
            type="button"
            onClick={() => navigate("home")}
            className="shrink-0 text-base font-semibold tracking-tight text-neutral-100 transition-colors duration-100 hover:text-emerald-300 sm:text-lg"
          >
            Bar Drill
          </button>

          <span aria-hidden className="h-4 w-px shrink-0 bg-neutral-800" />

          <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-400">{title}</h1>

          {screen !== "home" && (
            <Button size="sm" variant="secondary" className="shrink-0" onClick={() => navigate("home")}>
              Home
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
