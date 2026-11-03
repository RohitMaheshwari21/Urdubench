// Usage counts for the progress report and the about page: totals only, no ids or timestamps per row.
//   DATABASE_URL=... node scripts/export-usage.mjs     -> results/usage.json
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("set DATABASE_URL");
const sql = neon(process.env.DATABASE_URL);
const [row] = await sql`
  select
    (select count(*)::int from users) as web_users,
    (select count(*)::int from votes) as arena_votes,
    (select count(*)::int from quiz_attempts) as quiz_answers,
    (select count(distinct user_id)::int from quiz_attempts) as quiz_players,
    (select count(*)::int from wa_users) as whatsapp_users,
    (select coalesce(sum(answered), 0)::int from wa_users) as whatsapp_quiz_answers,
    (select count(*)::int from doc_chunks) as rag_chunks`;
const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "results", "usage.json");
writeFileSync(out, JSON.stringify({ generated_at: new Date().toISOString(), ...row }, null, 2) + "\n");
console.log(row);
