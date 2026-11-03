// Measures route latency (p50 / p95 / max) against a running site and checks the main flows.
//   node scripts/measure-latency.mjs http://localhost:3000 [quizRequests=40] [arenaBattles=4]
// Arena battles make real model calls, so keep that number small (default 4 = the per-minute limit).
const base = process.argv[2] ?? "http://localhost:3000";
const nQuiz = Number(process.argv[3] ?? 40);
const nArena = Number(process.argv[4] ?? 4);
let cookie = "";

async function call(method, path, body) {
  const t = performance.now();
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
    body: body && JSON.stringify(body),
  });
  const ms = performance.now() - t;
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  return { status: res.status, ms, data: await res.json().catch(() => null) };
}

function stats(name, xs) {
  const s = xs.map((x) => x.ms).sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
  const codes = [...new Set(xs.map((x) => x.status))].join(",");
  console.log(`${name.padEnd(12)} n=${String(s.length).padEnd(4)} p50=${q(0.5).toFixed(0)}ms p95=${q(0.95).toFixed(0)}ms max=${s.at(-1).toFixed(0)}ms status=${codes}`);
}

const quizGet = [];
const quizPost = [];
for (let i = 0; i < nQuiz; i++) {
  const g = await call("GET", "/api/quiz");
  quizGet.push(g);
  quizPost.push(await call("POST", "/api/quiz", { itemId: g.data.question.id, choice: "A" }));
}
stats("quiz GET", quizGet);
stats("quiz POST", quizPost);

const arena = [];
const votes = [];
for (let i = 0; i < nArena; i++) {
  const a = await call("POST", "/api/arena", { prompt: `Pakistan ka qaumi phool kaunsa hai? (${i})` });
  arena.push(a);
  if (a.status === 200) votes.push(await call("POST", "/api/vote", { battleId: a.data.battleId, winner: "tie" }));
  else console.log("arena", a.status, a.data);
}
if (arena.length) stats("arena", arena);
if (votes.length) stats("vote", votes);
const extra = await call("POST", "/api/arena", { prompt: "one more" });
console.log(`arena after per-minute limit: ${extra.status} ${extra.data?.error ?? ""}`);
if (votes[0]) {
  const again = await call("POST", "/api/vote", { battleId: arena[0].data.battleId, winner: "a" });
  console.log(`second vote on the same battle: ${again.status} ${again.data?.error ?? ""}`);
}
