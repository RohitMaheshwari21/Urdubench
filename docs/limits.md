# Platform limits (verified 2026-10-09)

Every figure below was read from the linked official page on the date above. Re-check before relying on it.

## Vercel Functions (Hobby plan, Fluid compute) 
Source: https://vercel.com/docs/functions/limitations (last updated 2026-08-24)

| Limit | Hobby | Pro |
|---|---|---|
| Max duration | 300s default and max | 300s default, 800s max (1800s beta) |
| Memory / CPU | 2 GB / 1 vCPU | 2 GB default, 4 GB / 2 vCPU max |
| Bundle size (uncompressed) | 250 MB (Python 500 MB; "large functions" beta up to 5 GB) | same |
| Request / response body | 4.5 MB | 4.5 MB |
| File descriptors | 1,024 shared across concurrent executions | same |
| Concurrency | auto-scales to 30,000 | same |

- Billing is on active CPU time; waiting on I/O (LLM calls, DB) is not counted as active CPU.
- Default region is `iad1`; multi-region is Pro+ only.
- Plan note from PLAN.md: Hobby is for non-commercial use. Re-read Vercel's terms before any monetization.
- The PLAN.md assumption that Python functions are risky still holds for LangChain-sized bundles. The live app stays TypeScript.

## `after()` (Next.js)
Source: https://nextjs.org/docs/app/api-reference/functions/after (Next.js 16.4.0 docs)

- Stable since Next.js 15.1. Works in Route Handlers, Server Components, Server Functions.
- On Vercel it is implemented with `waitUntil`, which keeps the invocation alive until the work settles.
- `after` runs for the route's max duration, so set `maxDuration` on `/api/whatsapp`.
- In Route Handlers, `headers()`/`cookies()` may be read inside the callback. Read the request body BEFORE returning.
- `/api/whatsapp` plan: verify signature, return 200, do LLM + send in `after()`.

## Neon Postgres (Free)
Source: https://neon.com/docs/introduction/plans

- 1 GB storage per project (20 GB total across projects), 100 projects.
- 100 CU-hours per project per month (about 400 h at 0.25 CU). Autoscaling up to 2 CU.
- Computes always autosuspend after 5 minutes idle, so expect a cold-start delay on the first query. Use the pooled connection string and `@neondatabase/serverless`.
- **Not confirmed from this page:** `pgvector` availability on Free. Confirm with `CREATE EXTENSION vector;` in Phase 0 follow-up / Phase 6 (https://neon.com/docs/extensions/pgvector).

## Upstash Redis (Free)
Source: https://upstash.com/docs/redis/overall/pricing

- 500K commands per month, 250 MB data, 10 GB bandwidth per month.
- 10,000 max commands/second, 10 MB max request size, 100 MB max record size.
- The page is inconsistent on database count (1 vs up to 10). Not important for us.
- Budget: rate limiting costs several commands per request. 500K/month is enough for a pilot but the spend cap should also count commands.

## WhatsApp Cloud API
Sources: https://developers.facebook.com/docs/whatsapp/pricing, https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

- Since 2025-07-01 billing is per delivered template message (conversation-based pricing is deprecated).
- A 24-hour customer service window opens when a user messages us. Inside it, free-form replies are free and utility templates are free. Outside it, only templates can be sent, and they are billed.
- Marketing templates are always billed. Rates vary by category and recipient country calling code.
- Messages from users to us are free. Free entry point window (72h) applies only to click-to-WhatsApp ad or Page button entry.
- Consequence for the bot: a reply-only design (user texts first) costs nothing. Daily push reminders need approved templates and cost money.
- **Not confirmed from these pages:** test number recipient limit, temporary token lifetime, and business verification steps for going live. The page says the temporary token expires quickly, so use a system user token. To be checked in Phase 8 from the Meta dashboard.

## Model and embedding prices
Not chosen yet. Model, embedding provider and prices are decided in Phase 4 (benchmark models) and Phase 6/7 (live model and embedding). They must be verified from the provider pricing page at that time.

## Local toolchain used for Phase 0
Node 24.12, npm 11.6, Python 3.14.2 locally (package supports >=3.11, CI uses 3.11), Next.js 16.4.0, React 19.3.0, Vitest 5.0.3.