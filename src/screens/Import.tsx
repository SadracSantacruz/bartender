import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { validateDeckJson, type ValidationResult } from "../lib/validateDeck";

export default function Import() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [copied, setCopied] = useState(false);

  function handleValidate() {
    setCopied(false);
    setResult(validateDeckJson(text));
  }

  const tierBreakdown = useMemo(() => {
    if (!result?.valid || !result.deck) return [];
    const counts = new Map<number, number>();
    for (const drink of result.deck.drinks) {
      counts.set(drink.tier, (counts.get(drink.tier) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  }, [result]);

  async function handleCopy() {
    if (!result?.valid || !result.deck) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.deck, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Layout title="Import Deck">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          See{" "}
          <code className="rounded bg-black/30 px-1">data/decks/_TEMPLATE.json</code> and{" "}
          <code className="rounded bg-black/30 px-1">data/decks/README.md</code> for the full field
          reference.
        </p>

        <div>
          <label className="mb-2 block text-sm font-medium uppercase tracking-wide text-neutral-500">
            Paste deck JSON
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="{ &quot;id&quot;: &quot;my-deck&quot;, ... }"
            className="min-h-[300px] w-full rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 font-mono text-sm text-neutral-100 outline-none focus:border-neutral-600"
          />
        </div>

        <button
          type="button"
          onClick={handleValidate}
          disabled={text.trim().length === 0}
          className="min-h-[44px] rounded-lg border border-neutral-700 bg-neutral-900/50 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-900 active:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Validate
        </button>

        {result && !result.valid && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-4">
            <div className="mb-2 font-medium text-red-300">
              Invalid deck &mdash; {result.errors.length} error{result.errors.length === 1 ? "" : "s"} found
            </div>
            <ul className="space-y-1 text-sm text-red-200">
              {result.errors.map((err, i) => (
                <li key={i} className="font-mono">
                  <span className="text-red-400">{err.path}</span>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result && result.valid && result.deck && (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4">
            <div className="mb-2 font-medium text-emerald-300">Valid deck</div>
            <div className="mb-3 space-y-1 text-sm text-emerald-100">
              <div>
                <span className="text-emerald-400">Name:</span> {result.deck.name}
              </div>
              <div>
                <span className="text-emerald-400">ID:</span> {result.deck.id}
              </div>
              <div>
                <span className="text-emerald-400">Drinks:</span> {result.deck.drinks.length}
              </div>
              <div>
                <span className="text-emerald-400">Tiers:</span>{" "}
                {tierBreakdown.map(([tier, count]) => `Tier ${tier}: ${count}`).join(", ")}
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm text-neutral-300">
              <p className="mb-1">To install this deck:</p>
              <ol className="list-inside list-decimal space-y-1">
                <li>
                  Copy the formatted JSON below and save it as{" "}
                  <code className="rounded bg-black/30 px-1">
                    data/decks/{result.deck.id}.json
                  </code>
                </li>
                <li>Restart &mdash; the dev server (npm run dev) &mdash; the deck loader picks up any file in that folder automatically.</li>
              </ol>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/60 active:bg-emerald-900/80"
            >
              {copied ? "Copied!" : "Copy formatted JSON"}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}