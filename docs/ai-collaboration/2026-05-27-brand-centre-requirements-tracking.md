# Brand Centre backend — requirements tracking

**Last updated:** 2026-05-27  
**Repos:** `creator-commerce-backend-v2`, `creator-commerce-frontend-v2`  
**Source of truth:** `docs - Copy/brand-centre/REQUIREMENTS.md`

This document tracks **what is implemented** vs **what remains** against `REQ-*`.

---

## Status summary

- **Backend foundation (schema + APIs + jobs)**: **Done**
- **Tab 1 (DNA)**: **Done (read/write + deep-scan enrichment)**  
- **Tab 2 (Intelligence)**: **Done (AI refresh + leak persistence + JSON APIs)**  
- **Tab 3 (Planner)**: **Done (move-to-planner + aggregation + approve circuit breaker)**  
- **Out of scope (intentional)**: Campaigns export, live Instagram/Meta APIs, real escrow/billing, public profile route

---

## Scope exceptions (intentional v1)

- **REQ-SCOPE-001**: Public profile page route — not implemented (frontend link disabled)
- **REQ-SCOPE-002**: Campaigns module handoff — approve sets status only; no external export
- **REQ-SCOPE-003**: Live social APIs — baselines are `ai_inferred`
- **REQ-SCOPE-004**: Real escrow/billing — placeholders returned
- **REQ-SCOPE-005**: `campaigns_execution` table — not implemented; v1 uses in-app planner cards
- **REQ-SCOPE-006**: Product SQL literal copy — adapted to org-scoped Prisma

---

## Requirements coverage

### Events

- **REQ-EVT-001 (surface scan → cold start)**: **Done**
  - Cold start budget row + mixes seeded after surface scan
- **REQ-EVT-002 (verify → deep scan job)**: **Done**
  - Job enqueue + worker
  - Prompt 1 normalized + validated + persisted
- **REQ-EVT-003 (Tab 2 intelligence refresh)**: **Done**
  - `GET /intelligence` may enqueue refresh if stale
  - Prompt 2 worker persists leak cards (≥1% lift)
- **REQ-EVT-004 (move-to-planner)**: **Done**
  - Leak marked pushed + planner aggregate job creates planner card
  - **Logout eviction** endpoint added: `POST /api/v1/brand-centre/session/evict`

### Tab 1 — Brand DNA

- **REQ-T1-001 Profile**: **Done**
  - Core fields + handles supported; deep scan can set handles; patch routes exist
- **REQ-T1-002 Narrative**: **Done**
  - Tagline, brief description, 3 USPs, tone, do-not-say stored in `strategicDna`
- **REQ-T1-003 Identity + personas**: **Done**
  - Palette/fonts/aesthetics + personas table
- **REQ-T1-004 Offerings routing sections**: **Done**
  - Template exposed via API; deep scan can enrich offerings with 3 selling points
  - URL validation on create/update/scan-url
- **REQ-T1-005 Offers ledger**: **Done**
  - CRUD APIs; deep scan can upsert offers when provided
- **REQ-T1-006 Competitors**: **Done**
  - CRUD APIs; max 3 enforced
- **REQ-T1-007 Budget**: **Done**
  - Phase 1 cold start → phase 2 self-healing
  - 30-day edit limit via `BrandBudgetModificationLog`
- **REQ-T1-008 Account placeholders**: **Done**
  - Placeholder escrow/meta/plan/quota

### Tab 2 — Intelligence

- **REQ-T2-001 Dashboard metadata**: **Done**
- **REQ-T2-002 Baseline (Prompt 1)**: **Done**
  - Baseline health + SOV stored on `BrandIntelligenceBaseline`
- **REQ-T2-003 Leak cards (Prompt 2)**: **Done**
  - Lift eviction, drawer payload, persistence, archive support

### Tab 3 — Campaign Planner

- **REQ-T3-001 Aggregation**: **Done**
  - Objective × tier key enforced via Prompt 3 schema
- **REQ-T3-002 Card types**: **Done**
  - New / suggested update / auto-pause supported
- **REQ-T3-003 Planner payload**: **Done**
  - Assets/briefs matrix persisted in `BrandPlannerCard`
- **REQ-T3-004 Approve & circuit breaker**: **Done**
  - Budget ceiling circuit breaker; sets `PROCEEDED_TO_PIPELINE` only (no export)

### API surface

- **REQ-API-001**: Done (`/routing-template`, `/scan-status`, `/scan/retry`)
- **REQ-API-002**: Done (Tab 1 routes)
- **REQ-API-003**: Done (Tab 2 routes)
- **REQ-API-004**: Done (Tab 3 routes)

---

## Trial plan assignment (auth)

Not part of Brand Centre requirements, but needed for downstream gating/rolling windows.

- **Plan defaults in Prisma**: `planType = FREE_TRIAL`, `subscriptionStatus = TRIALING`
- **Implemented on `completeBrandRegistration`**:
  - Sets `planType = FREE_TRIAL` and `subscriptionStatus = TRIALING`
  - Sets `planStartedAt = now` **only if not already set**
  - **`trialEndsAt` is not set** (no paid plans yet — avoids blocking users)
- Use `planStartedAt` (or `BrandBudgetModificationLog.modifiedAt` for budget edits) for rolling-window logic

---

## Backend guardrails aligned (2026-05-27)

| REQ | Implementation |
| --- | --- |
| REQ-T1-007 30-day budget edit limit (2 / 30d) | `BrandBudgetModificationLog` + `TooManyRequestsException` (HTTP 429) |
| REQ-T1-007 budget below booked | `updateCeiling` rejects when `master < utilizedBooked` |
| REQ-T1-007 mix slot floors ₹30k / $500 | `assertMixImpliedSlotFloors` on `PATCH /dna/budget/mixes` |
| REQ-AI-001 raw surface scrape text | `BrandProfile.surfaceScrapeBundles` saved at surface scan; deep scan worker uses it |
| REQ-EVT-004 logout eviction | `POST /session/evict` + frontend logout |
| REQ-EVT-004 30 min inactivity | `brandCentreLastActiveAt` + `evictIfInactive` on each Brand Centre API call |
| REQ-T2-003 archive retention 30d | Archived leak list filters `archivedAt >= now - 30 days` |
| REQ-T3-004 circuit breaker | `approveCard` compares commitment vs remaining budget |

---

## Frontend (Stitch UI + data gap panel)

- **Tab 1–3 Stitch layout**: unchanged from product Stitch file; read-only display with `-` for empty fields.
- **Tab 2 & 3 below fold**: `BrandCentreStitchDataGap` shows API fields **not** rendered in Stitch UI (for product comparison).
- **Edit flows**: intentionally not wired.

---

## Remaining work (if you want strict parity with product docs later)

- **Frontend**:
  - Promote Stitch data-gap fields into main Tab 2/3 canvas (Zone 1 §2–3, full leak grid, drawer telemetry)
  - Wire Tab 2/3 actions (move to planner, approve, discard)
  - Switch from placeholder `-` rendering to “hide empty fields” rules
- **Backend**:
  - Optional: cron recovery for stuck QUEUED jobs
  - Optional: 24h intelligence refresh cron
  - Optional: more strict master schemas for response validation (beyond prompt schemas)
- **Next programme**:
  - Campaigns handoff/export + `campaigns_execution` table
  - Live Instagram/Meta/ads inputs

