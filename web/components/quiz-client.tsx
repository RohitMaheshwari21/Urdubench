"use client";

import { useCallback, useEffect, useState } from "react";

const ROUND = 10;
const LETTERS = ["A", "B", "C", "D"] as const;

type Question = { id: string; category: string; question: string; choices: string[] };
type Feedback = { choice: string; correct: boolean; answer: string };

export function QuizClient() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const done = seen.length >= ROUND && feedback === null;

  const load = useCallback(async (exclude: string[]) => {
    setError("");
    const res = await fetch(`/api/quiz?exclude=${encodeURIComponent(exclude.join(","))}`, { cache: "no-store" });
    if (!res.ok) return setError("Could not load a question. Please try again.");
    setQuestion((await res.json()).question);
    setFeedback(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first question loads once on mount
    load([]);
  }, [load]);

  async function answer(choice: string) {
    if (!question || feedback) return;
    const res = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: question.id, choice }),
    });
    if (!res.ok) return setError("Your answer was not checked. Please try again.");
    const data = await res.json();
    setFeedback({ choice, correct: data.correct, answer: data.answer });
    if (data.correct) setScore((s) => s + 1);
    setSeen((s) => [...s, question.id]);
  }

  function next() {
    if (seen.length >= ROUND) {
      setFeedback(null);
      setQuestion(null);
    } else load(seen);
  }

  function restart() {
    setSeen([]);
    setScore(0);
    setCopied(false);
    load([]);
  }

  async function share() {
    const text = `I scored ${score}/${ROUND} on the Urdu-Bench Pakistan culture quiz. ${window.location.origin}/quiz`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
      }
    } catch {
      // the user closed the share sheet
    }
  }

  if (done)
    return (
      <section aria-live="polite" className="space-y-4 rounded-lg border border-line bg-surface p-6">
        <h2 className="text-2xl font-bold">
          You scored {score} / {ROUND}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={share} className="rounded-md bg-accent px-4 py-2 font-semibold text-background">
            Share your score
          </button>
          <button type="button" onClick={restart} className="rounded-md border border-line px-4 py-2">
            Play again
          </button>
        </div>
        {copied && <p className="text-sm text-muted">Copied to the clipboard.</p>}
      </section>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted" aria-live="polite">
        Question {Math.min(seen.length + (feedback ? 0 : 1), ROUND)} of {ROUND} · Score {score}
      </p>
      {error && <p className="text-sm text-bad">{error}</p>}
      {question && (
        <section className="space-y-4 rounded-lg border border-line p-4">
          <p lang="ur" dir="rtl" className="urdu text-xl leading-loose">
            {question.question}
          </p>
          <ol className="grid gap-2 sm:grid-cols-2">
            {question.choices.map((c, i) => {
              const letter = LETTERS[i];
              const isAnswer = feedback?.answer === letter;
              const isWrongPick = feedback && feedback.choice === letter && !feedback.correct;
              return (
                <li key={letter}>
                  <button
                    type="button"
                    onClick={() => answer(letter)}
                    disabled={feedback !== null}
                    aria-pressed={feedback?.choice === letter}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-start ${
                      isAnswer ? "border-ok bg-accent-soft" : isWrongPick ? "border-bad" : "border-line hover:bg-surface"
                    }`}
                  >
                    <span className="font-mono text-sm text-muted">{letter}</span>
                    <span lang="ur" dir="rtl" className="urdu flex-1 text-lg">
                      {c}
                    </span>
                    {isAnswer && <span className="text-sm text-ok">✓ correct</span>}
                    {isWrongPick && <span className="text-sm text-bad">✗ your pick</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {feedback && (
            <div className="flex flex-wrap items-center gap-3" aria-live="polite">
              <p className={feedback.correct ? "text-ok" : "text-bad"}>
                {feedback.correct ? "Correct!" : `Not quite. The answer is ${feedback.answer}.`}
              </p>
              <button type="button" onClick={next} className="rounded-md bg-accent px-4 py-2 font-semibold text-background">
                {seen.length >= ROUND ? "See your score" : "Next question"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
