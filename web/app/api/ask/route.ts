import { askQuestion } from "@/lib/ask";
import { forbidden, notConfigured, readJson, requestContext, respond, sameOrigin } from "@/lib/request";
import { getServices } from "@/lib/services";
import { withLog } from "@/lib/log";

export const maxDuration = 30;

export const POST = withLog("ask", async (req: Request) => {
  if (!(await sameOrigin())) return forbidden();
  const { kv, chat, embed, retriever, dailyCap } = getServices();
  if (!kv || !chat || !embed || !retriever || dailyCap === 0) return notConfigured();
  const ctx = await requestContext();
  return respond(await askQuestion(await readJson(req), ctx, { kv, chat, embed, retriever, dailyCap }));
});
