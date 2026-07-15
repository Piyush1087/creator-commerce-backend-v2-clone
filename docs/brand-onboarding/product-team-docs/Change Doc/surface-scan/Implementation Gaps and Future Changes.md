# Surface Scan — Test Scenarios, Gaps, and Future Changes

**Last reviewed:** 2026-07-15  
**Current scope:** Landing URL gate, Stage 0 Gatekeeper, and Stage 1A core
identity acquisition (Phase 3)

Use this document as the manual-test checklist and quick reference for deferred
surface-scan work.

## Manual test scenarios

### 1. Happy path — Use Case 1 / State A

Submit a clean, supported brand website.

**Expected:**

- Discovery outcome is `success`.
- A discovery lead is created.
- The lead contains the Gatekeeper industry and sub-industry.
- The user can continue into Stage 1A scanning.

**Examples:**

- `https://mamaearth.in`
- `https://boat-lifestyle.com`
- `https://notion.so` — SaaS
- `https://apollo247.com` — healthcare

**Watch:** Stage 0 currently classifies from the URL/hostname only. Ambiguous
hostnames may return `UNKNOWN`, a low-confidence result, or an incorrect
industry.

### 2. Rate-limit intercept — Use Case 2 / State D

Run more than five vendor scans for the same domain or source IP in the rolling
seven-day window.

**Setup:**

- Enable scan limits in local development with
  `BRAND_SCAN_LIMITS_ENABLED=true`.
- Set `BRAND_SCAN_FORCE_REFRESH=true` so a cached result does not bypass the
  vendor scan.
- Use a domain with an existing unverified `BrandProfile`.

**Expected on the sixth scan:**

- Outcome is `verification_required`.
- Reason is `DOMAIN_LIMIT` or `IP_LIMIT`.
- UI requests work-email verification.

**Example:** Any working supported brand URL, scanned six times.

### 3. Cached recovery / resume — Use Case 3 / State E

Re-enter an unverified domain whose surface scan completed within the last
seven days.

**Expected:**

- Entry resolution returns `resume`.
- No new live scan starts.
- Existing data opens directly.

**Example:** Re-enter the successful URL from Scenario 1 after its scan
completes.

### 4. Live connection failure — Use Case 4 / State F

Use a domain with dead DNS, a connection timeout, a target 4xx/5xx response, or
a redirect to an unrelated apex domain.

**Current expected behavior:**

- Syntax validation itself can pass because it performs no outbound request.
- If the user reaches Stage 1A and every acquisition driver reports a
  connection-level failure, the scan returns a typed
  `infrastructure_error`.
- The scan page returns to the landing page.
- The failing URL remains in the input.
- The alert displays the appropriate connection/refusal/redirect message.
- The CTA displays `Retry Connection Check` and is clickable.

**Examples:**

- Dead DNS: `https://thisdomaindoesnotexist-xyz123.com`
- Target 404: use a controlled test host whose homepage returns 404.
- Target 500: use a controlled test host whose homepage returns 500.
- Redirect hijack: use a controlled domain that redirects to an unrelated
  registrable domain.

**Known limitation:** Gemini runs before Stage 1A. A dead or ambiguous hostname
can be classified as `UNKNOWN`/waitlist before Stage 1A is reached, preventing
the dedicated retry state from being exercised.

### 5. Hard blocklist — Use Case 5 / State G

Restricted domains should be rejected deterministically before Gemini. The
frontend provides immediate feedback; the backend remains authoritative if the
API is called directly.

**Expected:** Frontend validation error and backend `blocked` outcome.

**Restricted namespace examples:**

- `https://usa.gov`
- `https://india.gov.in`
- `https://services.gst.gov.in`
- `https://www.nic.in`
- `https://indianarmy.nic.in`
- `https://example.mil.in`
- `https://mit.edu`
- `https://example.mil`

`gov.in`, `nic.in`, and `mil.in` (each including all subdomains) are explicitly
blocked. Do not block the entire `.in` country-code TLD because legitimate
Indian brands use it.

