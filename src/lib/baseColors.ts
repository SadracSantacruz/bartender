// Accent colors for drink cards, keyed by base spirit. Tailwind can't see
// dynamically-built class names, so every class string here must be complete.

export interface BaseColor {
  /** Left border accent on the drink card. */
  border: string;
  /** Small badge showing the base spirit. */
  badge: string;
  /** Filter chip when active. */
  chipActive: string;
}

const BASE_COLORS: Array<{ match: RegExp; color: BaseColor }> = [
  {
    match: /tequila/i,
    color: {
      border: "border-l-amber-500",
      badge: "border-amber-700 bg-amber-950/60 text-amber-300",
      chipActive: "border-amber-600 bg-amber-900/40 text-amber-300",
    },
  },
  {
    match: /mezcal/i,
    color: {
      border: "border-l-yellow-600",
      badge: "border-yellow-700 bg-yellow-950/60 text-yellow-300",
      chipActive: "border-yellow-600 bg-yellow-900/40 text-yellow-300",
    },
  },
  {
    match: /rum/i,
    color: {
      border: "border-l-orange-500",
      badge: "border-orange-700 bg-orange-950/60 text-orange-300",
      chipActive: "border-orange-600 bg-orange-900/40 text-orange-300",
    },
  },
  {
    match: /vodka/i,
    color: {
      border: "border-l-sky-500",
      badge: "border-sky-700 bg-sky-950/60 text-sky-300",
      chipActive: "border-sky-600 bg-sky-900/40 text-sky-300",
    },
  },
  {
    match: /whisk|bourbon|rye|scotch/i,
    color: {
      border: "border-l-red-500",
      badge: "border-red-800 bg-red-950/60 text-red-300",
      chipActive: "border-red-700 bg-red-900/40 text-red-300",
    },
  },
  {
    match: /gin/i,
    color: {
      border: "border-l-emerald-500",
      badge: "border-emerald-700 bg-emerald-950/60 text-emerald-300",
      chipActive: "border-emerald-600 bg-emerald-900/40 text-emerald-300",
    },
  },
  {
    match: /brandy|cognac/i,
    color: {
      border: "border-l-rose-500",
      badge: "border-rose-800 bg-rose-950/60 text-rose-300",
      chipActive: "border-rose-700 bg-rose-900/40 text-rose-300",
    },
  },
  {
    match: /wine|champagne|prosecco|sparkling/i,
    color: {
      border: "border-l-purple-500",
      badge: "border-purple-700 bg-purple-950/60 text-purple-300",
      chipActive: "border-purple-600 bg-purple-900/40 text-purple-300",
    },
  },
  {
    match: /liqueur|amaro|aperol|campari|vermouth/i,
    color: {
      border: "border-l-fuchsia-500",
      badge: "border-fuchsia-800 bg-fuchsia-950/60 text-fuchsia-300",
      chipActive: "border-fuchsia-700 bg-fuchsia-900/40 text-fuchsia-300",
    },
  },
  {
    match: /beer|lager|ale/i,
    color: {
      border: "border-l-lime-500",
      badge: "border-lime-700 bg-lime-950/60 text-lime-300",
      chipActive: "border-lime-600 bg-lime-900/40 text-lime-300",
    },
  },
  {
    match: /non[- ]?alcoholic|none|n\/a|virgin|mocktail/i,
    color: {
      border: "border-l-teal-500",
      badge: "border-teal-700 bg-teal-950/60 text-teal-300",
      chipActive: "border-teal-600 bg-teal-900/40 text-teal-300",
    },
  },
];

const FALLBACK: BaseColor = {
  border: "border-l-ink-600",
  badge: "border-ink-700 bg-ink-850/60 text-ink-300",
  chipActive: "border-ink-500 bg-ink-800 text-ink-200",
};

export function baseColorFor(base: string): BaseColor {
  for (const { match, color } of BASE_COLORS) {
    if (match.test(base)) return color;
  }
  return FALLBACK;
}

/**
 * Collapse a raw base string (e.g. "Tequila blanco + triple sec") to the
 * display group it belongs to for filter chips, e.g. "Tequila".
 */
export function baseGroupFor(base: string): string {
  const groups: Array<[RegExp, string]> = [
    [/tequila/i, "Tequila"],
    [/mezcal/i, "Mezcal"],
    [/rum/i, "Rum"],
    [/vodka/i, "Vodka"],
    [/whisk|bourbon|rye|scotch/i, "Whiskey"],
    [/gin/i, "Gin"],
    [/brandy|cognac/i, "Brandy"],
    [/wine|champagne|prosecco|sparkling/i, "Wine"],
    [/liqueur|amaro|aperol|campari|vermouth/i, "Liqueur"],
    [/beer|lager|ale/i, "Beer"],
    [/non[- ]?alcoholic|none|n\/a|virgin|mocktail/i, "Non-alcoholic"],
  ];
  for (const [re, label] of groups) {
    if (re.test(base)) return label;
  }
  return "Other";
}
