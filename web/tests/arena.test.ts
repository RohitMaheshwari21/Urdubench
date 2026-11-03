import { describe, expect, it, vi } from "vitest";
import { castVote, pickPair, startBattle } from "@/lib/arena";
import { MemoryKV } from "@/lib/kv";
import { ARENA_MODELS, groqChat, MAX_PROMPT_CHARS, type Chat } from "@/lib/llm";
import { getServices } from "@/lib/services";
import { MemoryStore } from "@/lib/store";

const me = { uid: "11111111-1111-4111-8111-111111111111", client: "c1" };
const other = { uid: "22222222-2222-4222-8222-222222222222", client: "c2" };

function setup(cap = 100) {
  const kv = new MemoryKV();
  const store = new MemoryStore();
  const chat = vi.fn<Chat>(async (m, p) => `${m.id} says: ${p}`);
  return { kv, store, chat, deps: { kv, chat, dailyCap: cap } };
}

describe("pickPair", () => {
  it("always picks two different models and covers every pair", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const [a, b] = pickPair();
      expect(a.id).not.toBe(b.id);
      seen.add(`${a.id}|${b.id}`);
    }
    expect(seen.size).toBe(ARENA_MODELS.length * (ARENA_MODELS.length - 1));
  });
});

describe("startBattle", () => {
  it("validates the prompt", async () => {
    const { deps, chat } = setup();
    expect((await startBattle({}, me, deps)).status).toBe(400);
    expect((await startBattle({ prompt: "   " }, me, deps)).status).toBe(400);
    expect((await startBattle({ prompt: "x".repeat(MAX_PROMPT_CHARS + 1) }, me, deps)).status).toBe(400);
    expect(chat).not.toHaveBeenCalled();
  });

  it("returns two anonymous answers and no model names", async () => {
    const { deps } = setup();
    const r = await startBattle({ prompt: "Salam" }, me, deps);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(["a", "b", "battleId"]);
  });

  it("serves repeated questions from the cache without new model calls", async () => {
    const { deps, chat } = setup();
    const rand = () => 0;
    await startBattle({ prompt: "Salam" }, me, { ...deps, rand });
    await startBattle({ prompt: "Salam" }, me, { ...deps, rand });
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("answers 'come back tomorrow' when the daily cap is reached", async () => {
    const { deps, chat } = setup(2);
    expect((await startBattle({ prompt: "one" }, me, deps)).status).toBe(200);
    const r = await startBattle({ prompt: "two" }, other, deps);
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("daily-cap");
    expect(String(r.body.message)).toMatch(/tomorrow/);
    expect(chat).toHaveBeenCalledTimes(2);
  });

  it("reports a model failure as 502", async () => {
    const { deps } = setup();
    const r = await startBattle({ prompt: "x" }, me, { ...deps, chat: async () => Promise.reject(new Error("down")) });
    expect(r.status).toBe(502);
  });
});

describe("castVote", () => {
  async function battle() {
    const s = setup();
    const r = await startBattle({ prompt: "Salam" }, me, s.deps);
    return { ...s, battleId: r.body.battleId as string };
  }

  it("records one vote and reveals the models", async () => {
    const { kv, store, battleId } = await battle();
    const r = await castVote({ battleId, winner: "a" }, me, { kv, store });
    expect(r.status).toBe(200);
    expect(ARENA_MODELS.map((m) => m.label)).toContain(r.body.a);
    expect(store.votes).toHaveLength(1);
    expect(store.votes[0]).toMatchObject({ battleId, userId: me.uid, winner: "a", promptChars: 5 });
    expect(JSON.stringify(store.votes)).not.toContain("Salam");
  });

  it("allows only one vote per battle", async () => {
    const { kv, store, battleId } = await battle();
    expect((await castVote({ battleId, winner: "a" }, me, { kv, store })).status).toBe(200);
    expect((await castVote({ battleId, winner: "b" }, me, { kv, store })).status).toBe(404);
    expect(store.votes).toHaveLength(1);
  });

  it("refuses a vote from another session", async () => {
    const { kv, store, battleId } = await battle();
    expect((await castVote({ battleId, winner: "a" }, other, { kv, store })).status).toBe(403);
    expect((await castVote({ battleId, winner: "a" }, me, { kv, store })).status).toBe(200);
  });

  it("rejects malformed and unknown votes", async () => {
    const { kv, store } = await battle();
    expect((await castVote({ battleId: "nope", winner: "a" }, me, { kv, store })).status).toBe(400);
    expect((await castVote({ battleId: crypto.randomUUID(), winner: "x" }, me, { kv, store })).status).toBe(400);
    expect((await castVote({ battleId: crypto.randomUUID(), winner: "a" }, me, { kv, store })).status).toBe(404);
  });

  it("returns 409 if the store already has the battle", async () => {
    const { kv, store, battleId } = await battle();
    await store.recordVote({ battleId, userId: me.uid, modelA: "x", modelB: "y", winner: "a", promptChars: 1 });
    expect((await castVote({ battleId, winner: "a" }, me, { kv, store })).status).toBe(409);
  });
});

describe("groqChat", () => {
  it("sends model settings and output limits, and rejects empty replies", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.max_tokens).toBe(350);
      expect(body.reasoning_effort).toBe("low");
      return new Response(JSON.stringify({ choices: [{ message: { content: " hi " } }] }));
    });
    const chat = groqChat("k", "https://example.test", fetchFn as typeof fetch);
    expect(await chat(ARENA_MODELS[1], "q")).toBe("hi");

    const empty = groqChat("k", "https://example.test", (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }))) as typeof fetch);
    await expect(empty(ARENA_MODELS[0], "q")).rejects.toThrow(/empty/);
  });
});

describe("getServices", () => {
  it("is not configured without environment variables", () => {
    const s = getServices({ NODE_ENV: "test" });
    expect(s).toMatchObject({ kv: null, store: null, chat: null, dailyCap: 0 });
  });

  it("uses memory backends locally but never on Vercel", () => {
    const local = getServices({ NODE_ENV: "test", URDUBENCH_MEMORY_BACKEND: "1" });
    expect(local.kv).toBeInstanceOf(MemoryKV);
    const vercel = getServices({ NODE_ENV: "test", URDUBENCH_MEMORY_BACKEND: "1", VERCEL: "1" });
    expect(vercel.kv).toBeNull();
    expect(vercel.store).toBeNull();
  });
});

describe("deleteUser", () => {
  it("removes only that user's votes and quiz answers", async () => {
    const store = new MemoryStore();
    const row = { modelA: "x", modelB: "y", winner: "a" as const, promptChars: 3 };
    await store.recordVote({ ...row, battleId: "b1", userId: me.uid });
    await store.recordVote({ ...row, battleId: "b2", userId: other.uid });
    await store.recordQuizAttempt({ userId: me.uid, itemId: "t3-001", correct: true });
    await store.deleteUser(me.uid);
    expect(store.votes.map((v) => v.userId)).toEqual([other.uid]);
    expect(store.attempts).toEqual([]);
  });
});

describe("getServices with Upstash", () => {
  it("accepts the Vercel marketplace variable names", () => {
    const s = getServices({ NODE_ENV: "test", KV_REST_API_URL: "https://example.upstash.io", KV_REST_API_TOKEN: "t" });
    expect(s.kv).not.toBeNull();
    expect(s.kv).not.toBeInstanceOf(MemoryKV);
  });
});
