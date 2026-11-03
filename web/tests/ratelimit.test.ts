import { describe, expect, it } from "vitest";
import { MemoryKV } from "@/lib/kv";
import { dayKey, guardLlm, hit, LIMITS } from "@/lib/ratelimit";

const T0 = Date.UTC(2026, 10, 3, 12, 0, 0);

describe("MemoryKV", () => {
  it("expires values and consumes getdel once", async () => {
    let now = T0;
    const kv = new MemoryKV(() => now);
    await kv.set("k", { a: 1 }, 10);
    expect(await kv.get("k")).toEqual({ a: 1 });
    expect(await kv.getdel("k")).toEqual({ a: 1 });
    expect(await kv.getdel("k")).toBeNull();
    await kv.set("k", 1, 10);
    now += 11_000;
    expect(await kv.get("k")).toBeNull();
  });

  it("keeps the first TTL when a counter is incremented", async () => {
    let now = T0;
    const kv = new MemoryKV(() => now);
    expect(await kv.incr("c", 10)).toBe(1);
    now += 9_000;
    expect(await kv.incr("c", 10)).toBe(2);
    now += 2_000;
    expect(await kv.incr("c", 10)).toBe(1);
  });
});

describe("hit", () => {
  it("allows up to the limit per window, then resets in the next window", async () => {
    const kv = new MemoryKV(() => T0);
    for (let i = 0; i < 3; i++) expect((await hit(kv, "x", 3, 60, T0)).allowed).toBe(true);
    const blocked = await hit(kv, "x", 3, 60, T0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect((await hit(kv, "x", 3, 60, T0 + 60_000)).allowed).toBe(true);
    expect((await hit(kv, "other", 3, 60, T0)).allowed).toBe(true);
  });
});

describe("guardLlm", () => {
  it("is closed when the daily cap is 0", async () => {
    const kv = new MemoryKV(() => T0);
    expect(await guardLlm(kv, "c", 2, 0, T0)).toMatchObject({ ok: false, reason: "daily-cap" });
  });

  it("stops every client once the global daily cap is used, until the next UTC day", async () => {
    const kv = new MemoryKV(() => T0);
    expect(await guardLlm(kv, "c1", 2, 5, T0)).toEqual({ ok: true });
    expect(await guardLlm(kv, "c2", 2, 5, T0)).toEqual({ ok: true });
    const r = await guardLlm(kv, "c3", 2, 5, T0);
    expect(r).toMatchObject({ ok: false, reason: "daily-cap" });
    if (!r.ok) expect(r.retryAfter).toBe(12 * 3600);
    const tomorrow = T0 + 24 * 3600_000;
    expect(dayKey(tomorrow)).toBe("2026-11-04");
    expect(await guardLlm(new MemoryKV(() => tomorrow), "c3", 2, 5, tomorrow)).toEqual({ ok: true });
  });

  it("rate-limits one client per minute", async () => {
    const kv = new MemoryKV(() => T0);
    for (let i = 0; i < LIMITS.arenaPerMinute; i++) expect((await guardLlm(kv, "c", 1, 1000, T0)).ok).toBe(true);
    expect(await guardLlm(kv, "c", 1, 1000, T0)).toMatchObject({ ok: false, reason: "rate" });
    expect((await guardLlm(kv, "someone-else", 1, 1000, T0)).ok).toBe(true);
  });
});
