import type { Metadata } from "next";
import { QuizClient } from "@/components/quiz-client";
import { QUIZ_POOL_SIZE } from "@/lib/quiz";

export const metadata: Metadata = {
  title: "Quiz",
  description: "Ten quick questions in Urdu about Pakistan's history, geography, food, sport and culture.",
};

export default function QuizPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Pakistan culture quiz</h1>
      <p lang="ur" dir="rtl" className="urdu text-xl text-muted">
        پاکستان کے بارے میں دس سوال
      </p>
      <p>
        Ten random questions from the public Urdu-Bench cultural knowledge set ({QUIZ_POOL_SIZE} questions). These
        are the same questions the models answer in the benchmark, so you can compare yourself with them in the
        explorer afterwards. We store only whether each answer was right, under an anonymous id.
      </p>
      <QuizClient />
    </div>
  );
}
