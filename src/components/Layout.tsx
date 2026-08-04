import type { ReactNode } from "react";
import { useAppStore } from "../store/appStore";

export function Layout({ children, title }: { children: ReactNode; title: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const screen = useAppStore((s) => s.screen);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate("home")}
          className="text-lg font-semibold tracking-tight text-neutral-100"
        >
          Bar Drill
        </button>
        <h1 className="text-sm font-medium text-neutral-400">{title}</h1>
        {screen !== "home" ? (
          <button
            type="button"
            onClick={() => navigate("home")}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 active:bg-neutral-800"
          >
            Home
          </button>
        ) : (
          <span className="w-[52px]" />
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
