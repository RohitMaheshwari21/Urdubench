"use client";

import { useState } from "react";

const MAX = 500;

type Battle = { battleId: string; a: string; b: string };
type Reveal = { a: string; b: string; winner: string };
type Choice = "a" | "b" | "tie" | "both_bad";

const CHOICES: { value: Choice; label: string }[] = [
  { value: "a", label: "A is better" },
  { value: "b", label: "B is better" },
  { value: "tie", label: "Both good" },
  { value: "both_bad", label: "Both bad" },
];

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function ArenaClient() {
  const [prompt, setPrompt] = useState("");
  const [battle, setBattle] = useState<Battle | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setBattle(null);
    setReveal(null);
    const { ok, data } = await post("/api/arena", { prompt });
    setBusy(false);
    if (ok) setBattle(data as Battle);
    else setError(data.message ?? "Something went wrong. Please try again.");
  }

  async function vote(winner: Choice) {
    if (!battle) return;
    setBusy(true);
    setError("");
    const { ok, data } = await post("/api/vote", { battleId: battle.battleId, winner });
    setBusy(false);
    if (ok) setReveal(data as Reveal);
    else setError(data.message ?? "Your vote was not saved. Please try again.");
  }

  function reset() {
    setPrompt("");
    setBattle(null);
    setReveal(null);
    setError("");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={ask} className="space-y-2">
        <label htmlFor="prompt" className="block font-medium">
          Your question (Urdu, Roman Urdu or English)
        </label>
        <textarea
          id="prompt"
          dir="auto"
          rows={3}
          maxLength={MAX}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full rounded-lg border border-line bg-background p-3"
          placeholder="Lahore ka mashhoor khana kya hai?"
          aria-describedby="prompt-help"
        />
        <div id="prompt-help" className="flex flex-wrap justify-between gap-2 text-sm text-muted">
          <span>
            {prompt.length} / {MAX} characters. Do not include personal details.
          </span>
        </div>
        <button
          type="submit"
          disabled={busy || !prompt.trim() || (battle !== null && reveal === null)}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-50"
        >
          {busy && !battle ? "Asking two models..." : "Ask both models"}
        </button>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-bad">
        {error}
      </p>

      {battle && (
        <section aria-label="Answers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {(["a", "b"] as const).map((side) => (
              <article key={side} className="rounded-lg border border-line bg-surface p-4">
                <h2 className="font-semibold">
                  Model {side.toUpperCase()}
                  {reveal && <span className="ml-2 font-normal text-muted">({reveal[side]})</span>}
                </h2>
                <p dir="auto" className="mt-2 whitespace-pre-wrap">
                  {battle[side]}
                </p>
              </article>
            ))}
          </div>
          {!reveal ? (
            <fieldset className="space-y-2">
              <legend className="font-medium">Which answer is better?</legend>
              <div className="flex flex-wrap gap-2">
                {CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    disabled={busy}
                    onClick={() => vote(c.value)}
                    className="rounded-md border border-line px-4 py-2 hover:bg-accent-soft disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <div className="space-y-2">
              <p>
                Thanks, your vote is saved. Model A was <strong>{reveal.a}</strong> and model B was{" "}
                <strong>{reveal.b}</strong>.
              </p>
              <button type="button" onClick={reset} className="rounded-md border border-line px-4 py-2">
                Ask another question
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
