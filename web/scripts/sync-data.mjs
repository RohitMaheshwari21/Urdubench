// Copies benchmark results into web/data so the site builds from files inside its own root
// (Vercel builds with Root Directory = web, which cannot see ../results).
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, "..");
const results = resolve(web, "..", "results");
const out = join(web, "data");

const copies = [
  [join(results, "leaderboard.json"), join(out, "leaderboard.json")],
  [join(results, "analysis-dev.json"), join(out, "analysis.json")],
];
for (const task of ["T1", "T2", "T3", "T4"]) {
  copies.push([join(results, "items", "dev", `${task}.json`), join(out, "items", `${task}.json`)]);
}

let missing = 0;
mkdirSync(join(out, "items"), { recursive: true });
for (const [from, to] of copies) {
  if (!existsSync(from)) {
    console.error(`missing ${from}`);
    missing++;
    continue;
  }
  cpSync(from, to);
  console.log(`copied ${from.replace(results, "results")} -> ${to.replace(web, "web")}`);
}
if (missing) process.exit(1);
console.log(`synced ${copies.length} files; items dir: ${readdirSync(join(out, "items")).join(", ")}`);
