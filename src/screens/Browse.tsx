import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { getFilteredDrinks, type DeckDrink } from "../lib/quiz";
import { baseColorFor, baseGroupFor } from "../lib/baseColors";
import { DRINK_FIELDS, type DrinkField } from "../types";
import { Badge, Button, Card, Chip, EmptyState } from "../components/ui";

const TIER_STYLES: Record<number, string> = {
  1: "border-emerald-700 bg-emerald-950/60 text-emerald-300",
  2: "border-cyan-700 bg-cyan-950/60 text-cyan-300",
  3: "border-violet-700 bg-violet-950/60 text-violet-300",
};
const TIER_FALLBACK = "border-ink-700 bg-ink-850/60 text-ink-300";

// Stable empty-array reference. Returning a fresh `[]` from a zustand selector
// makes every render look like a state change (Object.is compares by identity),
// which spins React into an infinite re-render loop.
const NO_SHAKY_FIELDS: DrinkField[] = [];

const FIELD_LABELS: Record<DrinkField, string> = {
  base: "Base",
  glass: "Glass",
  serve: "Serve",
  rim: "Rim",
  garnish: "Garnish",
  ingredients: "Ingredients",
  prep: "Prep",
};

export default function Browse() {
  const selectedDeckIds = useAppStore((s) => s.selectedDeckIds);
  const tierFilter = useAppStore((s) => s.tierFilter);
  const categoryFilter = useAppStore((s) => s.categoryFilter);
  const savedDrinks = useProgressStore((s) => s.savedDrinks);
  const skippedDrinks = useProgressStore((s) => s.skippedDrinks);
  const [query, setQuery] = useState("");
  const [baseGroup, setBaseGroup] = useState<string | "all">("all");
  const [category, setCategory] = useState<string | "all">("all");
  const [deckId, setDeckId] = useState<string | "all">("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [skippedOnly, setSkippedOnly] = useState(false);
  const [hideSkipped, setHideSkipped] = useState(false);
  // Collapsed by default: on a phone the filter panel is a full screen of chips,
  // and the common case is scrolling/searching drinks, not filtering.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount =
    (deckId !== "all" ? 1 : 0) +
    (baseGroup !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (savedOnly ? 1 : 0) +
    (skippedOnly ? 1 : 0) +
    (hideSkipped ? 1 : 0);

  function clearFilters() {
    setDeckId("all");
    setBaseGroup("all");
    setCategory("all");
    setSavedOnly(false);
    setSkippedOnly(false);
    setHideSkipped(false);
  }

  const decks = useMemo(
    () => LOADED_DECKS.filter((d) => selectedDeckIds.includes(d.deck.id)).map((d) => d.deck),
    [selectedDeckIds]
  );

  const pool = useMemo(
    () => getFilteredDrinks(decks, tierFilter, categoryFilter),
    [decks, tierFilter, categoryFilter]
  );

  const baseGroups = useMemo(() => {
    const set = new Set<string>();
    for (const { drink } of pool) set.add(baseGroupFor(drink.base));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pool]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const { drink } of pool) set.add(drink.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter(({ deck, drink }) => {
      const key = `${deck.id}:${drink.id}`;
      if (deckId !== "all" && deck.id !== deckId) return false;
      if (savedOnly && !savedDrinks[key]) return false;
      if (skippedOnly && !skippedDrinks[key]) return false;
      if (hideSkipped && skippedDrinks[key]) return false;
      if (baseGroup !== "all" && baseGroupFor(drink.base) !== baseGroup) return false;
      if (category !== "all" && drink.category !== category) return false;
      if (!q) return true;
      if (drink.name.toLowerCase().includes(q)) return true;
      if (deck.name.toLowerCase().includes(q)) return true;
      if (drink.category.toLowerCase().includes(q)) return true;
      if (drink.base.toLowerCase().includes(q)) return true;
      if (drink.glass.toLowerCase().includes(q)) return true;
      if (drink.garnish.toLowerCase().includes(q)) return true;
      if (drink.ingredients.some((i) => i.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [
    pool,
    query,
    baseGroup,
    category,
    deckId,
    savedOnly,
    savedDrinks,
    skippedOnly,
    hideSkipped,
    skippedDrinks,
  ]);

  if (pool.length === 0) {
    return (
      <Layout title="Browse">
        <EmptyState title="Nothing to browse yet">
          No drinks match your current selection. Go back Home and select a deck (and check your
          tier/category filters).
        </EmptyState>
      </Layout>
    );
  }

  const savedCount = pool.filter(({ deck, drink }) => savedDrinks[`${deck.id}:${drink.id}`]).length;
  const skippedCount = pool.filter(({ deck, drink }) => skippedDrinks[`${deck.id}:${drink.id}`]).length;

  return (
    <Layout title="Browse">
      <div className="space-y-6">
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, category, base, glass, garnish, ingredient..."
            className="min-h-[52px] w-full rounded-xl border border-ink-800 bg-ink-900/80 px-4 py-3 text-base text-ink-100 shadow-sm shadow-black/30 outline-none transition-colors duration-100 placeholder:text-ink-500 focus:border-brass-500"
          />

          <div className="flex items-center justify-between gap-3">
            <Button
              size="sm"
              variant={activeFilterCount > 0 ? "primary" : "secondary"}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? "Hide filters" : "Filters"}
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-brass-500/25 px-1.5 text-xs tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            {activeFilterCount > 0 && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>

          <Card className={`divide-y divide-ink-800/80 ${filtersOpen ? "" : "hidden"}`}>
            {decks.length > 1 && (
              <FilterRow label="Deck">
                <Chip active={deckId === "all"} onClick={() => setDeckId("all")} label="All decks" />
                {decks.map((d) => (
                  <Chip
                    key={d.id}
                    active={deckId === d.id}
                    onClick={() => setDeckId(deckId === d.id ? "all" : d.id)}
                    label={d.name}
                    activeClass="border-fuchsia-600 bg-fuchsia-900/40 text-fuchsia-200"
                  />
                ))}
              </FilterRow>
            )}

            <FilterRow label="Base">
              <Chip active={baseGroup === "all"} onClick={() => setBaseGroup("all")} label="All bases" />
              {baseGroups.map((g) => (
                <Chip
                  key={g}
                  active={baseGroup === g}
                  onClick={() => setBaseGroup(baseGroup === g ? "all" : g)}
                  label={g}
                  activeClass={baseColorFor(g).chipActive}
                />
              ))}
            </FilterRow>

            {categories.length > 1 && (
              <FilterRow label="Category">
                <Chip
                  active={category === "all"}
                  onClick={() => setCategory("all")}
                  label="All categories"
                />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    active={category === c}
                    onClick={() => setCategory(category === c ? "all" : c)}
                    label={c}
                  />
                ))}
              </FilterRow>
            )}

            <FilterRow label="Marks">
              <Chip
                active={savedOnly}
                onClick={() => {
                  setSavedOnly(!savedOnly);
                  if (!savedOnly) setSkippedOnly(false);
                }}
                label="★ Saved only"
                count={savedCount}
                activeClass="border-sky-600 bg-sky-900/40 text-sky-200"
              />
              <Chip
                active={skippedOnly}
                onClick={() => {
                  setSkippedOnly(!skippedOnly);
                  if (!skippedOnly) setSavedOnly(false);
                }}
                label="🚫 Skipped only"
                count={skippedCount}
                activeClass="border-ink-500 bg-ink-800 text-ink-100"
              />
              <Chip
                active={hideSkipped}
                onClick={() => setHideSkipped(!hideSkipped)}
                label="Hide skipped"
              />
            </FilterRow>
          </Card>

          <p className="text-sm text-ink-400">
            <span className="font-medium tabular-nums text-ink-200">{filtered.length}</span> drink
            {filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No matches">
            {savedOnly
              ? "No saved drinks match. Tap the ☆ on a drink card to save it for later."
              : skippedOnly
                ? "No skipped drinks match. Tap 🚫 on a drink card to mark it as \"don't need to know.\""
                : "Nothing matches those filters."}
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map(({ deck, drink }) => (
              <DrinkCard key={`${deck.id}:${drink.id}`} deckDrink={{ deck, drink }} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-ink-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function DrinkCard({ deckDrink }: { deckDrink: DeckDrink }) {
  const { deck, drink } = deckDrink;
  const key = `${deck.id}:${drink.id}`;
  const toggleSaved = useProgressStore((s) => s.toggleSaved);
  const saved = useProgressStore((s) => !!s.savedDrinks[key]);
  const toggleSkipped = useProgressStore((s) => s.toggleSkipped);
  const skipped = useProgressStore((s) => !!s.skippedDrinks[key]);
  const setPersonalNote = useProgressStore((s) => s.setPersonalNote);
  const storedNote = useProgressStore((s) => s.personalNotes[key] ?? "");
  const shakyFields = useProgressStore((s) => s.shakyFields[key] ?? NO_SHAKY_FIELDS);
  const toggleShakyField = useProgressStore((s) => s.toggleShakyField);
  const color = baseColorFor(drink.base);

  const [noteDraft, setNoteDraft] = useState(storedNote);
  useEffect(() => {
    setNoteDraft(storedNote);
  }, [storedNote]);

  function commitNote() {
    if (noteDraft !== storedNote) setPersonalNote(deck.id, drink.id, noteDraft);
  }

  return (
    <Card accent={color.border} muted={skipped} className="p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold leading-tight text-ink-100">
              {drink.name}
            </h3>
            {drink.verify && (
              <Badge className="border-amber-800 bg-amber-950/50 text-amber-300">unverified</Badge>
            )}
            {skipped && <Badge className="border-ink-600 bg-ink-800 text-ink-200">skipped</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge className="border-fuchsia-700 bg-fuchsia-950/40 text-fuchsia-300">{deck.name}</Badge>
            <Badge className={TIER_STYLES[drink.tier] ?? TIER_FALLBACK}>Tier {drink.tier}</Badge>
            <Badge className="border-ink-700 bg-ink-850/60 text-ink-300">{drink.category}</Badge>
            {/* Base can be a full pour spec ("2oz Gin or Vodka, depending on
                customer preference"), so it stays sentence case — the Badge
                default uppercase is only legible for short labels. */}
            <Badge plain className={color.badge}>
              {drink.base}
            </Badge>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toggleSaved(deck.id, drink.id)}
            title={saved ? "Remove from saved" : "Save as still learning"}
            className={saved ? "border-sky-600 bg-sky-900/40 text-sky-200 hover:bg-sky-900/60" : ""}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toggleSkipped(deck.id, drink.id)}
            title={
              skipped ? "Include this in quizzes again" : "Don't need to know this — exclude from quizzes"
            }
            className={skipped ? "border-ink-500 bg-ink-800 text-ink-100" : ""}
          >
            {skipped ? "🚫 Skipped" : "🚫 Skip"}
          </Button>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Field label="Glass" value={drink.glass} />
        <Field label="Serve" value={drink.serve} />
        <Field label="Rim" value={drink.rim} />
        <Field label="Garnish" value={drink.garnish} />
        <Field label="Prep" value={drink.prep} />
      </dl>

      {drink.ingredients.length > 0 && (
        <div className="mt-4 text-sm">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-ink-400">
            Ingredients
          </div>
          <ul className="list-inside list-disc space-y-0.5 text-ink-200">
            {drink.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </div>
      )}

      {drink.notes && (
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          <span className="text-ink-400">Notes: </span>
          {drink.notes}
        </p>
      )}

      {drink.verify && (
        <p className="mt-3 rounded-xl border border-amber-800 bg-amber-950/30 p-2.5 text-xs leading-relaxed text-amber-300">
          {drink.verify}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950/50 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-400">
          My notes
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-ink-400">Shaky on:</span>
          {DRINK_FIELDS.map((field) => {
            const active = shakyFields.includes(field);
            return (
              <button
                key={field}
                type="button"
                onClick={() => toggleShakyField(deck.id, drink.id, field)}
                className={`min-h-[38px] rounded-full border px-3 py-1 text-xs transition-colors duration-100 ${
                  active
                    ? "border-amber-600 bg-amber-900/40 text-amber-200"
                    : "border-ink-700 bg-ink-850/80 text-ink-400 hover:border-ink-600 hover:text-ink-200"
                }`}
              >
                {FIELD_LABELS[field]}
              </button>
            );
          })}
        </div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          placeholder="Personal note — e.g. 'confused vodka for tequila', 'forgot the cherry garnish'..."
          rows={2}
          className="w-full rounded-xl border border-ink-800 bg-ink-950/70 px-3 py-2 text-sm text-ink-200 outline-none transition-colors duration-100 placeholder:text-ink-500 focus:border-brass-500"
        />
      </div>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-ink-400">{label}:</dt>
      <dd className="min-w-0 text-ink-200">{value}</dd>
    </div>
  );
}
