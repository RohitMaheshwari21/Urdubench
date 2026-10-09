# Progress

## Phase 1: Gap analysis and task design (in review)

Done
- `docs/gap-analysis.md`: survey of existing Urdu / Roman Urdu resources with licenses and a "what we add" statement. Key finding: UrduMMLU (26,431 native MCQs, CC BY 4.0) already covers Pakistan Studies, geography and Urdu literature, so T3 cannot be positioned on size. The gaps are Roman Urdu, paired Urdu/English parity, a protected test split, and non-exam everyday content.
- `data/schema/item.schema.json` plus `benchmark/urdubench/validate.py` (schema and cross-item checks: unique ids, T2 label membership, T4 pairs complete with the same answer). 13 tests.
- `docs/annotation-guidelines.md` (v0.1): principles, orthography, per-task rules, review process, rejection checklist.
- Sample items in `data/dev/`: T1 30, T2 30 (10 per label), T3 30 (9 categories), T4 30 pairs (60 items). All pass the validator. Answer positions are balanced (T3 8/8/7/7, T4 pairs 8/8/7/7).
- All sample items are drafted by Claude and marked `validated: false`.

Not done
- Small-model run on the samples (needs a provider, an API key in `.env.local`, and a cost approval).
- Native-speaker review of the sample items (T1 factual passages, T3 facts, T4 translations, T2 labels).

Open decisions for the project owner
- T3 positioning and whether to add a UrduMMLU subset as an external anchor (costs tokens).
- Which models and budget for the small test run.

Known issues
- 5 T1 items produce warnings (computed answers, not verbatim in the passage). Intended.
- Difficulty labels are the author's guess (about 65% easy). Recalibrate after the model run.

## Phase 0: Setup and verification (complete)

Done
- Monorepo layout created (`web/`, `benchmark/`, `data/`, `results/`, `scripts/`, `docs/`).
- `web/`: Next.js 16.4 + TypeScript + Tailwind 4 + Drizzle + Upstash + Neon driver + Vercel AI SDK + Vitest. Lint, typecheck, test and build pass locally. The home page is a static "hello" page with an Urdu RTL line.
- `benchmark/`: `urdubench` Python package, pytest and ruff pass in a venv.
- `.github/workflows/ci.yml`: web (lint, typecheck, test, build) and benchmark (ruff, pytest on Python 3.11) jobs. Not yet run on GitHub.
- `docs/limits.md` written with source links.
- Name check: `urdu-bench` and `urdubench` return 404 on GitHub and Hugging Face. `urdubench.com` resolves (likely taken). `.org`, `.dev` and `urdu-bench.com` did not resolve.

Verified
- Deployed on Vercel (root directory `web`): https://urdubench.vercel.app shows the hello page with the Urdu RTL line.
- CI green on GitHub (web and benchmark jobs). Two fixes were needed after the first run: `@emnapi/core` and `@emnapi/runtime` were added as dev dependencies because the Windows-made lockfile lacked them and Linux `npm ci` failed; the typecheck script now runs `next typegen` first because Next 16 generates `LayoutProps` into the gitignored `.next/types`.
- Repo: https://github.com/RohitMaheshwari21/Urdubench

Known issues
- `npm audit` reports 5 high findings, all in the dev-only ESLint chain (`braces` via `eslint-config-next`). `npm audit fix --force` would downgrade to eslint-config-next 14, so it was not applied. Revisit when a fixed release ships.
- `@types/node` was bumped to ^24 because Vitest 5 needs it.
- Neon `pgvector` on Free is unconfirmed (see limits.md).
- PLAN.md was pasted into chat and has not been saved to the repo.
- Vercel Deployment Protection returned 403 to anonymous requests during one check. Turn it off for production if the site should be public.

Next: Phase 1 (gap analysis and task design), after approval.