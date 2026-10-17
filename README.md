# GiggerIQ

A mobile-first GenAI companion for Indian gig and informal workers: delivery partners, drivers and daily-wage workers. Built for PromptWars Chandigarh, "Gig Worker Companion".

## What it does

| Feature | How it works |
|---|---|
| **My Earnings** | Manual entry of date, platform, amount and hours. Shows total earned, total hours and per-hour rate, with edit and delete. **AI summary** explains the week and gives practical tips. |
| **Complaint letter** | The worker describes a problem (unpaid payout, unfair deactivation, COD dispute). AI drafts a formal, editable letter with a copy button, labelled as informational, not legal advice. |
| **Safety tips** | The worker describes their work situation. AI gives practical safety advice, including emergency number 112. |
| **Welfare schemes** | Grounded answers about real government schemes (e-Shram, PM-SYM, Ayushman Bharat PM-JAY, PMSBY, PMJJBY, APY, PM SVANidhi) with official links. |
| **Explain a document** | The worker photographs a notice, letter or form. AI explains what it says, key dates, amounts and what to do next. |

All features work in **English, Hindi and Punjabi**: interface, AI replies and scheme search. The AI also honours an explicit request in the message, such as "explain in Hindi".

## Generative AI used, and where

- **Google Gemini (Flash) via the official `@google/genai` SDK**, called only on the server through one shared helper, `lib/gemini.ts`.
- Used by all five features. Gemini's vision capability reads uploaded document photos.
- Prompts for every feature live in `lib/prompts.ts`; the request lifecycle lives in `lib/askService.ts`.

## Architecture

```
app/page.tsx              Shell: language switcher and tabs
components/               AskTab, EarningsTab, Answer (one job each)
lib/useEarnings.ts        Earnings state hook (validated localStorage)
lib/client.ts             Browser helpers: API call, in-browser image shrinking
app/api/ask/route.ts      HTTP layer: origin check, per-IP limit, input validation
lib/askService.ts         Request lifecycle: image check, scheme retrieval, cache, AI budget, Gemini, citation check
lib/store.ts              Redis store (memory fallback for local dev and tests)
lib/rateLimit.ts          Per-IP and daily AI limits, fail closed
lib/cache.ts              Answer cache for general questions
lib/schemes.ts            Scheme retrieval and citation verification
lib/prompts.ts, gemini.ts Prompt building and the single Gemini client
```

## How scheme answers avoid hallucination

1. The server picks the top 3 relevant records from `data/schemes.json` by keyword match in English, Hindi or Punjabi. English keywords match whole words only.
2. Only those records are sent to Gemini, with instructions to answer only from them.
3. Gemini must end with a `SOURCES:` line listing the scheme IDs it used.
4. The server checks every cited ID was in the records it sent. If not, or if nothing matched, the worker gets an honest "I don't know" in their language, with a link to the official e-Shram portal. If nothing matched, no AI call is made at all.

## Efficiency

- **Shared state in Redis.** Rate limits and the cache live in Redis, so they survive restarts and work across multiple server instances. Without `REDIS_URL` (local development), a bounded in-memory store is used.
- **Answer cache.** Safety and scheme answers are cached for 6 hours, keyed by a SHA-256 hash of mode, language and normalised question. Repeat questions return instantly and use no AI quota. Complaint, document and earnings requests contain personal details and are **never cached**.
- **In-browser image shrinking.** Photos are resized to at most 1600px and re-encoded as JPEG before upload. A typical 4 MB camera photo becomes about 300 KB, which is faster on mobile data and lighter on server memory.
- **No wasted AI calls.** Scheme questions with no matching record are answered without calling Gemini, and the daily AI budget is counted only for real Gemini calls, not cache hits.
- **Bounded work.** 25-second timeout per AI call, capped output length, last 60 entries sent for earnings summaries, and model fallback if a model ID is unavailable.
- **One server-side API key, by design.** The key never reaches the browser. Per-IP limits plus a daily cap protect the shared quota, and `GEMINI_MODEL` and `DAILY_AI_CAP` let operators adjust without code changes.

## Why earnings are entered manually

Gig platforms (Swiggy, Zomato, Uber, Rapido and others) offer no public API for workers' earnings, and scraping their apps would break their terms. Earnings are stored **only on the worker's phone** and are sent to the server only when the worker asks for an AI summary.

## Security

- Gemini API key is server-side only, read from environment variables; `.env` is git-ignored.
- Same-origin check on the API; all input validated with `zod` (text max 1000 chars, fixed modes and languages).
- Rate limiting: 10 requests per minute per IP, plus a hard daily cap on Gemini calls. Both **fail closed**: if Redis is unreachable, requests are refused rather than allowing unlimited paid calls. The client IP is taken from the proxy-appended end of `X-Forwarded-For`, so clients can't spoof it.
- Uploads: JPG, PNG or WebP only, max 4 MB, and the **actual file bytes** are checked, not just the declared type. Images are processed in memory and never stored or logged.
- AI output is treated as untrusted and always rendered as plain text, never HTML. User and document text is passed to the model as data, never as instructions.
- No user text, images or IP addresses are logged. Cache keys are hashes, so question text is never stored in readable form.
- Security headers: `nosniff`, `X-Frame-Options: DENY`, strict referrer policy.
- Stored earnings are re-validated when read, so tampered localStorage data is dropped.

**Free-tier note:** this deployment uses the Gemini API free tier, whose terms allow Google to use prompts to improve its products. The app warns users not to enter Aadhaar, bank or card numbers.

## Run locally

```bash
npm install
cp .env.example .env   # add your GEMINI_API_KEY (REDIS_URL optional)
npm run dev            # http://localhost:3000
npm test               # 25 tests
```

## Deploy (Railway)

Connect the GitHub repo, add a Redis service, and set `GEMINI_API_KEY` and `REDIS_URL` (reference the Redis service variable). Railway runs `npm run build` and `npm start` automatically.

## Tests

25 Vitest tests:

- `tests/api.test.ts`: **integration tests for `POST /api/ask`** with Gemini simulated. Covers the happy path, cross-site and missing-origin rejection, malformed input, fake image bytes, verified scheme answers, rejection of invented citations, no AI call when nothing matches, cache hits, never caching personal text, per-IP rate limiting, fail-closed behaviour when the store is down, and the friendly error when Gemini fails.
- `tests/core.test.ts`: earnings maths, tampered storage, validation, image signatures, citation verification.
- `tests/store.test.ts`: store expiry, and Hindi, Punjabi and whole-word scheme matching.
