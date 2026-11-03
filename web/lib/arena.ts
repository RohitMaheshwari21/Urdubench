import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { KV } from "./kv";
import { ARENA_MODELS, type ArenaModel, type Chat, MAX_PROMPT_CHARS } from "./llm";
import { guardLlm, hit, LIMITS } from "./ratelimit";
import type { Store, Winner } from "./store";

export type Result = { status: number; body: Record<string, unknown> };

export const BATTLE_TTL_SECONDS = 30 * 60;
const ANSWER_CACHE_SECONDS = 24 * 3600;

type Battle = { uid: string; a: string; b: string; promptChars: number };

export const AskBody = z.object({ prompt: z.string() });
export const VoteBody = z.object({
  battleId: z.uuid(),
  winner: z.enum(["a", "b", "tie", "both_bad"]),
});

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Two different models, in random order. */
export function pickPair(models: ArenaModel[] = ARENA_MODELS, rand: () => number = Math.random): [ArenaModel, ArenaModel] {
  const i = Math.floor(rand() * models.length);
  let j = Math.floor(rand() * (models.length - 1));
  if (j >= i) j++;
  return [models[i], models[j]];
}

function labelOf(id: string) {
  return ARENA_MODELS.find((m) => m.id === id)?.label ?? id;
}

const busy = (r: { reason: string; retryAfter: number }): Result =>
  r.reason === "daily-cap"
    ? {
        status: 429,
        body: { error: "daily-cap", message: "The arena has reached today's limit. Please come back tomorrow." },
      }
    : {
        status: 429,
        body: { error: "rate", message: "Too many requests. Please wait a minute.", retryAfter: r.retryAfter },
      };

export async function startBattle(
  input: unknown,
  ctx: { uid: string; client: string },
  deps: { kv: KV; chat: Chat; dailyCap: number; rand?: () => number; now?: number },
): Promise<Result> {
  const parsed = AskBody.safeParse(input);
  if (!parsed.success) return { status: 400, body: { error: "bad-request" } };
  const prompt = parsed.data.prompt.trim();
  if (!prompt) return { status: 400, body: { error: "empty", message: "Please type a question." } };
  if (prompt.length > MAX_PROMPT_CHARS)
    return { status: 400, body: { error: "too-long", message: `Please keep it under ${MAX_PROMPT_CHARS} characters.` } };

  const pair = pickPair(ARENA_MODELS, deps.rand);
  const answers: string[] = [];
  // Cached answers cost nothing, so only uncached models count against the limits.
  const keys = pair.map((m) => `ans:${sha256(`${m.id}\n${prompt}`)}`);
  const cachedAnswers = await Promise.all(keys.map((k) => deps.kv.get<string>(k)));
  const toCall = cachedAnswers.filter((c) => c === null).length;
  if (toCall > 0) {
    const g = await guardLlm(deps.kv, ctx.client, toCall, deps.dailyCap, deps.now);
    if (!g.ok) return busy(g);
  }
  try {
    const out = await Promise.all(
      pair.map(async (m, i) => {
        if (cachedAnswers[i] !== null) return cachedAnswers[i] as string;
        const text = await deps.chat(m, prompt);
        await deps.kv.set(keys[i], text, ANSWER_CACHE_SECONDS);
        return text;
      }),
    );
    answers.push(...out);
  } catch {
    return { status: 502, body: { error: "model", message: "A model did not answer. Please try again." } };
  }

  const battleId = randomUUID();
  const battle: Battle = { uid: ctx.uid, a: pair[0].id, b: pair[1].id, promptChars: prompt.length };
  await deps.kv.set(`battle:${battleId}`, battle, BATTLE_TTL_SECONDS);
  return { status: 200, body: { battleId, a: answers[0], b: answers[1] } };
}

export async function castVote(
  input: unknown,
  ctx: { uid: string; client: string },
  deps: { kv: KV; store: Store; now?: number },
): Promise<Result> {
  const parsed = VoteBody.safeParse(input);
  if (!parsed.success) return { status: 400, body: { error: "bad-request" } };
  const limit = await hit(deps.kv, `vote:${ctx.client}`, LIMITS.votePerMinute, 60, deps.now);
  if (!limit.allowed) return busy({ reason: "rate", retryAfter: limit.retryAfter });

  const key = `battle:${parsed.data.battleId}`;
  const peek = await deps.kv.get<Battle>(key);
  if (!peek) return { status: 404, body: { error: "gone", message: "This battle has expired or was already voted on." } };
  if (peek.uid !== ctx.uid) return { status: 403, body: { error: "forbidden" } };
  // getdel makes the vote single-use even if two requests race; the unique battle_id is the second guard.
  const battle = await deps.kv.getdel<Battle>(key);
  if (!battle) return { status: 404, body: { error: "gone", message: "This battle was already voted on." } };

  const winner: Winner = parsed.data.winner;
  const saved = await deps.store.recordVote({
    battleId: parsed.data.battleId,
    userId: ctx.uid,
    modelA: battle.a,
    modelB: battle.b,
    winner,
    promptChars: battle.promptChars,
  });
  if (!saved) return { status: 409, body: { error: "duplicate", message: "This battle was already voted on." } };
  return { status: 200, body: { a: labelOf(battle.a), b: labelOf(battle.b), winner } };
}
