import type { Metadata } from "next";
import Link from "next/link";
import { ArenaClient } from "@/components/arena-client";
import { ARENA_MODELS } from "@/lib/llm";

export const metadata: Metadata = {
  title: "Arena",
  description: "Ask a question in Urdu or Roman Urdu, compare two anonymous models, and vote for the better answer.",
};

export default function ArenaPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl font-bold">Model arena</h1>
      <p className="max-w-2xl">
        Ask anything in Urdu, Roman Urdu or English. Two models chosen at random answer without their names. Pick
        the better answer and the names are revealed. Votes feed the arena ranking on the{" "}
        <Link href="/" className="text-accent underline">
          leaderboard
        </Link>
        .
      </p>
      <ul className="max-w-2xl list-disc space-y-1 ps-6 text-sm text-muted">
        <li>
          Models in the arena: {ARENA_MODELS.map((m) => m.label).join(", ")} (served by Groq). Answers are short and
          for general information only, not medical, legal or financial advice.
        </li>
        <li>
          Your question is sent to the model provider to get the answers. We store only your vote, the two model
          names and the length of your question, never the text.{" "}
          <Link href="/privacy" className="text-accent underline">
            Privacy
          </Link>
        </li>
      </ul>
      <ArenaClient />
    </div>
  );
}
