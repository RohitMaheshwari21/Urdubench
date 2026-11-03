import { neon } from "@neondatabase/serverless";
import { cosineDistance, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { docChunks } from "@/drizzle/schema";

// Must match benchmark/urdubench/rag (EMBED_MODEL, EMBED_DIMS) so live queries hit the offline index.
export const EMBED_MODEL = "gemini-embedding-001";
export const EMBED_DIMS = 768;

export type Embed = (text: string) => Promise<number[]>;

export type Passage = { id: string; title: string; section: string; url: string; text: string; score: number };

export interface Retriever {
  search(vector: number[], k: number): Promise<Passage[]>;
}

export function normalize(v: number[]) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

/** Query embedding with the Gemini API (free tier; see the privacy page). */
export function geminiEmbed(apiKey: string, fetchFn: typeof fetch = fetch): Embed {
  return async (text) => {
    const res = await fetchFn(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: EMBED_DIMS,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) throw new Error(`embedding returned ${res.status}`);
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    if (!values || values.length !== EMBED_DIMS) throw new Error("bad embedding");
    return normalize(values);
  };
}

export class NeonRetriever implements Retriever {
  private db;
  constructor(url: string) {
    this.db = drizzle({ client: neon(url) });
  }

  async search(vector: number[], k: number) {
    const distance = cosineDistance(docChunks.embedding, vector);
    const rows = await this.db
      .select({
        id: docChunks.id,
        title: docChunks.title,
        section: docChunks.section,
        url: docChunks.url,
        text: docChunks.text,
        score: sql<number>`1 - (${distance})`,
      })
      .from(docChunks)
      .orderBy(distance)
      .limit(k);
    return rows.map((r) => ({ ...r, score: Number(r.score) }));
  }
}

/** Exact search over normalized vectors, for tests and local runs. */
export class MemoryRetriever implements Retriever {
  constructor(private rows: (Omit<Passage, "score"> & { embedding: number[] })[]) {}

  async search(vector: number[], k: number) {
    return this.rows
      .map(({ embedding, ...p }) => ({ ...p, score: embedding.reduce((s, x, i) => s + x * vector[i], 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

/** Decodes the offline index's float32 little-endian base64 vectors. */
export function unpackVector(b64: string): number[] {
  const buf = Buffer.from(b64, "base64");
  return Array.from({ length: buf.length / 4 }, (_, i) => buf.readFloatLE(i * 4));
}

/** Local runs only: searches data/rag/index.jsonl from disk, loaded on first use. */
export function fileRetriever(path: string): Retriever {
  let inner: MemoryRetriever | undefined;
  return {
    async search(vector, k) {
      if (!inner) {
        const { readFile } = await import("node:fs/promises");
        const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
        inner = new MemoryRetriever(
          lines.map((l) => {
            const r = JSON.parse(l);
            return { id: r.id, title: r.title, section: r.section, url: r.url, text: r.text, embedding: unpackVector(r.embedding) };
          }),
        );
      }
      return inner.search(vector, k);
    },
  };
}
