# HANDOFF

## Done (main challenge)
- Frontend split into components (AskTab, EarningsTab, Answer) + useEarnings hook + client helpers
- Request lifecycle extracted to lib/askService.ts; route is a thin HTTP layer
- Redis-backed store for rate limits and cache, memory fallback; fail-closed limits
- Answer cache for safety/schemes (hashed keys, 6h TTL); personal modes never cached
- In-browser image shrinking before upload
- Punjabi added; Hindi/Punjabi scheme keywords; whole-word English matching
- 25 tests (13 API integration tests)

## Done (submission 2)
- Earnings screenshot import (Gemini JSON extraction, worker confirms)
- Draft-my-reply from explained documents, WhatsApp share, read aloud, voice input
- 31 tests

## Next
- Deploy with Redis on Railway, test all features live
