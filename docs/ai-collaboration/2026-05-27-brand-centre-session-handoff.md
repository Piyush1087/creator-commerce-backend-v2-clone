# Brand Centre + Deep Scan — session handoff (backend)

**Last updated:** 2026-05-27  
**Repo:** `creator-commerce-backend-v2`  
**Pair with:** `creator-commerce-frontend-v2/docs/ai-collaboration/2026-05-27-brand-centre-session-handoff.md`

Use this doc to resume Brand Centre / deep scan work in the next session without re-reading the whole codebase.

---

## Where things stand

| Area | Status |
| --- | --- |
| Schema + migrations | Applied locally via `npx prisma migrate deploy` |
| Brand Centre module (Tab 1–3 APIs + workers) | **Done** for v1 scope |
| Event 1: surface scan → cold start | **Done** |
| Event 2: email verify → deep scan worker | **Done** (with Gemini payload normalizers) |
| Event 3: intelligence refresh (Prompt 2) | **Done** |
| Event 4: move-to-planner (Prompt 3) | **Done** |
| Session eviction on logout | **Done** (`POST /session/evict`) |
| Trial plan on registration | **Done** — `planStartedAt` only; **no** `trialEndsAt` |

**Intentionally out of scope (v1):** campaigns export, live Meta/IG APIs, real billing/escrow, public profile route, `campaigns_execution` table.

---

## Quick start (next session)

```powershell
cd creator-commerce-backend-v2
npx prisma migrate deploy   # if column errors (e.g. plan_started_at)
npx prisma generate
npm run dev
```

**Required env (deep scan + surface scan):** `GEMINI_API_KEY`, `PARALLEL_API_KEY`, Postgres via `.env`.

If `prisma migrate dev` fails on shadow DB (`P3006` / missing tables in shadow), use **`migrate deploy`** against your local DB instead.

---

## Event pipeline (mental model)

```text
Surface scan (onboarding)
  → BrandProfile upsert + offerings/competitors
  → BrandCentreColdStartService (budget PHASE_1, routing)

Email verify (onboarding)
  → BrandCentreScanService.enqueueDeepScan()
  → BrandCentreJob DEEP_SCAN → DeepScanWorker (Prompt 1 Gemini)
  → strategicDna, personas, offerings enrichment, offers ledger, baseline

GET /intelligence (Tab 2)
  → may enqueue INTELLIGENCE_REFRESH if stale / no leaks
  → IntelligenceRefreshWorker (Prompt 2)

POST /intelligence/leaks/:id/move-to-planner
  → PLANNER_AGGREGATE job (Prompt 3)
```

---

## Key files (bookmark these)

| Purpose | Path |
| --- | --- |
| All HTTP routes | `src/features/brand-centre/brand-centre.controller.ts` |
| Deep scan worker | `src/features/brand-centre/workers/deep-scan.worker.ts` |
| Prompt 1 Zod schema | `src/features/brand-centre/schemas/deep-scan-prompt1.schema.ts` |
| **Gemini → Zod normalizer** | `src/features/brand-centre/utils/normalize-deep-scan-payload.util.ts` |
| Persist inventory/offers from Prompt 1 | `src/features/brand-centre/utils/apply-prompt1-inventory.util.ts` |
| Surface scan runner | `src/features/brand-onboarding/surface-scan/http-brand-surface-scan.runner.ts` |
| Surface scan Gemini schema | `src/features/brand-onboarding/surface-scan/surface-scan-gemini.schema.ts` |
| Verify → deep scan enqueue | `src/features/brand-onboarding/verification/brand-verification.service.ts` |
| Plan assignment (no trial end) | `src/features/auth/auth.service.ts` |
| Prisma models | `prisma/schema.prisma` |

---

## Fixes applied this session (don't re-debug)

### 1. `plan_started_at` column missing

- **Symptom:** `brand_profiles.plan_started_at does not exist` on surface scan upsert.
- **Fix:** Migration `20260527180000_brand_profile_plan_started_at`; run `migrate deploy` + `generate`.
- **Auth:** Sets `FREE_TRIAL` + `TRIALING` + `planStartedAt` on first registration only. Does **not** set `trialEndsAt`.

### 2. Surface scan: `locations[].address = null`

- **Symptom:** Gemini validation failed on null address.
- **Fix:** Schema allows null; runner filters out rows without a non-empty address before `location.createMany`.

### 3. Deep scan: empty `inventoryInfrastructure.entities` / partial `offersLedger`

- **Symptom:** Zod errors — entities min(1), missing offer fields.
- **Fix:** `normalizeDeepScanGeminiPayload()`:
  - Synthesizes entities from discovered products when possible; else drops empty `inventoryInfrastructure`.
  - Filters/normalizes offer rows; skips invalid rows instead of failing whole job.
- **Retry:** `POST /api/v1/brand-centre/scan/retry` after backend restart for brands that failed mid-worker.

---

## API cheat sheet

Base: `/api/v1/brand-centre` (JWT required)

| Tab | Key routes |
| --- | --- |
| Shared | `GET /scan-status`, `POST /scan/retry`, `POST /session/evict` |
| Tab 1 DNA | `GET /dna`, `GET /dna/budget`, `GET /dna/account`, PATCH sub-routes |
| Tab 2 Intelligence | `GET /intelligence`, `POST /intelligence/refresh`, `GET/PATCH /intelligence/leaks/...` |
| Tab 3 Planner | `GET /planner`, `GET/PATCH /planner/cards/:id`, approve/acknowledge |

**Tab 2 gate:** `GET /intelligence` returns 400 until `scanStatus === READY` (deep scan complete).

---

## Verify deep scan worked

1. Complete onboarding + email verify for a test domain.
2. Watch logs for `[DeepScanWorker] deep-scan.complete` (or failure with validation message).
3. `GET /scan-status` → `scanStatus: READY`, job `COMPLETED`.
4. `GET /dna` → narrative, personas, offerings with `sellingPoints`, budget phase 2.
5. `GET /intelligence` → baseline + leaks array (may trigger refresh job if empty/stale).

---

## Likely next session tasks (backend)

1. **Re-test deep scan** on a fresh brand (e.g. mamaearth.in) after normalizer changes; retry failed jobs.
2. **Intelligence worker** — confirm Prompt 2 produces ≥1 leak with lift ≥1%; check `BrandPerformanceLeak` rows.
3. **Planner aggregate** — move a leak to planner; confirm `BrandPlannerCard` created with correct `cardType`.
4. **Optional hardening:**
   - Cron for stuck `QUEUED` jobs
   - Scheduled 24h intelligence refresh
   - Stricter response DTOs / OpenAPI
5. **Product follow-ups:** campaigns export, real billing, live social APIs (see `docs - Copy/brand-centre/REQUIREMENTS.md`).

---

## Related docs

| Doc | Purpose |
| --- | --- |
| `docs/ai-collaboration/2026-05-27-brand-centre-requirements-tracking.md` | REQ-* coverage vs product docs |
| `docs - Copy/brand-centre/REQUIREMENTS.md` | Product source of truth (read-only) |
| Frontend handoff | Tab wiring, UI state, manual test flow |

---

## Known local gotchas

- **Windows:** Stop running `node` processes before `prisma generate` if you hit `EPERM` on `query_engine-windows.dll.node`.
- **Shadow DB:** Prefer `migrate deploy` over `migrate dev` if older migrations fail shadow replay.
- **Gemini variance:** Expect occasional partial JSON; normalizers are the safety net — extend them rather than loosening product schemas permanently.
