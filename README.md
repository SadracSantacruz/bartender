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
- **Review** — flashcards for whatever you haven't nailed yet (saved, never seen, or shaky).
- **Dashboard** — overall mastery, per-deck mastery, weakest drinks, per-field breakdown, save file, reset progress.

Progress uses a 5-box Leitner system per drink, weighted toward things you get wrong and haven't seen recently, and toward lower-tier (higher-priority) drinks by default.

## Installing it on your phone

The app is a PWA, so you can install it and use it with no signal:

- **iPhone (Safari)** — Share → *Add to Home Screen*
- **Android (Chrome)** — menu → *Install app* / *Add to Home screen*

Once installed it opens fullscreen with its own icon, and everything — app, fonts, all decks — is cached, so it works behind the bar with no connection. When a new version deploys you'll get a small "new version ready" prompt; tap Reload to take it.

Your selected decks and tier/category filters are remembered between sessions. The screen you were on is deliberately *not* remembered — reopening lands on Home rather than dropping you into a round whose state is gone.

## Backing up your progress (save files)

There's no backend and no account — your progress lives in `localStorage`, which is **per browser**. Clearing site data, switching browsers, or moving to a new phone loses it.

So the Dashboard has a save file:

- **Export save file** downloads `bar-drill-save-YYYY-MM-DD.json` containing all your stats, saved/skipped flags, personal notes, and shaky-field tags.
- **Import save file** reads one back. It shows you what's inside first (drinks tracked, answers logged, accuracy, flag counts, when it was exported), then lets you choose:
  - **Replace** — wipe this browser's progress and use the file instead. Use this when restoring onto a new device.
  - **Merge** — combine both, preferring whichever has more answers logged per drink. Use this when you've drilled on two devices.

Import validates the file and explains exactly what's wrong if it isn't a valid save (e.g. if you accidentally pick a deck file). The format carries a `version` field so future changes can migrate old saves rather than reject them.

## Stack

Vite + React + TypeScript + Tailwind v4 + Zustand. All state is client-side; deck data is loaded from `data/decks/*.json` via `import.meta.glob` at build/startup time.
