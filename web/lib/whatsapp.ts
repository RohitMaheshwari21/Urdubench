import { createHmac, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { waUsers } from "@/drizzle/schema";
import { sha256 } from "./arena";
import type { KV } from "./kv";
import { getQuizItem, LETTERS, nextQuestion } from "./quiz";
import { hit } from "./ratelimit";

// ---------- webhook plumbing ----------

/** Meta signs the raw body: X-Hub-Signature-256: sha256=<hex HMAC-SHA256(body, app secret)>. */
export function verifySignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  const given = Buffer.from(header.slice(7), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type Incoming = { id: string; from: string; text: string | null };

/** Text messages from a webhook payload; other message types come back with text null. */
export function parseMessages(payload: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;
  for (const e of entries as { changes?: { field?: string; value?: { messages?: unknown[] } }[] }[])
    for (const c of e.changes ?? []) {
      if (c.field !== "messages") continue;
      for (const m of (c.value?.messages ?? []) as { id?: string; from?: string; type?: string; text?: { body?: string } }[])
        if (m.id && m.from) out.push({ id: m.id, from: m.from, text: m.type === "text" ? (m.text?.body ?? "") : null });
    }
  return out;
}

/** True the first time a message id is seen (Meta retries can deliver duplicates). */
export async function firstDelivery(kv: KV, messageId: string) {
  return (await kv.incr(`wa:seen:${messageId}`, 2 * 24 * 3600)) === 1;
}

export function hashPhone(phone: string, salt: string) {
  return sha256(`wa|${salt}|${phone}`);
}

export type Send = (to: string, body: string) => Promise<void>;

export function cloudApiSend(token: string, phoneNumberId: string, version = "v26.0", fetchFn: typeof fetch = fetch): Send {
  return async (to, body) => {
    const res = await fetchFn(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body, preview_url: false } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`WhatsApp send returned ${res.status}`);
  };
}

// ---------- state ----------

export type Lang = "ur" | "roman" | "en";
export type WaState = { id: string; language: Lang; currentItem: string | null; answered: number; correct: number; streak: number };

export interface WaStore {
  get(id: string): Promise<WaState | null>;
  save(s: WaState): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemoryWaStore implements WaStore {
  rows = new Map<string, WaState>();
  async get(id: string) {
    const r = this.rows.get(id);
    return r ? { ...r } : null;
  }
  async save(s: WaState) {
    this.rows.set(s.id, { ...s });
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
}

export class NeonWaStore implements WaStore {
  private db;
  constructor(url: string) {
    this.db = drizzle({ client: neon(url) });
  }
  async get(id: string) {
    const [r] = await this.db.select().from(waUsers).where(eq(waUsers.id, id)).limit(1);
    return r ? { id: r.id, language: r.language, currentItem: r.currentItem, answered: r.answered, correct: r.correct, streak: r.streak } : null;
  }
  async save(s: WaState) {
    const { language, currentItem, answered, correct, streak } = s;
    await this.db
      .insert(waUsers)
      .values(s)
      .onConflictDoUpdate({
        target: waUsers.id,
        set: { language, currentItem, answered, correct, streak, updatedAt: sql`now()` },
      });
  }
  async delete(id: string) {
    await this.db.delete(waUsers).where(eq(waUsers.id, id));
  }
}

// ---------- conversation ----------

export const DAILY_MESSAGES_PER_USER = 60;

const T: Record<string, Record<Lang, string>> = {
  help: {
    ur: "اردو بینچ بوٹ\n• quiz: پاکستان کوئز کا سوال\n• A/B/C/D: جواب دیں\n• score: آپ کا اسکور\n• ask <سوال>: مختصر جواب (ویکیپیڈیا سے)\n• language ur / roman / en\n• stop: آپ کا تمام ڈیٹا مٹا دیں\nصرف معلومات کے لیے، طبی، قانونی یا مالی مشورہ نہیں۔",
    roman: "Urdu-Bench bot\n• quiz: Pakistan quiz ka sawal\n• A/B/C/D: jawab dein\n• score: aap ka score\n• ask <sawal>: mukhtasar jawab (Wikipedia se)\n• language ur / roman / en\n• stop: aap ka sara data mita dein\nSirf maloomat ke liye, medical, legal ya financial mashwara nahin.",
    en: "Urdu-Bench bot\n• quiz: a Pakistan quiz question\n• A/B/C/D: answer it\n• score: your score\n• ask <question>: a short answer (from Wikipedia)\n• language ur / roman / en\n• stop: delete all your data\nInformational only, not medical, legal or financial advice.",
  },
  correct: { ur: "✅ درست!", roman: "✅ Sahi jawab!", en: "✅ Correct!" },
  wrong: { ur: "❌ غلط۔ درست جواب: ", roman: "❌ Ghalat. Sahi jawab: ", en: "❌ Not quite. The answer is " },
  next: { ur: "اگلے سوال کے لیے quiz لکھیں۔", roman: "Agla sawal: quiz likhein.", en: "Type quiz for the next one." },
  noQuestion: { ur: "پہلے quiz لکھیں۔", roman: "Pehle quiz likhein.", en: "Type quiz first to get a question." },
  score: { ur: "آپ کا اسکور: ", roman: "Aap ka score: ", en: "Your score: " },
  streak: { ur: "مسلسل درست: ", roman: "Lagataar sahi: ", en: "Streak: " },
  stopped: {
    ur: "آپ کا تمام ڈیٹا مٹا دیا گیا۔ دوبارہ شروع کرنے کے لیے help لکھیں۔",
    roman: "Aap ka sara data mita diya gaya. Dobara shuru karne ke liye help likhein.",
    en: "All your data has been deleted. Type help to start again.",
  },
  language: { ur: "زبان: اردو", roman: "Zaban: Roman Urdu", en: "Language: English" },
  askEmpty: { ur: "مثال: ask کے ٹو کہاں ہے؟", roman: "Misaal: ask K2 kahan hai?", en: "Example: ask Where is K2?" },
  limit: {
    ur: "آج کی حد پوری ہو گئی۔ کل دوبارہ آئیں۔",
    roman: "Aaj ki had poori ho gayi. Kal dobara aayein.",
    en: "You've reached today's limit. Please come back tomorrow.",
  },
  notText: { ur: "براہِ کرم ٹیکسٹ میں لکھیں۔ help", roman: "Meherbani karke text likhein. help", en: "Please send text. Type help." },
};

export type AskFn = (question: string, client: string) => Promise<string>;

/** Formats an /api/ask-style result for WhatsApp: answer plus numbered source links. */
export function formatAsk(body: Record<string, unknown>): string {
  const sources = (body.sources as { n: number; title: string; url: string }[] | undefined) ?? [];
  const links = sources.map((s) => `[${s.n}] ${s.title}: ${s.url}`).join("\n");
  return [String(body.answer ?? body.message ?? ""), links].filter(Boolean).join("\n\n");
}

function quizText(id: string | null) {
  const q = nextQuestion(id ? [id] : []);
  const body = `${q.question}\n\n${q.choices.map((c, i) => `${LETTERS[i]}. ${c}`).join("\n")}`;
  return { id: q.id, body };
}

/**
 * One incoming message -> one reply. Pure apart from the store, KV and ask function, so it is testable.
 * A row is created only when the user plays the quiz or sets a language; STOP deletes it.
 */
export async function handleMessage(
  from: string,
  text: string | null,
  deps: { store: WaStore; kv: KV; ask: AskFn | null; salt: string; now?: number },
): Promise<string> {
  const id = hashPhone(from, deps.salt);
  const day = await hit(deps.kv, `wa:day:${id}`, DAILY_MESSAGES_PER_USER, 86400, deps.now);
  const existing = await deps.store.get(id);
  const s: WaState = existing ?? { id, language: "roman", currentItem: null, answered: 0, correct: 0, streak: 0 };
  const L = s.language;
  if (!day.allowed) return T.limit[L];
  if (text === null) return T.notText[L];

  const msg = text.trim();
  const cmd = msg.toLowerCase();

  if (cmd === "stop" || cmd === "بند") {
    await deps.store.delete(id);
    return T.stopped[L];
  }
  if (cmd.startsWith("language") || cmd.startsWith("zaban")) {
    const want = cmd.split(/\s+/)[1];
    if (want === "ur" || want === "roman" || want === "en") s.language = want;
    await deps.store.save(s);
    return T.language[s.language];
  }
  if (cmd === "quiz" || cmd === "کوئز") {
    const q = quizText(s.currentItem);
    s.currentItem = q.id;
    await deps.store.save(s);
    return q.body;
  }
  const letter = /^\(?([abcd])\)?[.)]?$/i.exec(msg)?.[1]?.toUpperCase();
  if (letter) {
    const item = s.currentItem ? getQuizItem(s.currentItem) : null;
    if (!item) return T.noQuestion[L];
    const ok = letter === item.answer;
    s.answered++;
    if (ok) {
      s.correct++;
      s.streak++;
    } else s.streak = 0;
    s.currentItem = null;
    await deps.store.save(s);
    const verdict = ok ? T.correct[L] : `${T.wrong[L]}${item.answer}. ${item.choices[LETTERS.indexOf(item.answer as "A")]}`;
    return `${verdict}\n${T.score[L]}${s.correct}/${s.answered}\n${T.next[L]}`;
  }
  if (cmd === "score") return `${T.score[L]}${s.correct}/${s.answered}\n${T.streak[L]}${s.streak}`;
  if (cmd === "ask" || cmd.startsWith("ask ") || cmd.startsWith("sawal ")) {
    const q = msg.replace(/^(ask|sawal)\s*/i, "");
    if (!q || !deps.ask) return T.askEmpty[L];
    return deps.ask(q, id);
  }
  return T.help[L];
}
