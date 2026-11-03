"use client";

import { useState } from "react";

const MAX = 300;

type Source = { n: number; title: string; section: string; url: string };
type Reply = { kind: "answer" | "unknown" | "refused"; answer: string; sources: Source[]; disclaimer?: string };

export function AskClient() {
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<Reply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setReply(null);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) setReply(data as Reply);
    else setError(data.message ?? "Something went wrong. Please try again.");
  }

  return (
    <div className="space-y-6">
      <form onSubmit={ask} className="space-y-2">
        <label htmlFor="question" className="block font-medium">
          Your question (Urdu, Roman Urdu or English)
        </label>
        <textarea
          id="question"
          dir="auto"
          rows={2}
          maxLength={MAX}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-lg border border-line bg-background p-3"
          placeholder="K2 kis pahari silsile mein hai?"
          aria-describedby="question-help"
        />
        <p id="question-help" className="text-sm text-muted">
          {question.length} / {MAX} characters. Do not include personal details.
        </p>
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-background disabled:opacity-50"
        >
          {busy ? "Looking it up..." : "Ask"}
        </button>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-bad">
        {error}
      </p>

      {reply && (
        <section aria-live="polite" className="space-y-3 rounded-lg border border-line bg-surface p-4">
          <p dir="auto" className="whitespace-pre-wrap text-lg">
            {reply.answer}
          </p>
          {reply.sources.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold">Sources (Urdu Wikipedia, CC BY-SA 4.0)</h2>
              <ol className="mt-1 space-y-1 text-sm">
                {reply.sources.map((s) => (
                  <li key={s.n}>
                    [{s.n}]{" "}
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                      <span lang="ur" dir="rtl" className="urdu">
                        {s.title}
                        {s.section ? ` – ${s.section}` : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {reply.disclaimer && <p className="text-xs text-muted">{reply.disclaimer}</p>}
        </section>
      )}
    </div>
  );
}
