import { castVote } from "@/lib/arena";
import { forbidden, notConfigured, readJson, requestContext, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";

export async function POST(req: Request) {
  if (!(await sameOrigin())) return forbidden();
  const { kv, store } = getServices();
  if (!kv || !store) return notConfigured();
  const ctx = await requestContext();
  return respond(await castVote(await readJson(req), ctx, { kv, store }));
}
