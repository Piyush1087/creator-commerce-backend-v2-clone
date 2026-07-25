# Brand Onboarding — Manual Test Matrix

**Last updated:** 2026-07-16  
Run against local API + frontend-v2. Record HTTP outcome, discovery `outcome`, and UI state.

Env notes:

- Scan limits: `BRAND_SCAN_LIMITS_ENABLED=true` (+ force refresh if testing limits vs cache).
- OTP: see [VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md).

| # | Scenario | Example / setup | Expect |
| --- | --- | --- | --- |
| 1 | Happy path (State A) | `mamaearth.in`, `boat-lifestyle.com`, SaaS/healthcare samples | `success` → lead → Stage 1A scan → Checkpoint 1 |
| 2 | Rate limit (State D) | Same domain/IP >5 scans in 7d window with limits on | `verification_required` (`DOMAIN_LIMIT` / `IP_LIMIT`) |
| 3 | Resume / cache (State E) | Re-enter domain scanned &lt;7d, unverified | `resume`; no new live scan |
| 4 | Infra / connection (State F) | Dead DNS, 4xx/5xx homepage, apex-hijack redirect | `infrastructure_error`; landing retry CTA (`Retry Connection Check`) |
| 5 | Hard blocklist (State G) | `.gov` / `.gov.in` / `.nic.in` / `.mil` / `.edu` / **`.ac.in`**, marketplaces, social, suspicious TLDs, localhost | FE + BE `blocked` |
| 6 | Unsupported industry waitlist (State B) | Real estate, media, education brands | `waitlist` + industry; **no mail**; reason when applicable |
| 7 | Parked / unreadable (Gate 8) | Parked or empty content site | Waitlist UI; POST waitlist with **reason + domain** |
| 8 | Foreign language (Gate 9) | Non-supported-language primary site | Same as Gate 8 |
| 9 | Blocked industries | Gambling / Adult / Fraud signals | **`blocked`**, not waitlist |
| 10 | Claimed brand (State H) | Verified org-owned domain | `org_claimed` / `brand_active`; **`adminEmail` masked**; no owner PII dump |
| 11 | Syntax (State C) | `hello world`, empty, `http://` | FE reject before API |
| 12 | Truncate / slice | Deep URL with UTM + `#fragment` | Normalize to apex (e.g. `https://mamaearth.in`) |
| 13 | Direct API enforcement | Call resolve/validate with blocked URLs | BE still blocks (FE not security boundary) |
| 14 | Partial Stage 1A drivers | One of Zyte/Playwright fails | Scan continues on surviving driver (not State F) |
| 15 | Checkpoint 1 confirm | Edit allowed fields; leave country/currency/website | Confirm → navigate **intelligence-scan**; job enqueued |
| 16 | Intelligence wait → DNA | Poll after confirm | Status progresses; on archive → DNA; narrative in Additional data |
| 17 | Soft-fill / archive | Brand that omits some citations | DNA still archives (soft-fill); not stuck on validation |
| 18 | Checkpoint 2 API | `GET .../checkpoint-2/:leadId` after DNA | `brandDna` present; `offerings`/`competitors` `[]`; confirm POST ok |
| 19 | Verification OTP | Stub vs real per env | Matches [VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md) |

## API smoke (optional)

```http
POST /api/v1/discovery/resolve
POST /api/v1/discovery/validate
POST /api/v1/discovery/waitlist
POST /api/v1/brand/surface-scan
GET  /api/v1/brand/surface-scan/progress/:leadId
GET  /api/v1/brand/surface-scan/core-identity/:leadId
POST /api/v1/brand/surface-scan/confirm-identity/:leadId
GET  /api/v1/brand/surface-scan/intelligence/:leadId
GET  /api/v1/brand/surface-scan/checkpoint-2/:leadId
POST /api/v1/brand/surface-scan/checkpoint-2/:leadId/confirm
```

## Pass criteria

- Outcomes match the Expect column for supported envs.
- No unmasked owner email on anonymous claimed responses.
- Confirm never lands on DNA before intelligence status is archived (or explicit failure path).
