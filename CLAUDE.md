# Rules for Claude (from PLAN.md Section 0)

1. Work one phase at a time. Do not start the next phase until the acceptance checklist passes and the user approves.
2. Before writing code in each phase, give a short plan (files, commands), then implement.
3. Prefer simple, boring, free-tier-friendly solutions. If a choice could hit a Vercel limit, pick the lighter one and say why.
4. Verify anything that changes over time (limits, model names, prices, WhatsApp rules, library versions) against current official docs. See `docs/limits.md`.
5. Never commit secrets. Use `.env.local` and Vercel env vars. Keep `.env.example` updated.
6. After each phase update `docs/PROGRESS.md`.
7. Keep user data minimal. No medical, legal or financial advice features.
8. Write tests for scoring logic, API routes and webhooks. Keep CI green.
9. Ask the user a question only when truly blocked.

Golden rule: heavy work offline in Python (`benchmark/`); Vercel (`web/`, TypeScript) serves only light requests.

Commands
- web: `cd web && npm run lint && npm run typecheck && npm test && npm run build`
- benchmark: `cd benchmark && .venv/Scripts/python -m pytest && .venv/Scripts/python -m ruff check .`