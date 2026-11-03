import type { NextRequest } from "next/server";
import { checkAnswer, nextQuestion } from "@/lib/quiz";
import { forbidden, readJson, requestContext, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";

/** A random question without its answer. `?exclude=t3-001,t3-002` skips questions already seen. */
export async function GET(req: NextRequest) {
  await requestContext();
  const exclude = (req.nextUrl.searchParams.get("exclude") ?? "").split(",").filter(Boolean).slice(0, 100);
  return respond({ status: 200, body: { question: nextQuestion(exclude) } });
}

export async function POST(req: Request) {
  if (!(await sameOrigin())) return forbidden();
  const ctx = await requestContext();
  const { kv, store } = getServices();
  return respond(await checkAnswer(await readJson(req), ctx, { kv, store }));
}
