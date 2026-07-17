# Brand onboarding — implementation tracking (backend + contracts)

This document is the **living checklist** for backend work aligned with product intent (`docs/product-team-docs/brand-onboarding`) and engineering reference (`docs/brand-onboarding/*`). Update it when scope or decisions change.

**Constraints (current):**

- **Prisma schema changes** require review + `npm run db:migrate:dev` / `prisma generate` (see Auth section for latest).
- **No browser cookies** for onboarding continuity: **server-side state** is keyed by `DiscoveryLead` / `normalizedUrl`, future `BrandProfile`, and authenticated `User` after login.

---

## Current status (read first)

| Stream | State | Notes |
|--------|--------|--------|
| Step 1 HTTP | **Shipped (v2.1 gate)** | `resolve` / `validate` with `org_claimed`, `brand_active`, `verification_required`, `resume` (7d), scan limits (dev/prod); [STEP1_GATE_V2_1.md](./STEP1_GATE_V2_1.md), [MANUAL_TESTING_STEP1_GATE.md](./MANUAL_TESTING_STEP1_GATE.md). |
| Step 1 intelligence | **Stub behind DI** | `IndustryClassifier` token + `StubIndustryClassifier`; swap provider for Parallel/Gemini without changing orchestration. |
| Steps 2–5 (surface) | **MVP shipped** | `POST /api/v1/brand/surface-scan` persists `BrandProfile` + children via Parallel + Gemini when keys are set; **503** when keys are missing (except `mode: "cached"` short-circuit). Frontend v2 scan → DNA → catalogue → competitors wired to APIs + `sessionStorage` handoff. |
| Auth (brand MVP) | **Shipped (placeholder)** | `src/features/auth/` — email-only registration on pricing CTA; login via email + stub OTP `123456`; `GET /api/v1/auth/me`. **Plan assignment deferred**. |
| Step 1 purge | **Shipped** | Daily cron deletes unverified profiles (no org) older than 7d. |
| Deep intel (Step 7) | **Not started** | Post-verify worker deferred; surface-only funnel through login. |
| DB migrations | **Operator** | Run `npm run db:migrate:dev` when schema changes are approved; local DB must be reachable (`DATABASE_URL`). |

**Next up (suggested order):** (1) S3 mirror for extracted images + stable URLs, (2) brand plan assignment at org level (free trial / professional / enterprise), (3) replace **Step 1** `IndustryClassifier` stub with vendor-backed classification, (4) deep scan worker + richer PDP crawl post-verify, (5) contract tests / Prisma integration tests for scan + profile patch.

**Frontend auth (v2):** `/login` (brand email + OTP `123456`), `/brand/dashboard` (JWT gate + logout → `/`). Pricing CTA → complete-registration (no password UI); social-sync **Skip** → dashboard.

---

## Implemented API (Step 1)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/discovery/resolve` | Read-only entry: `resume` / `proceed` / `org_claimed` / `blocked` (no new `discovery_leads`; no gate-failure intel writes). |
| `POST` | `/api/v1/discovery/validate` | Full triage: creates/updates `discovery_leads` or `market_intelligence_logs` as today; includes `org_claimed`. |
| `POST` | `/api/v1/discovery/waitlist` | Persist `WaitlistLead` (email + `industry` + optional FKs to `DiscoveryLead` / `MarketIntelligenceLog`); HTTP **201** `{ id }`. |

Throttling: Nest `ThrottlerModule` (global + per-route limits on controllers). See `brand-onboarding.controller.ts` + `brand.controller.ts`.

---

## Implemented API (Steps 2–5 surface)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/brand/surface-scan` | Run Parallel extract + Gemini synthesis; upsert `BrandProfile` + replace `Offering` / `Competitor` / `Location` children. **201** `{ brandProfileId, domain, mode, counts }`. |
| `GET` | `/api/v1/brand/profiles/:brandProfileId` | Read persisted scan output for Steps 3–5 UI. |
| `PATCH` | `/api/v1/brand/profiles/:brandProfileId` | Partial Brand DNA edits (`isUserEdited` merge). |
| `POST` | `/api/v1/brand/profiles/:brandProfileId/verification/send` | Email OTP send (real when `BRAND_VERIFICATION_USE_REAL_OTP=true`; else stub — see [VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md)). |
| `POST` | `/api/v1/brand/profiles/:brandProfileId/verification/verify` | OTP verify; sets `isVerified` (stub accepts `123456` pre-prod). |

## Implemented API (Auth — brand MVP)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/auth/login` | Email + OTP (stub `123456`) + `role: BRAND` → JWT. |
| `POST` | `/api/v1/auth/brand/complete-registration` | After Step 6 verify: create `Organization`, `User` (verified email), link `BrandProfile.organizationId`. |
| `GET` | `/api/v1/auth/me` | Bearer JWT → current user summary. |

