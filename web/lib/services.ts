import { Redis } from "@upstash/redis";
import { dailySpendCap } from "./config";
import { type KV, MemoryKV, UpstashKV } from "./kv";
import { type Chat, groqChat } from "./llm";
import { MemoryStore, NeonStore, type Store } from "./store";

export type Services = { kv: KV | null; store: Store | null; chat: Chat | null; dailyCap: number };

let cached: Services | undefined;
let memory: { kv: MemoryKV; store: MemoryStore } | undefined;

/**
 * Builds the live backends from environment variables. Anything not configured is null and the routes
 * that need it answer 503. URDUBENCH_MEMORY_BACKEND=1 swaps in memory backends for local runs only;
 * it is ignored on Vercel so production can never silently lose votes.
 */
export function getServices(env: NodeJS.ProcessEnv = process.env): Services {
  if (cached && env === process.env) return cached;
  const useMemory = env.URDUBENCH_MEMORY_BACKEND === "1" && !env.VERCEL;
  const mem = useMemory ? (memory ??= { kv: new MemoryKV(), store: new MemoryStore() }) : undefined;

  // Upstash added through the Vercel marketplace names its variables KV_REST_API_*.
  const redisUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const kv = redisUrl && redisToken ? new UpstashKV(new Redis({ url: redisUrl, token: redisToken })) : (mem?.kv ?? null);
  const store = env.DATABASE_URL ? new NeonStore(env.DATABASE_URL) : (mem?.store ?? null);
  const chat = env.LLM_API_KEY ? groqChat(env.LLM_API_KEY, env.LLM_BASE_URL || undefined) : null;

  const s = { kv, store, chat, dailyCap: dailySpendCap(env) };
  if (env === process.env) cached = s;
  return s;
}