**Social/platform examples:**

- `https://instagram.com/somebrand`
- `https://facebook.com`
- `https://youtube.com`

**Marketplace examples:**

- `https://amazon.in`
- `https://flipkart.com`
- `https://nykaa.com`

**Suspicious-TLD examples:**

- `https://example.ru`
- `https://something.zip`
- `https://brand.info`

**Backend-only private-host examples:**

- `http://localhost:3000`
- `http://192.168.1.1`

**Policy still to decide:** Whether Indian education namespaces such as
`ac.in` and `edu.in` must also be structural hard blocks or should route to the
unsupported-industry waitlist instead.

### 6. Industry regret / waitlist — Use Case 6 / State B

Submit a live, legitimate company outside the supported D2C, SaaS/AI,
healthcare, and offline-services groups.

**Expected:**

- Discovery outcome is `waitlist`.
- Response includes the detected industry and lead identifiers.
- UI renders the industry-specific notification state.
- For this test cycle, only verify detection and response shape; notification
  delivery remains deferred.

**Examples:**

- `https://99acres.com` — real estate
- `https://sothebysrealty.com` — real estate
- `https://hindustantimes.com` — media
- `https://byjus.com` — education

### 7. Claimed brand shield — Use Case 7 / State H

Submit a domain already verified and owned by a workspace.

**Setup:** Complete verification for a test domain, or prepare a verified
`BrandProfile` attached to an organization in the local database.

**Expected:**

- Outcome is `org_claimed` when an organization owns it, or `brand_active` for
  an existing verified profile.
- Response does not expose the owner's email, logo, profile, or scan data.
- The organization-access request UI may render, but invite delivery is
  deferred.

**Security check:** The API contract currently contains an `adminEmail` field
for `org_claimed`. Verify that it does not expose a real owner address to an
anonymous caller; this should be removed or replaced with a non-sensitive
domain hint.

### 8. Syntax errors — Use Case 8 / State C

Submit malformed text.

**Expected:**

- Frontend rejects it before calling the API.
- Message is `Please enter a valid website address (e.g., brand.com).`
- Error/shake styling is shown.

**Examples:**

- Empty submit
- `hello world`
- `not-a-url`
- `http://`
- `brand`

### 9. Truncate and slice gate

Submit a deep URL containing tracking parameters and a fragment.

**Example:**

`https://www.mamaearth.in/product/some-cream?fbclid=IwAR123456789&utm_source=facebook&utm_medium=cpc#reviews`

**Expected:**

- Discovery input normalizes to `https://mamaearth.in`.
- Path, query parameters, `fbclid`, UTM values, fragment, and `www.` are
  removed.
- The result follows the same path as Scenario 1.

### 10. Direct backend enforcement

Repeat representative blocked and malformed cases by calling
`POST /api/v1/discovery/resolve` and `POST /api/v1/discovery/validate`
directly, bypassing frontend validation.

**Expected:** The backend still blocks the request. Client validation is not a
security boundary.

### 11. Partial acquisition tolerance

Configure both Zyte and Playwright, then make only one acquisition driver fail.

**Expected:**

- Stage 1A continues with the successful driver's evidence.
- The dedicated infrastructure-error state is reserved for a terminal
  acquisition failure, not a single-driver degradation.

### 12. Missing acquisition configuration

Disable Playwright and omit the Zyte API key.

**Expected:** Confirm the configured product policy. The current module may use
the unconfigured runner, while the orchestrator itself still contains a
domain-derived fallback. This behavior should be made consistent before
production.

## Known gaps and intentionally deferred work

### Landing and Gatekeeper

- Waitlist notification/email delivery is deferred.
- Workspace invite/access-request delivery is deferred.
- Stage 0 Gemini receives only URL and hostname evidence. Low-confidence
  supported classifications are not yet rejected by an explicit threshold.
- Stage 0 and Stage 1A classifications are not reconciled when later evidence
  conflicts.
