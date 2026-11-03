import type { KV } from "./kv";

export type LimitResult = { ok: true } | { ok: false; reason: "rate" | "daily-cap"; retryAfter: number };

/** Fixed-window counter: at most `limit` hits per `windowSeconds` for one key. */
export async function hit(kv: KV, key: string, limit: number, windowSeconds: number, now = Date.now()) {
  const window = Math.floor(now / 1000 / windowSeconds);
  const n = await kv.incr(`rl:${key}:${window}`, windowSeconds);
  return { allowed: n <= limit, retryAfter: windowSeconds - (Math.floor(now / 1000) % windowSeconds) };
}

/** UTC day, used for the global daily cap on live LLM calls. */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function secondsToUtcMidnight(now: number) {
  const d = new Date(now);
  return Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now) / 1000);
}

export const LIMITS = {
  arenaPerMinute: 4,
  arenaPerDay: 40,
  votePerMinute: 20,
  quizPerMinute: 60,
};

/**
 * Checks the per-client limits, then reserves `calls` LLM calls against the global daily cap.
 * A cap of 0 disables live LLM calls entirely (the safe default when DAILY_SPEND_CAP is unset).
 */
export async function guardLlm(
  kv: KV,
  client: string,
  calls: number,
  dailyCap: number,
  now = Date.now(),
): Promise<LimitResult> {
  const minute = await hit(kv, `arena:min:${client}`, LIMITS.arenaPerMinute, 60, now);
  if (!minute.allowed) return { ok: false, reason: "rate", retryAfter: minute.retryAfter };
  const day = await hit(kv, `arena:day:${client}`, LIMITS.arenaPerDay, 86400, now);
  if (!day.allowed) return { ok: false, reason: "rate", retryAfter: day.retryAfter };

  const ttl = secondsToUtcMidnight(now) + 3600;
  let used = 0;
  for (let i = 0; i < calls; i++) used = await kv.incr(`llm:calls:${dayKey(now)}`, ttl);
  if (used > dailyCap) return { ok: false, reason: "daily-cap", retryAfter: secondsToUtcMidnight(now) };
  return { ok: true };
}
