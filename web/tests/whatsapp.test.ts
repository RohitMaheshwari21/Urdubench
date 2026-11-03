import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/whatsapp/route";
import { MemoryKV } from "@/lib/kv";
import { getQuizItem, LETTERS } from "@/lib/quiz";
import {
  cloudApiSend,
  DAILY_MESSAGES_PER_USER,
  firstDelivery,
  formatAsk,
  handleMessage,
  hashPhone,
  MemoryWaStore,
  parseMessages,
  verifySignature,
} from "@/lib/whatsapp";

const PHONE = "923001234567";
const sign = (body: string, secret: string) => "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

function payload(...msgs: { id: string; type?: string; body?: string }[]) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "1", phone_number_id: "2" },
              messages: msgs.map((m) => ({
                from: PHONE,
                id: m.id,
                timestamp: "1",
                type: m.type ?? "text",
                ...(m.type && m.type !== "text" ? {} : { text: { body: m.body ?? "" } }),
              })),
            },
          },
        ],
      },
    ],
  };
}

function bot() {
  const store = new MemoryWaStore();
  const kv = new MemoryKV();
  const ask = vi.fn<(q: string, client: string) => Promise<string>>(async (q) => `answer to ${q}`);
  const say = (text: string | null) => handleMessage(PHONE, text, { store, kv, ask, salt: "s" });
  return { store, kv, ask, say };
}

describe("webhook plumbing", () => {
  it("verifies the X-Hub-Signature-256 header", () => {
    const body = JSON.stringify(payload({ id: "m1", body: "hi" }));
    expect(verifySignature(body, sign(body, "secret"), "secret")).toBe(true);
    expect(verifySignature(body, sign(body, "other"), "secret")).toBe(false);
    expect(verifySignature(body + " ", sign(body, "secret"), "secret")).toBe(false);
    expect(verifySignature(body, null, "secret")).toBe(false);
    expect(verifySignature(body, "sha256=abc", "secret")).toBe(false);
    expect(verifySignature(body, sign(body, ""), "")).toBe(false);
  });

  it("parses text and non-text messages and ignores other events", () => {
    expect(parseMessages(payload({ id: "m1", body: "quiz" }, { id: "m2", type: "image" }))).toEqual([
      { id: "m1", from: PHONE, text: "quiz" },
      { id: "m2", from: PHONE, text: null },
    ]);
    expect(parseMessages({ entry: [{ changes: [{ field: "statuses", value: {} }] }] })).toEqual([]);
    expect(parseMessages(null)).toEqual([]);
  });

  it("accepts each message id only once", async () => {
    const kv = new MemoryKV();
    expect(await firstDelivery(kv, "m1")).toBe(true);
    expect(await firstDelivery(kv, "m1")).toBe(false);
    expect(await firstDelivery(kv, "m2")).toBe(true);
  });

  it("hashes phone numbers with a salt", () => {
    expect(hashPhone(PHONE, "a")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashPhone(PHONE, "a")).not.toBe(hashPhone(PHONE, "b"));
    expect(hashPhone(PHONE, "a")).not.toContain(PHONE);
  });

  it("sends a text message to the Cloud API", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://graph.facebook.com/v26.0/PNID/messages");
      expect(JSON.parse(String(init?.body))).toEqual({
        messaging_product: "whatsapp",
        to: PHONE,
        type: "text",
        text: { body: "hi", preview_url: false },
      });
      return new Response("{}");
    });
    await cloudApiSend("tok", "PNID", undefined, fetchFn as typeof fetch)(PHONE, "hi");
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe("route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("answers the verification challenge only with the right token", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "vt");
    const ok = await GET(new Request("https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123"));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("123");
    const bad = await GET(new Request("https://x/api/whatsapp?hub.mode=subscribe&hub.verify_token=no&hub.challenge=1"));
    expect(bad.status).toBe(403);
  });

  it("rejects unsigned or wrongly signed posts before doing anything", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "secret");
    const body = JSON.stringify(payload({ id: "m1", body: "hi" }));
    const r = await POST(new Request("https://x/api/whatsapp", { method: "POST", body, headers: { "x-hub-signature-256": sign(body, "wrong") } }));
    expect(r.status).toBe(401);
  });
});

describe("conversation", () => {
  it("shows help without storing anything", async () => {
    const { say, store } = bot();
    expect(await say("salam")).toMatch(/quiz/);
    expect(store.rows.size).toBe(0);
  });

  it("plays the quiz and keeps score and streak", async () => {
    const { say, store } = bot();
    const q = await say("quiz");
    expect(q).toMatch(/\nA\. /);
    const state = [...store.rows.values()][0];
    const item = getQuizItem(state.currentItem!)!;
    const wrong = LETTERS.find((l) => l !== item.answer)!;
    expect(await say(item.answer.toLowerCase())).toMatch(/Sahi jawab!\nAap ka score: 1\/1/);
    expect(await say("A")).toMatch(/Pehle quiz/); // no open question
    await say("quiz");
    const item2 = getQuizItem([...store.rows.values()][0].currentItem!)!;
    const wrong2 = LETTERS.find((l) => l !== item2.answer)!;
    expect(await say(`${wrong2})`)).toMatch(new RegExp(`Ghalat\\. Sahi jawab: ${item2.answer}`));
    expect(await say("score")).toBe("Aap ka score: 1/2\nLagataar sahi: 0");
    expect(wrong).toBeTruthy();
  });

  it("does not repeat the same question twice in a row", async () => {
    const { say, store } = bot();
    await say("quiz");
    const first = [...store.rows.values()][0].currentItem;
    await say("quiz");
    expect([...store.rows.values()][0].currentItem).not.toBe(first);
  });

  it("switches language", async () => {
    const { say } = bot();
    expect(await say("language en")).toBe("Language: English");
    expect(await say("score")).toMatch(/^Your score: 0\/0/);
    expect(await say("language ur")).toBe("زبان: اردو");
  });

  it("deletes everything on STOP", async () => {
    const { say, store } = bot();
    await say("quiz");
    expect(store.rows.size).toBe(1);
    expect(await say("STOP")).toMatch(/mita diya/);
    expect(store.rows.size).toBe(0);
  });

  it("forwards ask questions", async () => {
    const { say, ask } = bot();
    expect(await say("ask K2 kahan hai?")).toBe("answer to K2 kahan hai?");
    expect(ask.mock.calls[0][1]).toMatch(/^[0-9a-f]{64}$/); // rate-limited per hashed user, not per phone
    expect(await say("ask")).toMatch(/Misaal/);
  });

  it("asks for text when a non-text message arrives", async () => {
    const { say } = bot();
    expect(await say(null)).toMatch(/text likhein/);
  });

  it("enforces a per-user daily message limit", async () => {
    const { say } = bot();
    for (let i = 0; i < DAILY_MESSAGES_PER_USER; i++) await say("help");
    expect(await say("help")).toMatch(/Aaj ki had/);
  });

  it("formats ask results with source links", () => {
    expect(formatAsk({ answer: "K2 [1]", sources: [{ n: 1, title: "کے ٹو", url: "https://u" }] })).toBe(
      "K2 [1]\n\n[1] کے ٹو: https://u",
    );
    expect(formatAsk({ answer: "Maazrat", sources: [] })).toBe("Maazrat");
    expect(formatAsk({ error: "rate", message: "Too many" })).toBe("Too many");
  });
});
