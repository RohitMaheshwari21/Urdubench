import { after } from "next/server";
import { askQuestion } from "@/lib/ask";
import { getServices } from "@/lib/services";
import {
  cloudApiSend,
  firstDelivery,
  formatAsk,
  handleMessage,
  NeonWaStore,
  parseMessages,
  verifySignature,
} from "@/lib/whatsapp";
import { withLog } from "@/lib/log";

// The reply work runs in after(), within this limit, once Meta already has its 200.
export const maxDuration = 60;

/** Webhook verification: echo hub.challenge when the verify token matches. */
export const GET = withLog("whatsapp", async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token)
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  return new Response("forbidden", { status: 403 });
});

export const POST = withLog("whatsapp", async (req: Request) => {
  const env = process.env;
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET ?? ""))
    return new Response("bad signature", { status: 401 });

  const { kv, chat, embed, retriever, dailyCap } = getServices();
  if (!kv || !env.DATABASE_URL || !env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID)
    return new Response("not configured", { status: 503 });

  let messages;
  try {
    messages = parseMessages(JSON.parse(raw));
  } catch {
    return new Response("ok", { status: 200 }); // malformed but signed: nothing to do, don't make Meta retry
  }

  // Acknowledge now; reply in the background. Duplicate deliveries are skipped by message id.
  after(async () => {
    const store = new NeonWaStore(env.DATABASE_URL!);
    const send = cloudApiSend(env.WHATSAPP_TOKEN!, env.WHATSAPP_PHONE_NUMBER_ID!, env.WHATSAPP_API_VERSION || undefined);
    const ask =
      chat && embed && retriever && dailyCap > 0
        ? async (question: string, client: string) =>
            formatAsk((await askQuestion({ question }, { client }, { kv, chat, embed, retriever, dailyCap })).body)
        : null;
    for (const m of messages) {
      try {
        if (!(await firstDelivery(kv, m.id))) continue;
        const reply = await handleMessage(m.from, m.text, { store, kv, ask, salt: env.RATE_LIMIT_SALT ?? "urdubench" });
        await send(m.from, reply);
      } catch (e) {
        // Log the error kind only: never the phone number or message text.
        console.error("whatsapp reply failed:", e instanceof Error ? e.message : "unknown");
      }
    }
  });
  return new Response("ok", { status: 200 });
});