- Reachability is checked during Stage 1A rather than before Gemini.
- Restricted namespace policy is duplicated in frontend and backend arrays.
  The backend is authoritative, but a shared policy package or generated client
  rule set would reduce drift.
- Registrable-domain/redirect comparison uses heuristic suffix handling rather
  than the maintained Public Suffix List.
- Add a product decision for `ac.in` and `edu.in` (education namespaces).
  `gov.in`, `nic.in`, and `mil.in` are already hard-blocked with subdomains.

### Stage 1A / Phase 3

- Universal-wrapper data is temporarily stored in
  `DiscoveryLead.temporaryPayload`; not every wrapped field has a first-class
  Prisma column.
- Flat core identity values are written to `BrandProfile`.
- There is no durable job queue, retry budget, dead-letter handling, or
  cross-process progress store.
- Controlled automated contract tests are still needed for all State F
  variants and partial-driver behavior.

### Stage 1A production acquisition plan (agreed 2026-07-15)

Current state (feasibility mode): Zyte and Playwright run fully concurrent
with **no orchestrator timeouts** so real per-driver latency can be measured
via `stage1a.zyte_ok/fail` and `stage1a.playwright_ok/fail` log timings.
Measured baseline on mamaearth.in: Zyte ~8s, Playwright (cold launch) ~11-14s,
concurrent total ~11.4s versus ~22.4s sequential.

Before production traffic, apply all of the following:

1. **Warm browser reuse.** Launch one shared Chromium instance and open a new
   browser context per scan (contexts are cheap and isolated) instead of a
   `chromium.launch()` per scan (~150-300MB RAM and CPU spike each). Cold
   per-scan launches are the main scale risk and the reason the Phase 3
   5000ms budget is currently unrealistic.
2. **Concurrency cap.** Add a semaphore (3-5 concurrent Playwright contexts);
   queue the rest. Without it, a signup burst can exhaust host memory since
   scans run in-process via `setImmediate`.
3. **Hedged Playwright start.** Start Zyte immediately; start Playwright only
   after a short head start (~1-2s) and only if Zyte has not already returned
   a complete identity payload. Skips browser work entirely on well-structured
   sites while keeping the concurrent worst case.
4. **Restore generous timeouts.** Re-add per-driver budgets informed by the
   measured timings (roughly 15s Zyte / 25s Playwright), plus an
   `AbortController` on the Zyte fetch, which currently has no abort timeout
   and can hang a scan indefinitely on a stalled vendor connection.
5. **Cost posture.** Zyte homepage `httpResponseBody` requests are fractions
   of a cent and not a cost concern; the real cost/scale factor is Playwright
   compute. Prefer reducing Playwright invocations (hedging, Zyte-side icon
   extraction) over reducing Zyte calls.

### Later phases

- Production Stage 1B crawl-planning worker and durable job lifecycle.
- Deep-page acquisition and evidence extraction.
- Offerings, locations, audience, competitor, visual identity, and policy
  intelligence from later phase documents.
- Meta and Similarweb integrations.
- Final evidence/confidence reconciliation across sources.
- Full universal-wrapper persistence and migration review.
- Operational metrics, tracing, alerting, and vendor cost controls.
- Existing Parallel code remains disabled/commented rather than removed.

## Recommended next implementation order

1. Run the manual scenarios above and record actual outcome, response code, and
   UI state for each.
2. Remove anonymous `adminEmail` exposure from the claimed-brand response if
   confirmed by API testing.
3. Add focused tests for `.gov.in`/`.nic.in`/`.mil.in`, State F variants,
   direct API enforcement, and one-driver degradation.
4. Decide policy for `ac.in` and `edu.in`.
5. Add an SSRF-safe reachability check before URL-only Gemini classification.
6. Enforce a minimum confidence threshold with an `UNKNOWN` fallback.
7. Replace heuristic registrable-domain logic with a Public Suffix List
   implementation.
8. Continue with the next approved surface-scan phase.
