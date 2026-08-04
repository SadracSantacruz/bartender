# Adding a deck

Drop a new `.json` file in this folder (`data/decks/`) and restart `npm run dev`. That's it — the app reads every file here at startup. Nothing in `src/` needs to change.

Copy `_TEMPLATE.json` as a starting point. Filenames starting with `_` (like `_TEMPLATE.json`) are ignored by the loader, so you can leave the template here.

## Deck-level fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique slug for this deck, e.g. `"thai-smile"`. Used internally as a key — keep it stable once you start tracking progress against it. |
| `name` | string | Display name shown on the home screen, e.g. `"Thai Smile Palm Springs"`. |
| `description` | string | One line of context shown under the name. |
| `tierLabels` | object | Maps tier numbers (as string keys `"1"`, `"2"`, `"3"`) to a human label, e.g. `{"1": "Signature Menu", "2": "Wall Card", "3": "Off Menu"}`. Use whatever tiers make sense for your bar — you don't have to use exactly three. |
| `drinks` | array | The list of drinks, see below. Must contain at least one. |

## Drink fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Slug, unique **within this deck**. Lowercase, hyphenated, e.g. `"nutty-old-fashion"`. |
| `name` | string | yes | Display name. Preserve the bar's actual spelling/capitalization, even if it looks like a typo. |
| `tier` | number | yes | Matches a key in `tierLabels`. Lower numbers should be higher priority/more commonly ordered — the app weights quizzing toward tier 1 by default. |
| `category` | string | yes | The spirit family grouping, e.g. `"Vodka"`, `"Rum"`, `"Tequila"`, `"Gin"`, `"Mezcal"`, `"Whiskey & Bourbon"`, `"Wine, Sparkling & Other"`. Used to generate harder, same-category multiple choice distractors. |
| `base` | string | yes | The base spirit(s), with pour counts if you know them, e.g. `"2oz Bacardi Gold rum, 2oz Bacardi Silver rum"`. |
| `ingredients` | string[] | yes | Every modifier, juice, syrup, muddled item, etc. as its own array entry. Don't cram them into one string. |
| `glass` | string | yes | e.g. `"martini glass"`, `"hurricane glass"`, `"copper mug"`. |
| `serve` | string | yes | One of: `"up"`, `"rocks"`, `"built"`, `"blended"`, `"shareable"`, `"other"`. |
| `rim` | string | yes | Use the literal string `"none"` when there is no rim — don't leave it blank or omit it. |
| `garnish` | string | yes | Use the literal string `"none listed"` when the source doesn't specify a garnish. |
| `prep` | string | yes | The method, one or two sentences. |
| `notes` | string | no | Free-text notes. Omit the field entirely if you don't need it (don't set it to an empty string). |
| `verify` | string | no | See below — only set this when a field is genuinely disputed or undocumented. |

## The `verify` field

Set `verify` on a drink when a source conflicts with itself, or a field simply isn't documented anywhere. Two rules:

1. **Never invent a value.** If a field isn't documented, set that specific field to the literal string `"not documented"` (for `base`, `glass`, `rim`, `garnish`, or `prep`) or leave `ingredients` as an empty array `[]`, and explain what's missing in `verify`.
2. **Write `verify` as guidance for a human**, e.g. `"No recipe card found. Ask the bar for exact pour counts."` or `"Recipe card says X, printed menu says Y — confirm which is current."`

The app will:
- never quiz a field that is `"not documented"`,
- still quiz whatever fields *are* documented,
- show an amber "unverified" badge on the drink,
- show the `verify` text on the answer reveal so you learn to double check instead of drilling in a guess.

Leave `verify` unset (or an empty string) for drinks that aren't disputed.

## No prices

This app never stores or displays prices. Don't add a `price` field — it'll be ignored by the schema validator's required-field checks, but it's simplest to just leave it out.
