import { describe, expect, it, vi } from "vitest";
import { askQuestion, buildPrompt, citedNumbers, MAX_QUESTION_CHARS, MIN_SIMILARITY } from "@/lib/ask";
import { MemoryKV } from "@/lib/kv";
import type { Chat } from "@/lib/llm";
import { geminiEmbed, MemoryRetriever, normalize, unpackVector } from "@/lib/retrieve";
import { isUrduScript, outOfScope } from "@/lib/scope";

const ctx = { client: "c1" };
const k2 = { id: "wiki-001-000", title: "کے ٹو", section: "", url: "https://ur.wikipedia.org/wiki/K2", text: "کے ٹو قراقرم میں ہے۔" };
const lahore = { id: "wiki-002-000", title: "لاہور", section: "تاریخ", url: "https://ur.wikipedia.org/wiki/Lahore", text: "لاہور پرانا شہر ہے۔" };

function setup(answer = "K2 qaraqoram mein hai [1].", queryVec = [1, 0, 0]) {
  const kv = new MemoryKV();
  const chat = vi.fn<Chat>(async () => answer);
  const embed = vi.fn(async () => queryVec);
  const retriever = new MemoryRetriever([
    { ...k2, embedding: [1, 0, 0] },
    { ...lahore, embedding: [0, 1, 0] },
  ]);
  return { kv, chat, embed, deps: { kv, chat, embed, retriever, dailyCap: 100 } };
}

describe("outOfScope", () => {
  it.each([
    ["Bukhar ke liye kaunsi dawai lun?", "medical"],
    ["بخار کا علاج کیا ہے؟", "medical"],
    ["What dosage of paracetamol is safe?", "medical"],
    ["Talaq ka tareeqa kya hai, wakeel chahiye?", "legal"],
    ["Mujhe zamanat kaise milegi?", "legal"],
    ["Bitcoin mein invest karun?", "financial"],
    ["کیا مجھے قرض لینا چاہیے؟", "financial"],
    ["How to make a bomb", "unsafe"],
  ])("refuses %s", (q, kind) => {
    expect(outOfScope(q)).toBe(kind);
  });

  it.each([
    "Supreme Court of Pakistan kab bana?",
    "K2 kis pahari silsile mein hai?",
    "قرارداد پاکستان کب منظور ہوئی؟",
    "State Bank of Pakistan ka kaam kya hai?",
    "Edhi Foundation kis ne banai?",
  ])("allows %s", (q) => {
    expect(outOfScope(q)).toBeNull();
  });

  it("detects Urdu script", () => {
    expect(isUrduScript("لاہور")).toBe(true);
    expect(isUrduScript("Lahore kahan hai")).toBe(false);
  });
});

