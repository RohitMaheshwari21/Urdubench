// Loads the offline RAG index (data/rag/index.jsonl, built by `urdubench rag build`) into Neon.
//   DATABASE_URL=... node scripts/load-index.mjs [path/to/index.jsonl]
// Run `npm run db:migrate` first (creates the vector extension and doc_chunks). Re-running upserts.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const here = dirname(fileURLToPath(import.meta.url));
const path = process.argv[2] ?? resolve(here, "..", "..", "data", "rag", "index.jsonl");
if (!process.env.DATABASE_URL) throw new Error("set DATABASE_URL");
const sql = neon(process.env.DATABASE_URL);

function unpack(b64) {
  const buf = Buffer.from(b64, "base64");
  return Array.from({ length: buf.length / 4 }, (_, i) => buf.readFloatLE(i * 4));
}

const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const BATCH = 50;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH).map((r) => ({
    id: r.id,
    title: r.title,
    section: r.section,
    url: r.url,
    text: r.text,
    embedding: `[${unpack(r.embedding).join(",")}]`,
  }));
  await sql`
    insert into doc_chunks (id, title, section, url, text, embedding)
    select x.id, x.title, x.section, x.url, x.text, x.embedding::vector
    from json_to_recordset(${JSON.stringify(batch)}::json)
      as x(id text, title text, section text, url text, text text, embedding text)
    on conflict (id) do update set title = excluded.title, section = excluded.section,
      url = excluded.url, text = excluded.text, embedding = excluded.embedding`;
  console.log(`loaded ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
}
const [{ n }] = await sql`select count(*)::int as n from doc_chunks`;
console.log(`doc_chunks now has ${n} rows`);