**JWT:** `24h` expiry in code; `JWT_SECRET_DEV` / `JWT_SECRET_PROD` in `.env`, mapped in `sst.config.ts` (see [BRAND_AUTH.md](./BRAND_AUTH.md)).

**Env (no secrets in repo):** `PARALLEL_API_KEY`, `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-2.0-flash`), optional `PARALLEL_EXTRACT_TIMEOUT_MS`, `GEMINI_REQUEST_TIMEOUT_MS`.

**S3 (surface scan assets):** Mirrors logo + product + competitor images to `creatorshop-v2-files-{stage}`; see [S3_ASSETS.md](./S3_ASSETS.md). Optional local: `S3_BUCKET_NAME` + `AWS_REGION`.

**Runner selection:** `HttpBrandSurfaceScanRunner` when **`PARALLEL_API_KEY` and `GEMINI_API_KEY`** are set. If either is missing, **new** scans return **503** from `POST /api/v1/brand/surface-scan`; existing `SURFACE_COMPLETE` profiles still return **`mode: "cached"`**.

**Future portability:** `BrandSurfaceScanRunner` token is the swap point for MCP tools or a worker queue without changing HTTP routes.

---

## Product source of truth

| Area | Location |
|------|-----------|
| Product copy, UX, step intent | `docs/product-team-docs/brand-onboarding/` (`step-1.md` … `step-8.md`, `steps-1-5.md`, `step-2.md` surface vs deep split) |
| Schema intent, journey summary | `docs/brand-onboarding/README.md`, `SCHEMA_DESIGN.md`, `SCHEMA_COMPARISON.md` |
| HTTP contract (Step 1) | `docs/api/brand-discovery.openapi.yaml` (`validate` + `resolve` under `/api/v1/discovery/*`) |
| Frontend v2 (deferred) | [FRONTEND_REQUIREMENTS.md](./FRONTEND_REQUIREMENTS.md) |

**Note:** Some `step-6.md` / `step-7.md` files in the product tree may duplicate or embed older pseudo-schema; treat **UI copy and rules** in `step-6.md` (OTP, domain-email match, rate limits) as authoritative for verification **when** we implement full Step 6. **Steps 6–8 UI** is intentionally loose in product docs; engineering phases below reflect that.

---

## Decisions (locked until changed here)

| Topic | Decision |
|-------|-----------|
| Session / resume | **No cookies.** Resume and idempotency use **DB keys** (`DiscoveryLead.normalizedUrl`, later `BrandProfile.domain`) and **auth** after user creation. |
| Domain already onboarded | **`org_claimed`**: verified + org + user (+ admin email for modal). **`brand_active`**: `isVerified` without owner JWT (login CTA). |
| Invitations / multi-brand | **Later.** No org invitation APIs yet; modal copy only. |
| Step 6–8 (now) | **OTP + login + user creation** only where schema/auth already allows; **no** full “sneak peek” carousel, deep intel pipeline, or billing until product + schema catch up. |
| AI vendors | **Parallel.ai** + **Gemini** for extraction/synthesis; **not** Zyte/Playwright in the default path. Guardrails: [AI_GUARDRAILS.md](./AI_GUARDRAILS.md) (expand as vendors wire in). |
| Async work | **Phase 1:** synchronous API + durable rows; **Phase 2:** queue/worker when jobs exceed SLAs or need retries (document triggers when we measure). |
| MCP vs direct HTTP | **Direct** Nest providers calling vendor SDKs/HTTP for production paths; MCP remains a **tooling** concern unless we standardize a gateway. |
| CDN images | On ingest, **mirror to S3** (stage buckets: `creatorshop-v2-files-local` / `-dev` / `-prod` or env-per-deploy) and persist **stable** URLs in DB columns / JSON — not raw third-party CDN URLs as the only copy. |
| Discovery + saved brand retention | **Unverified** profiles without org: **purged after 7 days** (daily cron). Verified / org-linked profiles retained. **`resolve`** does not leak preview payloads. |

---

## Phases and checklist

### Phase 0 — Docs and contracts (this repo)

- [x] `IMPLEMENTATION_TRACKING.md` created (this file).
- [x] Keep `docs/api/brand-discovery.openapi.yaml` in sync with Step 1 variants + waitlist + **`POST /api/v1/brand/surface-scan`** + optional `existingBrandProfile` on **`resume`** (profile GET/PATCH still documented primarily in code + `brand.contracts.ts`).
- [x] **Developer quick ref:** [SURFACE_SCAN_AND_PROMPTS.md](../brand-onboarding/SURFACE_SCAN_AND_PROMPTS.md) — prompt locations, Parallel/Gemini pipeline, cache/`force`, check order.
- [x] Frontend contract mirror: `creator-commerce-frontend-v2` — `brand-onboarding/contracts/discovery.contracts.ts` + **`brand.contracts.ts`** (surface scan + profile read/patch types).

