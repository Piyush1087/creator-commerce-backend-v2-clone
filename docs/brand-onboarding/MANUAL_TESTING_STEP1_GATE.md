# Manual testing — Step 1 gate through login

Scope: **surface scan funnel** landing → scan → DNA → catalogue → competitors → verify → pricing → register → social skip → dashboard/login. **Deep scan is not in scope.**

Prerequisites:

- Backend `STAGE=local` (limits off) or `STAGE=dev` (limits on).
- Postgres running; migrations applied.
- Frontend `VITE_API_URL` points at backend.
- Optional: `PARALLEL_API_KEY` + `GEMINI_API_KEY` for real scans; without them, cached/unconfigured paths still test gates.

## A. Environment / limits


| #   | Setup                                         | Action                                                                                 | Expected                                                  |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A1  | `STAGE=local`                                 | Run 6+ surface scans (force refresh) same domain                                       | All allowed (no `verification_required`)                  |
| A2  | `STAGE=dev`, `BRAND_SCAN_LIMITS_ENABLED=true` | 6 vendor scans same domain in 7d                                                       | 6th blocked: `verification_required` modal → verify route |
| A3  | A2                                            | Repeat from new browser profile, same IP, different domains until 6 vendor scans total | IP limit: same modal/message                              |


## B. Landing `resolve` outcomes


| #   | Setup                                                                           | Action                 | Expected                                                          |
| --- | ------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| B1  | New domain                                                                      | Submit URL on `/`      | `proceed` → preview modal → setup → scan                          |
| B2  | Invalid URL `not a url`                                                         | Submit                 | Inline blocked error                                              |
| B3  | Social URL `instagram.com/foo`                                                  | Submit                 | Blocked (social)                                                  |
| B4  | Profile exists: unverified, surface complete, **< 7d** `createdAt`, lead exists | Submit same URL        | **Resume** modal → Continue → **DNA** (skips scan animation path) |
| B5  | Same as B4 but profile **> 7d** old                                             | Submit                 | Treat as new `proceed` (no resume)                                |
| B6  | Profile `isVerified=true`, no user/org                                          | Submit domain          | **Brand active** modal → Sign in → `/login`                       |
| B7  | Verified + org + user                                                           | Submit domain          | **Org claimed** modal (admin email)                               |
| B8  | B6 domain, complete OTP but not register                                        | Submit again anonymous | Still **brand active** (not re-scan)                              |
| B9  | B7 domain                                                                       | Submit                 | Org claimed only                                                  |


## C. Surface scan API


| #   | Setup                                | Action                          | Expected                                               |
| --- | ------------------------------------ | ------------------------------- | ------------------------------------------------------ |
| C1  | Limits on, domain at cap             | POST surface-scan with `leadId` | 403 `verification_required`                            |
| C2  | B1 happy path                        | Scan completes                  | `mode: http` or `cached`; session has `brandProfileId` |
| C3  | After C2, reload scan with same lead | Second call                     | `mode: cached` (no new vendor attempt)                 |


## D. Verification → register → login


| #   | Action                                     | Expected                           |
| --- | ------------------------------------------ | ---------------------------------- |
| D1  | Complete OTP (stub `123456` if toggle off) | Success → pricing                  |
| D2  | Start free trial on pricing                | JWT in `localStorage`; social sync |
| D3  | Skip social sync                           | `/brand/dashboard`                 |
| D4  | Logout on dashboard                        | `/`                                |
| D5  | `/login` with work email + `123456`        | Dashboard                          |


## E. Authenticated owner (optional)


| #   | Setup                                            | Action                    | Expected                                      |
| --- | ------------------------------------------------ | ------------------------- | --------------------------------------------- |
| E1  | JWT in browser, same user as `verificationEmail` | `resolve` verified domain | Not `brand_active`; may `resume` or `proceed` |
| E2  | E1                                               | `surface-scan`            | Allowed (not 403 brand_active)                |


## F. Purge (optional)


| #   | Action                                                              | Expected                                         |
| --- | ------------------------------------------------------------------- | ------------------------------------------------ |
| F1  | Create unverified profile > 7d old (SQL or wait), run purge service | Row deleted with offerings/competitors/locations |
| F2  | Profile < 7d unverified                                             | Not deleted                                      |


## SQL helpers (dev only)

```sql
-- Age a profile for resume/purge tests
UPDATE brand_profiles
SET created_at = NOW() - INTERVAL '8 days'
WHERE domain = 'your-test-domain.com';

-- Inspect scan counts
SELECT domain, client_ip, kind, created_at
FROM surface_scan_attempts
ORDER BY created_at DESC
LIMIT 20;
```

## API smoke (curl)

```bash
# Resolve
curl -s -X POST http://localhost:3000/api/v1/discovery/resolve \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example-brand.com"}' | jq .

# With JWT (owner bypass brand_active)
curl -s -X POST http://localhost:3000/api/v1/discovery/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url":"https://example-brand.com"}' | jq .
```

## Known out of scope

- Deep intel / background worker
- Plan assignment on org
- Full dashboard product UI

