import { useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { validateDeckJson, type ValidationResult } from "../lib/validateDeck";
import { Button, Card, SectionTitle } from "../components/ui";

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
      <div className="space-y-5">
        <p className="text-sm leading-relaxed text-ink-400">
          See{" "}
          <code className="rounded-md bg-ink-850 px-1.5 py-0.5 font-mono text-xs text-brass-300">
            data/decks/_TEMPLATE.json
          </code>{" "}
          and{" "}
          <code className="rounded-md bg-ink-850 px-1.5 py-0.5 font-mono text-xs text-brass-300">
            data/decks/README.md
          </code>{" "}
          for the full field reference.
        </p>

        <section>
          <SectionTitle>Paste deck JSON</SectionTitle>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="{ &quot;id&quot;: &quot;my-deck&quot;, ... }"
            className="min-h-[300px] w-full rounded-2xl border border-ink-800 bg-ink-950/60 p-4 font-mono text-sm leading-relaxed text-ink-100 placeholder-ink-500 outline-none transition-colors duration-100 focus:border-brass-500 focus:ring-2 focus:ring-brass-500/25"
          />
        </section>

        <Button
          variant="primary"
          size="lg"
          onClick={handleValidate}
          disabled={text.trim().length === 0}
        >
          Validate
        </Button>

        {result && !result.valid && (
          <Card accent="border-l-rose-600" className="border-rose-900/70 bg-rose-950/25 p-5">
            <div className="mb-2.5 font-display text-lg font-semibold text-rose-300">
              Invalid deck &mdash; {result.errors.length} error
              {result.errors.length === 1 ? "" : "s"} found
            </div>
            <ul className="space-y-1.5 text-sm text-rose-100">
              {result.errors.map((err, i) => (
                <li key={i} className="font-mono leading-snug">
                  <span className="text-rose-400">{err.path}</span>: {err.message}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {result && result.valid && result.deck && (
          <Card accent="border-l-emerald-500" className="border-emerald-900/70 bg-emerald-950/25 p-5">
            <div className="mb-3 font-display text-lg font-semibold text-emerald-300">Valid deck</div>
            <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-emerald-50 sm:grid-cols-2">
              <div>
                <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Name
                </dt>
                <dd>{result.deck.name}</dd>
              </div>
              <div>
                <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  ID
                </dt>
                <dd className="font-mono">{result.deck.id}</dd>
              </div>
              <div>
                <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Drinks
                </dt>
                <dd className="tabular-nums">{result.deck.drinks.length}</dd>
              </div>
              <div>
                <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Tiers
                </dt>
                <dd className="tabular-nums">
                  {tierBreakdown.map(([tier, count]) => `Tier ${tier}: ${count}`).join(", ")}
                </dd>
              </div>
            </dl>

            <div className="mb-4 rounded-2xl border border-ink-800 bg-ink-900/70 p-4 text-sm leading-relaxed text-ink-300">
              <p className="mb-1.5 font-medium text-ink-200">To install this deck:</p>
              <ol className="list-inside list-decimal space-y-1.5 marker:text-brass-500">
                <li>
                  Copy the formatted JSON below and save it as{" "}
                  <code className="rounded-md bg-ink-850 px-1.5 py-0.5 font-mono text-xs text-brass-300">
                    data/decks/{result.deck.id}.json
                  </code>
                </li>
                <li>
                  Restart &mdash; the dev server (npm run dev) &mdash; the deck loader picks up any file
                  in that folder automatically.
                </li>
              </ol>
            </div>

            <Button variant="success" size="lg" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy formatted JSON"}
            </Button>
          </Card>
        )}
      </div>
    </Layout>
  );
}