### Phase 1 — Step 1 gatekeeper (in progress)

- [x] URL gate + normalization (`discovery-url.util.ts`) — SSRF-safe (no blind fetch in hot path).
- [x] `DiscoveryLead` / `MarketIntelligenceLog` persistence for supported / unsupported paths.
- [x] **`org_claimed`** when verified + org has user.
- [x] **`brand_active`** when `isVerified` (anonymous re-entry blocked).
- [x] **`verification_required`** domain/IP vendor scan caps (7d window; local exempt).
- [x] **`resume`** unverified surface-complete profiles within 7d (`createdAt`).
- [x] **`surface_scan_attempts`** + enforce gate on `surface-scan`.
- [x] **Entry resolver** endpoint `POST /api/v1/discovery/resolve`: read-only shell routing (`resume` / `proceed` / `org_claimed` / `blocked` without gate-failure intel writes). See `ENTRY_RESOLVER.md`.
- [x] **Industry vertical behind `IndustryClassifier`** — Nest token `INDUSTRY_CLASSIFIER`; `StubIndustryClassifier` wraps `discovery-industry.stub.ts` until vendor wiring lands.
- [ ] **Replace stub output** with Parallel/Gemini-backed classification (new `@Injectable()` provider bound to `INDUSTRY_CLASSIFIER`).
- [x] **CORS** — `CORS_ORIGINS` env (comma-separated); defaults preserve localhost + dashboard dev/prod hosts (`src/main.ts`). Deploy config should set stage-specific origins (never `*` with `credentials: true`).
- [ ] **Optional:** when request is authenticated, set `DiscoveryLead.userId` on create/update for audit (field exists on model).
- [x] **Waitlist capture** — `POST /api/v1/discovery/waitlist` → `WaitlistLead` create; DTO `discover-waitlist-request.dto.ts`; stricter throttle on route.

### Phase 2 — Surface scan (Steps 2–5 product intent)

- [x] **Parallel extract client** — `integrations/parallel/parallel-extract.client.ts` calls hosted `POST https://api.parallel.ai/v1/extract` with gated same-origin URL allowlist (`surface-scan-urls.ts` + Step 1 gate). (No first-party blind HTTP fetch.)
- [x] **Gemini JSON client** — `integrations/gemini/gemini-json.client.ts` (`@google/generative-ai`) + Zod boundary schema `surface-scan-gemini.schema.ts`.
- [x] **Human-editable prompts** — `prompts/surface-scan-synthesis.prompt.md` (copied via `nest-cli.json` assets).
- [x] **Map outputs** into existing `BrandProfile` / `Offering` / `Competitor` / `Location` fields + JSON blobs — **no** schema migration.
- [ ] S3 mirror utility (port patterns from legacy `creator-commerce-backend` S3 helpers; new env vars per stage).
- [x] **Waitlist capture API** — implemented under Step 1 (`POST /api/v1/discovery/waitlist`); frontend waitlist UI can wire when ready.
- [x] **Brand profile bootstrap (MVP)** — `BrandProfile` upsert keyed by apex `domain` from `DiscoveryLead.normalizedUrl` (no `discovery_lead_id` FK yet; implicit link via domain until schema approval).

### Phase 3 — Step 6 verification (product `step-8.md` UI copy)

- [x] APIs: `POST .../verification/send` + `POST .../verification/verify`; `VerificationCode` + Postmark `src/mail/`.
- [x] Frontend verification screen wired (timers, paste, pricing redirect).
- [x] **Pre-prod stub:** fixed code `123456` — see **[VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md)** (flip `USE_REAL_BRAND_VERIFICATION_OTP` + `BRAND_VERIFICATION_USE_REAL_OTP=true` for prod).
- [ ] Re-enable real OTP in production deploy checklist (Postmark env + both toggles).

### Phase 4 — Step 7 deep intel (background)

- [ ] Trigger rules (post-verify only per `step-2.md` strategy).
- [ ] Job row or status transitions on `BrandProfile.scanStatus` / `deepIntelStatus` without new tables if possible.

### Phase 5 — Step 8 completion / dashboard

- [ ] Aggregate read API for “single scroll” dashboard (real DB fields).
- [ ] Logout/session — existing auth module when introduced.
- [ ] **Org invitations** — APIs for inviting additional brand users (deferred until domain/org rules are final).

### Phase 6 — Frontend v2 (`creator-commerce-frontend-v2`) — **deferred**

Pick up after Step 1–2 APIs are stable enough to replace mocks end-to-end. Full checklist: **[FRONTEND_REQUIREMENTS.md](./FRONTEND_REQUIREMENTS.md)**.

