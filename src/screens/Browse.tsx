import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { LOADED_DECKS } from "../lib/deckLoader";
import { useAppStore } from "../store/appStore";
import { useProgressStore } from "../store/progressStore";
import { getFilteredDrinks, type DeckDrink } from "../lib/quiz";
import { baseColorFor, baseGroupFor } from "../lib/baseColors";
import { DRINK_FIELDS, type DrinkField } from "../types";

const TIER_STYLES: Record<number, string> = {
  1: "border-emerald-700 bg-emerald-950/60 text-emerald-300",
  2: "border-cyan-700 bg-cyan-950/60 text-cyan-300",
  3: "border-violet-700 bg-violet-950/60 text-violet-300",
};
const TIER_FALLBACK = "border-neutral-700 bg-neutral-800/60 text-neutral-300";

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
        <p className="text-neutral-400">
          No drinks match your current selection. Go back Home and select a deck (and check your
          tier/category filters).
        </p>
      </Layout>
    );
  }

  const savedCount = pool.filter(({ deck, drink }) => savedDrinks[`${deck.id}:${drink.id}`]).length;
  const skippedCount = pool.filter(({ deck, drink }) => skippedDrinks[`${deck.id}:${drink.id}`]).length;

  return (
    <Layout title="Browse">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, category, base, glass, garnish, ingredient..."
        className="mb-3 min-h-[52px] w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-base text-neutral-100 placeholder-neutral-500 outline-none focus:border-emerald-600"
      />

      {decks.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          <FilterChip active={deckId === "all"} onClick={() => setDeckId("all")} label="All decks" />
          {decks.map((d) => (
            <FilterChip
              key={d.id}
              active={deckId === d.id}
              onClick={() => setDeckId(deckId === d.id ? "all" : d.id)}
              label={d.name}
              activeClass="border-fuchsia-600 bg-fuchsia-900/40 text-fuchsia-300"
            />
          ))}
        </div>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <FilterChip
          active={baseGroup === "all"}
          onClick={() => setBaseGroup("all")}
          label="All bases"
        />
        {baseGroups.map((g) => (
          <FilterChip
            key={g}
            active={baseGroup === g}
            onClick={() => setBaseGroup(baseGroup === g ? "all" : g)}
            label={g}
            activeClass={baseColorFor(g).chipActive}
          />
        ))}
      </div>

      {categories.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-2">
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="All categories"
          />
          {categories.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(category === c ? "all" : c)}
              label={c}
            />
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <FilterChip
          active={savedOnly}
          onClick={() => {
            setSavedOnly(!savedOnly);
            if (!savedOnly) setSkippedOnly(false);
          }}
          label={`★ Saved only (${savedCount})`}
          activeClass="border-sky-600 bg-sky-900/40 text-sky-300"
        />
        <FilterChip
          active={skippedOnly}
          onClick={() => {
            setSkippedOnly(!skippedOnly);
            if (!skippedOnly) setSavedOnly(false);
          }}
          label={`🚫 Skipped only (${skippedCount})`}
          activeClass="border-neutral-500 bg-neutral-800 text-neutral-200"
        />
        <FilterChip
          active={hideSkipped}
          onClick={() => setHideSkipped(!hideSkipped)}
          label="Hide skipped"
        />
      </div>

      <p className="mb-3 text-sm text-neutral-500">
        {filtered.length} drink{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <p className="text-neutral-400">
          {savedOnly
            ? "No saved drinks match. Tap the ☆ on a drink card to save it for later."
            : skippedOnly
              ? "No skipped drinks match. Tap 🚫 on a drink card to mark it as \"don't need to know.\""
              : "Nothing matches those filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(({ deck, drink }) => (
            <DrinkCard key={`${deck.id}:${drink.id}`} deckDrink={{ deck, drink }} />
          ))}
        </div>
      )}
    </Layout>
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
    <div
      className={`rounded-lg border border-neutral-800 border-l-4 bg-neutral-900/50 p-4 ${color.border} ${
        skipped ? "opacity-50" : ""
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{drink.name}</h3>
        {drink.verify && (
          <span className="rounded border border-amber-800 bg-amber-950/50 px-1.5 py-0.5 text-xs text-amber-400">
            unverified
          </span>
        )}
        {skipped && (
          <span className="rounded border border-neutral-600 bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-300">
            skipped
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => toggleSaved(deck.id, drink.id)}
            title={saved ? "Remove from saved" : "Save as still learning"}
            className={`rounded-lg border px-2.5 py-1 text-sm ${
              saved
                ? "border-sky-600 bg-sky-900/40 text-sky-300"
                : "border-neutral-700 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            }`}
          >
            {saved ? "★ Saved" : "☆ Save"}
          </button>
          <button
            type="button"
            onClick={() => toggleSkipped(deck.id, drink.id)}
            title={skipped ? "Include this in quizzes again" : "Don't need to know this — exclude from quizzes"}
            className={`rounded-lg border px-2.5 py-1 text-sm ${
              skipped
                ? "border-neutral-500 bg-neutral-800 text-neutral-200"
                : "border-neutral-700 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
            }`}
          >
            {skipped ? "🚫 Skipped" : "🚫 Skip"}
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded border border-fuchsia-700 bg-fuchsia-950/40 px-1.5 py-0.5 text-xs text-fuchsia-300">
          {deck.name}
        </span>
        <span className={`rounded border px-1.5 py-0.5 text-xs ${TIER_STYLES[drink.tier] ?? TIER_FALLBACK}`}>
          Tier {drink.tier}
        </span>
        <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-xs text-neutral-300">
          {drink.category}
        </span>
        <span className={`rounded border px-1.5 py-0.5 text-xs ${color.badge}`}>{drink.base}</span>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <Field label="Glass" value={drink.glass} />
        <Field label="Serve" value={drink.serve} />
        <Field label="Rim" value={drink.rim} />
        <Field label="Garnish" value={drink.garnish} />
        <Field label="Prep" value={drink.prep} />
      </div>

      {drink.ingredients.length > 0 && (
        <div className="mt-2 text-sm">
          <div className="mb-1 text-neutral-500">Ingredients</div>
          <ul className="list-inside list-disc space-y-0.5 text-neutral-200">
            {drink.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>
        </div>
      )}

      {drink.notes && (
        <p className="mt-2 text-sm text-neutral-400">
          <span className="text-neutral-500">Notes: </span>
          {drink.notes}
        </p>
      )}

      {drink.verify && (
        <p className="mt-2 rounded border border-amber-800 bg-amber-950/30 p-2 text-xs text-amber-400">
          {drink.verify}
        </p>
      )}

      <div className="mt-3 border-t border-neutral-800 pt-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-neutral-500">Shaky on:</span>
          {DRINK_FIELDS.map((field) => {
            const active = shakyFields.includes(field);
            return (
              <button
                key={field}
                type="button"
                onClick={() => toggleShakyField(deck.id, drink.id, field)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  active
                    ? "border-amber-600 bg-amber-900/40 text-amber-300"
                    : "border-neutral-700 bg-neutral-900/50 text-neutral-500 hover:border-neutral-600"
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
          className="w-full rounded-lg border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-600"
        />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[36px] rounded-full border px-3 py-1 text-sm ${
        active
          ? (activeClass ?? "border-emerald-600 bg-emerald-900/40 text-emerald-300")
          : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700"
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-neutral-500">{label}: </span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}
