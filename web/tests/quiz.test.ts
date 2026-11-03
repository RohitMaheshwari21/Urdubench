import { describe, expect, it } from "vitest";
import { getItems } from "@/lib/data";
import { MemoryKV } from "@/lib/kv";
import { checkAnswer, nextQuestion, QUIZ_POOL_SIZE } from "@/lib/quiz";
import { LIMITS } from "@/lib/ratelimit";
import { MemoryStore } from "@/lib/store";

const ctx = { uid: "11111111-1111-4111-8111-111111111111", client: "c1" };
const items = getItems("T3").items;

describe("nextQuestion", () => {
  it("comes from the public dev split and hides the answer", () => {
    const q = nextQuestion();
    expect(items.map((i) => i.id)).toContain(q.id);
    expect(Object.keys(q).sort()).toEqual(["category", "choices", "id", "question"]);
    expect(q.choices).toHaveLength(4);
  });

  it("skips questions already seen, and starts over when all are used", () => {
    const seen = items.slice(0, -1).map((i) => i.id);
    expect(nextQuestion(seen).id).toBe(items[items.length - 1].id);
    expect(items.map((i) => i.id)).toContain(nextQuestion(items.map((i) => i.id)).id);
    expect(QUIZ_POOL_SIZE).toBe(items.length);
  });
});

describe("checkAnswer", () => {
  const item = items[0];
  const wrong = ["A", "B", "C", "D"].find((l) => l !== item.answer)!;

  it("checks the answer and records only correctness", async () => {
    const store = new MemoryStore();
    const deps = { kv: new MemoryKV(), store };
    const ok = await checkAnswer({ itemId: item.id, choice: item.answer }, ctx, deps);
    expect(ok).toEqual({ status: 200, body: { correct: true, answer: item.answer } });
    const bad = await checkAnswer({ itemId: item.id, choice: wrong }, ctx, deps);
    expect(bad.body.correct).toBe(false);
    expect(store.attempts).toEqual([
      { userId: ctx.uid, itemId: item.id, correct: true },
      { userId: ctx.uid, itemId: item.id, correct: false },
    ]);
  });

  it("works without any backend", async () => {
    const r = await checkAnswer({ itemId: item.id, choice: item.answer }, ctx, { kv: null, store: null });
    expect(r.status).toBe(200);
  });

  it("still answers when the database fails", async () => {
    const store = {
      recordVote: async () => true,
      recordQuizAttempt: async () => Promise.reject(new Error("db down")),
      deleteUser: async () => {},
    };
    const r = await checkAnswer({ itemId: item.id, choice: item.answer }, ctx, { kv: null, store });
    expect(r.status).toBe(200);
  });

  it("rejects bad input and unknown items", async () => {
    const deps = { kv: null, store: null };
    expect((await checkAnswer({ itemId: item.id, choice: "E" }, ctx, deps)).status).toBe(400);
    expect((await checkAnswer({ itemId: "t3-999", choice: "A" }, ctx, deps)).status).toBe(404);
    expect((await checkAnswer(null, ctx, deps)).status).toBe(400);
  });

  it("rate-limits answers", async () => {
    const deps = { kv: new MemoryKV(), store: null, now: Date.UTC(2026, 0, 1) };
    for (let i = 0; i < LIMITS.quizPerMinute; i++) await checkAnswer({ itemId: item.id, choice: "A" }, ctx, deps);
    expect((await checkAnswer({ itemId: item.id, choice: "A" }, ctx, deps)).status).toBe(429);
  });
});
