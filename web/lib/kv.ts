import { Redis } from "@upstash/redis";

/** The few key-value operations the live features need. Upstash in production, memory in tests and local dev. */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Read and delete in one step, so a value can be consumed only once. */
  getdel<T>(key: string): Promise<T | null>;
  /** Increment a counter; the TTL is set when the counter is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryKV implements KV {
  private data = new Map<string, { value: unknown; expires: number }>();
  constructor(private now: () => number = Date.now) {}

  private live(key: string) {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expires <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  async get<T>(key: string) {
    return (this.live(key)?.value as T) ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    this.data.set(key, { value: structuredClone(value), expires: this.now() + ttlSeconds * 1000 });
  }

  async getdel<T>(key: string) {
    const v = this.live(key);
    this.data.delete(key);
    return (v?.value as T) ?? null;
  }

  async incr(key: string, ttlSeconds: number) {
    const e = this.live(key);
    const n = ((e?.value as number) ?? 0) + 1;
    this.data.set(key, { value: n, expires: e?.expires ?? this.now() + ttlSeconds * 1000 });
    return n;
  }
}

export class UpstashKV implements KV {
  constructor(private redis: Redis) {}

  async get<T>(key: string) {
    return this.redis.get<T>(key);
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }

  async getdel<T>(key: string) {
    return this.redis.getdel<T>(key);
  }

  async incr(key: string, ttlSeconds: number) {
    const [n] = await this.redis.pipeline().incr(key).expire(key, ttlSeconds, "NX").exec<[number, number]>();
    return n;
  }
}
