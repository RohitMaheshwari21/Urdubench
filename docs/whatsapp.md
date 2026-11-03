# WhatsApp bot: setup and launch

The bot is a reply-only WhatsApp Cloud API webhook at `https://urdubench.vercel.app/api/whatsapp` (`web/app/api/whatsapp/route.ts`, logic in `web/lib/whatsapp.ts`). Users write first; the bot never starts a conversation, so it needs no message templates and, under the pricing in `docs/limits.md`, sends only free replies inside the 24-hour customer service window.

Checked against Meta's docs on 2026-11-03: Graph API v26.0 is current (released 2026-07-29; set `WHATSAPP_API_VERSION` to change it); webhook verification echoes `hub.challenge` when `hub.verify_token` matches; payloads are signed in `X-Hub-Signature-256: sha256=<HMAC-SHA256 of the raw body with the app secret>`; a non-200 response is retried for up to 7 days and retries can produce duplicates.

## Commands

| Message | Reply |
|---|---|
| anything else | help text |
| `quiz` | a random question from the public Urdu culture set (T3 dev), options A to D |
| `A` / `B` / `C` / `D` | right or wrong, the correct answer, running score |
| `score` | score and current streak |
| `ask <question>` | a short answer from Urdu Wikipedia with source links, or "I don't know"; refuses medical, legal and financial advice (same pipeline as `/api/ask`) |
| `language ur` / `roman` / `en` | language of the bot's own messages (quiz questions are in Urdu) |
| `stop` | deletes the user's row and confirms |

## What happens to a message

1. The signature is checked against `WHATSAPP_APP_SECRET`; a bad or missing signature gets 401.
2. The route answers 200 at once and does the work in `after()` (Vercel keeps the function alive until it finishes, within `maxDuration = 60`).
3. Each message id is recorded in Redis for 2 days; a repeated delivery is skipped.
4. The phone number is hashed with `RATE_LIMIT_SALT`. Only the hash, language, open quiz question and score are stored (`wa_users`). Message text is never stored or logged. A user who only reads the help text gets no row at all.
5. Limits: 60 messages per user per day; `ask` also counts against the per-user arena-style limits and the global `DAILY_SPEND_CAP`.

## Setup with the test number (owner, about 20 minutes)

1. At developers.facebook.com create an app of type **Business**, add the **WhatsApp** product. Meta gives a test phone number and a temporary access token.
2. In WhatsApp > API Setup, add your own number (and pilot users') as test recipients.
3. In Vercel, add `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (from API Setup), `WHATSAPP_APP_SECRET` (App settings > Basic), and `WHATSAPP_VERIFY_TOKEN` (any random string you choose). Phase 6 and 7 variables (`DATABASE_URL`, Upstash, `LLM_API_KEY`, `EMBEDDING_API_KEY`, `DAILY_SPEND_CAP`, `RATE_LIMIT_SALT`) must be set too. Run `npm run db:migrate` once. Redeploy.
4. In WhatsApp > Configuration, set the callback URL to `https://urdubench.vercel.app/api/whatsapp` and the verify token to the same string; Meta calls GET and the route echoes the challenge. Subscribe to the **messages** field.
5. Send "help" from a test recipient's phone. Then try `quiz`, an answer letter, `score`, `ask K2 kahan hai?`, `stop`.
6. The temporary token expires quickly (see `docs/limits.md`). For anything beyond a quick test, create a **System User** in Meta Business Settings, give it the app and the WhatsApp account, and generate a permanent token; replace `WHATSAPP_TOKEN`.

Vercel Deployment Protection must be off for production, otherwise Meta's requests get 401/403 from Vercel before reaching the route.

## Path to a public launch

These steps happen in Meta's dashboards and take days, so start them early. Check each against Meta's current docs at the time; they were not all confirmed from the pages read on 2026-11-03.

1. **Business verification** of the Meta Business account (business documents). Without it the number stays limited to test recipients and low volume.
2. **A real phone number** registered to the WhatsApp Business Account (not in use on the normal WhatsApp app), and a **display name** that Meta approves.
3. **Privacy policy URL** in the app settings: `https://urdubench.vercel.app/privacy`.
4. Switch the app to **Live** mode.
5. **No daily push messages** unless users opt in, and only with an approved template (billed; see `docs/limits.md`). The current bot never sends first, so nothing changes until a reminder feature is added.
6. Re-check limits for the number's messaging tier and adjust `DAILY_SPEND_CAP` and the per-user limit for the pilot size.
