import { startBattle } from "@/lib/arena";
import { forbidden, notConfigured, readJson, requestContext, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";

export const maxDuration = 30;

export async function POST(req: Request) {
  if (!(await sameOrigin())) return forbidden();
  const { kv, chat, dailyCap } = getServices();
  if (!kv || !chat || dailyCap === 0) return notConfigured();
  const ctx = await requestContext();
  return respond(await startBattle(await readJson(req), ctx, { kv, chat, dailyCap }));
}
