import type { Metadata } from "next";
import Link from "next/link";
import { AskClient } from "@/components/ask-client";

export const metadata: Metadata = {
  title: "Ask",
  description: "Ask a short question about Pakistan, Urdu and culture; answers come from Urdu Wikipedia with sources.",
};

export default function AskPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Ask a question</h1>
      <p lang="ur" dir="rtl" className="urdu text-xl text-muted">
        پاکستان، اردو اور ثقافت کے بارے میں سوال پوچھیں
      </p>
      <p>
        Short answers about Pakistan&apos;s history, geography, language, food, sport and culture. The assistant looks
        up about 150 Urdu Wikipedia articles and answers only from them, with links to the sources. If the answer is
        not there, it says so.
      </p>
      <ul className="list-disc space-y-1 ps-6 text-sm text-muted">
        <li>Informational only. It will not give medical, legal or financial advice.</li>
        <li>
          Your question is sent to Google (Gemini, free tier, which may use it to improve its products) to find
          passages, and to Groq to write the answer. We do not store your question.{" "}
          <Link href="/privacy" className="text-accent underline">
            Privacy
          </Link>
        </li>
      </ul>
      <AskClient />
    </div>
  );
}