- [ ] Strip `mock-data/` and **all** fallback static defaults once each route is API-backed (including `??` / `INITIAL_*` placeholders).
- [x] **Steps 2–5 funnel (MVP):** landing ensures `leadId` before scan; scan calls `POST /api/v1/brand/surface-scan`; DNA/catalogue/competitors hydrate via `GET /api/v1/brand/profiles/:id` + `sessionStorage` handoff; DNA “Looks good” calls `PATCH` before continuing.
- [ ] Step 4 catalogue: **three** templates (D2C default, Healthcare, Offline) with explicit **industry → template** mapping aligned to backend `IndustryVertical`; all three reachable in UI for QA.
- [ ] Keep `VITE_API_URL` (and other `VITE_*`) out of docs except **names**; secrets stay in `.env` / deployment stores only.

---

## API modularity (target layout under `src/features/brand-onboarding/`)

| Piece | Responsibility |
|-------|----------------|
| `brand.controller.ts` | Brand surface scan + profile read/patch (`/api/v1/brand/*`). |
| `brand-profile.service.ts` | Prisma serialization + `isUserEdited` merge rules for DNA PATCH. |
| `brand-onboarding.service.ts` | Step 1 orchestration only. |
| `discovery-*.ts` | Step-1 URL gate + persistence helpers (may split further). |
| `integrations/parallel/*.ts` | Parallel Extract HTTP client (timeouts, typed responses). |
| `integrations/gemini/*.ts` | Gemini JSON generation client. |
| `prompts/*.prompt.md` | Prompt assets (loaded at runtime from `dist/` via Nest asset copy). |
| `surface-scan/*.ts` | `BrandSurfaceScanRunner`: HTTP vendor pipeline + unconfigured/cache path. |

Module **folder** name: `brand-onboarding`. **Route prefixes:** `api/v1/discovery/*` (Step 1) + `api/v1/brand/*` (surface scan + profile); see OpenAPI.

---

## Testing and quality (ongoing)

- [ ] **Contract tests** or smoke script that loads `docs/api/brand-discovery.openapi.yaml` and asserts example payloads still match service DTOs (optional; pick tooling when CI stabilizes).
- [ ] **Integration tests** for `resolve` / `validate` with Prisma test DB (happy paths + `org_claimed` fixture).
- [ ] **Observability** — structured logs for `leadId` / `outcome` (no raw URLs in production logs beyond redacted form); request correlation id middleware (future).

---

## Gaps to decide later (do not block Phase 1)

- Exact **domain** string format stored on `BrandProfile.domain` vs `DiscoveryLead.normalizedUrl` (hostname-only vs URL); normalize in one shared helper before lookups.
- **Resume** for anonymous same-domain: auth vs public token vs signed `leadId` links.
- **Webhooks** from Parallel if they move to async jobs.
- **Legal / robots.txt** policy for crawls.
- **Rate limits** per domain vs per IP for Parallel cost control (coordinate with `ThrottlerModule` and vendor quotas).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-14 | `POST /api/v1/discovery/resolve` entry resolver; `ENTRY_RESOLVER.md` + `AI_GUARDRAILS.md`; landing wired to resolve/validate + org-claimed modal; contracts consolidated under frontend `brand-onboarding/contracts`. |
| 2026-05-14 | `FRONTEND_REQUIREMENTS.md` + Phase 6 (deferred): mocks/fallback removal, catalogue three-template rule, env naming only in docs. |
| 2026-05-14 | Tracking doc expanded: current status, implemented API table, Phase 1 CORS/userId, waitlist + bootstrap + mail + invitations backlog, testing/observability section, decision link to `AI_GUARDRAILS.md`. |
| 2026-05-14 | Phase 1: `CORS_ORIGINS`, `IndustryClassifier` DI + stub provider, `POST /api/v1/discovery/waitlist` + OpenAPI + frontend contract types; tracker checkboxes updated. |
| 2026-05-14 | Docs: `SURFACE_SCAN_AND_PROMPTS.md` + API README pointer; `resume` may include `existingBrandProfile` preview; surface-scan cache short-circuit (`mode: cached`) with `force` / `BRAND_SCAN_FORCE_REFRESH`; preview modal shows saved scan summary. |
| 2026-05-14 | Removed surface-scan stub runner and `BRAND_SCAN_FORCE_STUB`; only Parallel+Gemini HTTP pipeline or unconfigured (503) / cache (`mode: cached`). Contracts and OpenAPI `mode` enum updated (`http` \| `cached`). |
| 2026-05-25 | Step 6 real OTP + Postmark implemented; pre-prod stub `123456` default — [VERIFICATION_OTP_TOGGLE.md](./VERIFICATION_OTP_TOGGLE.md). |
