import { castVote } from "@/lib/arena";
import { forbidden, notConfigured, readJson, requestContext, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";
import { withLog } from "@/lib/log";

export const POST = withLog("vote", async (req: Request) => {
  if (!(await sameOrigin())) return forbidden();
  const { kv, store } = getServices();
  if (!kv || !store) return notConfigured();
  const ctx = await requestContext();
  return respond(await castVote(await readJson(req), ctx, { kv, store }));
});