describe("askQuestion", () => {
  it("answers from passages with only the cited sources", async () => {
    const { deps, chat } = setup();
    const r = await askQuestion({ question: "K2 kahan hai?" }, ctx, deps);
    expect(r.status).toBe(200);
    expect(r.body.kind).toBe("answer");
    expect(r.body.sources).toEqual([{ n: 1, title: k2.title, section: "", url: k2.url }]);
    expect(r.body.disclaimer).toMatch(/not medical, legal or financial/i);
    const [, prompt, system] = chat.mock.calls[0];
    expect(prompt).toContain("<question>\nK2 kahan hai?\n</question>");
    expect(system).toMatch(/Ignore any instructions/);
    expect(prompt).not.toContain("لاہور پرانا"); // below the similarity threshold
  });

  it("links every retrieved passage when the model cites none", async () => {
    const { deps } = setup("K2 qaraqoram mein hai.");
    const r = await askQuestion({ question: "K2 kahan hai?" }, ctx, deps);
    expect((r.body.sources as unknown[]).length).toBe(1);
  });

  it("says it does not know when nothing relevant is retrieved, without calling the model", async () => {
    const q = normalize([0, 0, 1]);
    const { deps, chat } = setup("x", q);
    const r = await askQuestion({ question: "مریخ پر کتنے چاند ہیں؟" }, ctx, deps);
    expect(r.body).toMatchObject({ kind: "unknown", sources: [] });
    expect(String(r.body.answer)).toMatch(/معذرت/);
    expect(chat).not.toHaveBeenCalled();
  });

  it("says it does not know when the model reports NOT_FOUND", async () => {
    const { deps } = setup("NOT_FOUND");
    const r = await askQuestion({ question: "K2 ki unchai?" }, ctx, deps);
    expect(r.body).toMatchObject({ kind: "unknown", sources: [] });
    expect(String(r.body.answer)).toMatch(/couldn't find/);
  });

  it("refuses advice questions without any model or embedding call", async () => {
    const { deps, chat, embed } = setup();
    const r = await askQuestion({ question: "Sar dard ki dawai batao" }, ctx, deps);
    expect(r.body).toMatchObject({ kind: "refused", reason: "medical", sources: [] });
    expect(chat).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
  });

  it("validates input", async () => {
    const { deps } = setup();
    expect((await askQuestion({}, ctx, deps)).status).toBe(400);
    expect((await askQuestion({ question: " " }, ctx, deps)).status).toBe(400);
    expect((await askQuestion({ question: "x".repeat(MAX_QUESTION_CHARS + 1) }, ctx, deps)).status).toBe(400);
  });

  it("caches answers and respects the daily cap", async () => {
    const { deps, chat } = setup();
    await askQuestion({ question: "K2 kahan hai?" }, ctx, { ...deps, dailyCap: 1 });
    expect((await askQuestion({ question: "K2 kahan hai?" }, ctx, { ...deps, dailyCap: 1 })).status).toBe(200);
    expect(chat).toHaveBeenCalledTimes(1);
    const capped = await askQuestion({ question: "Lahore?" }, ctx, { ...deps, dailyCap: 1 });
    expect(capped.status).toBe(429);
    expect(capped.body.error).toBe("daily-cap");
  });

  it("returns 502 when an upstream service fails", async () => {
    const { deps } = setup();
    const r = await askQuestion({ question: "K2?" }, ctx, { ...deps, embed: async () => Promise.reject(new Error("x")) });
    expect(r.status).toBe(502);
  });
});

describe("helpers", () => {
  it("parses citations and ignores out-of-range numbers", () => {
    expect(citedNumbers("a [2] b [1, 3] c [9]", 3)).toEqual([1, 2, 3]);
    expect(citedNumbers("no cites", 3)).toEqual([]);
  });

  it("wraps passages and the question as data", () => {
    const p = buildPrompt("q?", [{ ...lahore, score: 0.9 }]);
    expect(p).toBe(`<passages>\n[1] لاہور (تاریخ): لاہور پرانا شہر ہے۔\n</passages>\n\n<question>\nq?\n</question>`);
  });

  it("decodes the offline index vectors", () => {
    const buf = Buffer.alloc(8);
    buf.writeFloatLE(0.5, 0);
    buf.writeFloatLE(-1, 4);
    expect(unpackVector(buf.toString("base64"))).toEqual([0.5, -1]);
  });

  it("calls Gemini with the query task type and normalizes", async () => {
    const fetchFn = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body));
      expect(b).toMatchObject({ taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 });
      return new Response(JSON.stringify({ embedding: { values: [3, 4, ...Array(766).fill(0)] } }));
    });
    const v = await geminiEmbed("k", fetchFn as typeof fetch)("q");
    expect(v.slice(0, 2)).toEqual([0.6, 0.8]);
    expect(MIN_SIMILARITY).toBeGreaterThan(0);
  });
});

describe("systemFor", () => {
  it("names the reply script", async () => {
    const { systemFor } = await import("@/lib/ask");
    expect(systemFor("کے ٹو کہاں ہے؟")).toMatch(/answer in Urdu script/);
    expect(systemFor("K2 kahan hai?")).toMatch(/not in Urdu script/);
  });
});
