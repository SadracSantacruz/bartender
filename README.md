# Bar Drill

A local bartender drink-memorization drill game. Runs entirely in the browser — no backend, no accounts, progress saved to `localStorage`.

## Running it

```
npm install
npm run dev
```

Open the printed `localhost` URL. Works on desktop and phone.

## Adding a new deck (new bar, new menu)

Drop a `.json` file into `data/decks/` and restart `npm run dev`. That's it — the app reads every deck file in that folder at startup and it shows up on the home screen with a checkbox, ready to select and drill. No code changes needed.

See `data/decks/README.md` for the full field reference, and copy `data/decks/_TEMPLATE.json` as a starting point.

You can also paste a deck's JSON into the in-app **Import** screen first to validate it against the schema — it'll tell you exactly which field is wrong if something doesn't match, before you save the file.

## Modes

- **Browse** — searchable list of every drink, not a quiz, for looking something up fast.
- **Multiple Choice** — one field per question, 4 options, smart distractors from the same category.
- **Full Build Recall** — see the name, fill in the whole build, self-graded per field.
- **Reverse Recall** — see the build, type the name, fuzzy-matched.
- **Rapid Fire** — 60 seconds, one-line "which drink uses X" questions auto-generated from the data.
- **Ticket Mode** — 5-8 tickets in a row, name the glass and base fast, running clock.
- **Dashboard** — overall mastery, per-deck mastery, weakest drinks, per-field breakdown, reset progress.

Progress uses a 5-box Leitner system per drink, weighted toward things you get wrong and haven't seen recently, and toward lower-tier (higher-priority) drinks by default.

## Stack

Vite + React + TypeScript + Tailwind v4 + Zustand. All state is client-side; deck data is loaded from `data/decks/*.json` via `import.meta.glob` at build/startup time.
