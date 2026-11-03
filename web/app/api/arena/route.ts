import { startBattle } from "@/lib/arena";
import { forbidden, notConfigured, readJson, requestContext, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";
import { withLog } from "@/lib/log";

export const maxDuration = 30;

export const POST = withLog("arena", async (req: Request) => {
  if (!(await sameOrigin())) return forbidden();
  const { kv, chat, dailyCap } = getServices();
  if (!kv || !chat || dailyCap === 0) return notConfigured();
  const ctx = await requestContext();
  return respond(await startBattle(await readJson(req), ctx, { kv, chat, dailyCap }));
});
