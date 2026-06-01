# Brand Centre — implementation plan

**Status:** Ready to implement when [READINESS_COMPARISON.md](./READINESS_COMPARISON.md) gate passes  
**Requirements source:** [REQUIREMENTS.md](./REQUIREMENTS.md)  
**Schema detail:** [SCHEMA_MIGRATION.md](./SCHEMA_MIGRATION.md)

Each build slice delivers **migration + services + APIs** together. Trace work to `REQ-*` IDs in requirements.

---

## Engineering decisions (locked)

| Topic | Decision | REQ ref |
| --- | --- | --- |
| Deep scan trigger | Email verify (Step 6) | REQ-EVT-002 |
| Tenancy | `Organization` → `BrandProfile`; JWT org scope | REQ-SCOPE-006 |
| AI | Parallel.ai + Gemini only | REQ-SCOPE-003 |
| Public profile | Omit backend | REQ-SCOPE-001 |
| Campaigns export | Status only; no handoff | REQ-SCOPE-002 |
| Budget cold start | Routing template; not validation floor | REQ-T1-007, REQ-EVT-001 |
| Real budget | Prompt 1 at deep scan | REQ-EVT-002 |
| Templates | Four routing types in config + API | REQ-RT-001, REQ-RT-002 |
| Async | In-process jobs + cron recovery | REQ-JOB-001 |
| Module | Single `src/features/brand-centre/` | — |

---

## Module layout

```text
src/features/brand-centre/
  brand-centre.module.ts
  brand-centre.controller.ts
  brand-centre-auth.util.ts

  config/
    industry-routing-templates.ts      # REQ-RT-002
    map-industry-vertical.ts           # REQ-RT-001
    budget-cold-start-templates.ts     # REQ-EVT-001

  services/
    brand-centre-cold-start.service.ts
    brand-centre-scan.service.ts
    brand-centre-dna.service.ts
    brand-centre-budget.service.ts
    brand-centre-offering-scan.service.ts
    brand-centre-intelligence.service.ts
    brand-centre-planner.service.ts
    brand-centre-session-eviction.service.ts

  workers/
    deep-scan.worker.ts                # REQ-EVT-002, REQ-AI-001
    intelligence-refresh.worker.ts     # REQ-EVT-003, REQ-AI-002
    planner-aggregate.worker.ts        # REQ-EVT-004, REQ-AI-003

  schemas/                             # REQ-VAL-001
  mappers/
  prompts/                             # Human .md files — see PROMPT_ALIGNMENT.md
    prompt-loader.ts
    deep-scan-strategy.prompt.md
    intelligence-leaks.prompt.md
    planner-aggregator.prompt.md
  dto/
  types.ts
```

**Onboarding hooks:**

| Hook location | Calls |
| --- | --- |
| `HttpBrandSurfaceScanRunner` (post-success) | `BrandCentreColdStartService.seedFromSurfaceScan` |
| `BrandVerificationService` (post-verify) | `BrandCentreScanService.enqueueDeepScan` |
| Auth logout | `BrandCentreSessionEvictionService.evictForProfile` |

---

## Build slices

### Slice 1 — Foundation

**Requirements:** REQ-RT-001, REQ-RT-002, REQ-JOB-001, REQ-API-001, REQ-SCOPE-006

| Deliverable | Detail |
| --- | --- |
| Migration | Extend `BrandProfile`; add `BrandCentreJob`; enums |
| Config | Three template modules |
| Module | Scaffold, JWT util, job service |
| APIs | `GET /routing-template`, `GET /scan-status`, `POST /scan/retry` |

**Exit criteria:** Module loads; JWT resolves profile; routing template returns for test profile.

---

### Slice 2 — Event 1 (cold start)

**Requirements:** REQ-EVT-001, REQ-T1-007 (phase 1)

| Deliverable | Detail |
| --- | --- |
| Migration | `BrandBudgetConfiguration` |
| Service | `BrandCentreColdStartService` |
| Hook | Surface scan runner |
| APIs | Budget visible via later `GET /dna/budget` |

**Exit criteria:** After surface scan, budget row exists with `PHASE_1_COLD_START` and routing-appropriate mixes.

---

### Slice 3 — Tab 1 read APIs

**Requirements:** REQ-T1-001 through REQ-T1-008 (read paths), REQ-API-002 (GET)

| Deliverable | Detail |
| --- | --- |
| Migration | `BrandAudiencePersona`, `BrandOffer`, `BrandBudgetModificationLog`; extend `Offering` |
| Service | `BrandCentreDnaService.getAggregate` |
| APIs | `GET /dna`, `GET /dna/offerings`, `GET /dna/offers`, `GET /dna/competitors`, `GET /dna/budget`, `GET /dna/account` |

**Exit criteria:** Authenticated GET returns aggregate matching surface-scan data + cold-start budget + routing template.

---

### Slice 4 — Event 2 (deep scan)

**Requirements:** REQ-EVT-002, REQ-AI-001, REQ-VAL-001

| Deliverable | Detail |
| --- | --- |
| Migration | `BrandIntelligenceBaseline` |
| Worker | `deep-scan.worker.ts` + Prompt 1 |
| Hook | Verification service |
| Mappers | `map-prompt1-to-db.ts` |
| APIs | `/scan-status` reflects job progress |

**Exit criteria:** Verify → job completes → DNA + baseline populated; budget phase `PHASE_2_SELF_HEALING`.

---

### Slice 5 — Tab 1 write APIs

**Requirements:** REQ-T1-002 through REQ-T1-007 (write), REQ-VAL-002, REQ-API-002 (PATCH/CRUD)

| Deliverable | Detail |
| --- | --- |
| Services | Budget guards, offering URL scan, competitor scan |
| APIs | All PATCH/CRUD under `/dna/*` |

**Exit criteria:** Edits validate per Zod; budget 30-day guard returns 429; domain checks reject off-brand URLs.

---

### Slice 6 — Tab 2

**Requirements:** REQ-EVT-003, REQ-T2-001 through REQ-T2-003, REQ-API-003

| Deliverable | Detail |
| --- | --- |
| Migration | `BrandPerformanceLeak` |
| Worker | `intelligence-refresh.worker.ts` |
| Service | Stale check on GET; eviction on logout |
| APIs | Full `/intelligence/*` |

**Exit criteria:** Mount Tab 2 → leaks appear (≥1% lift); drawer payload complete; archive filter works.

---

### Slice 7 — Tab 3

**Requirements:** REQ-EVT-004, REQ-T3-001 through REQ-T3-004, REQ-API-004

| Deliverable | Detail |
| --- | --- |
| Migration | `BrandPlannerCard` |
| Worker | `planner-aggregate.worker.ts` |
| Service | Routing logic (new / update / auto-pause); circuit breaker |
| APIs | Full `/planner/*` |

**Exit criteria:** Move-to-planner creates card; approve runs circuit breaker; no external campaigns call.

---

### Slice 8 — Contract & QA

| Deliverable | Detail |
| --- | --- |
| OpenAPI | `docs - Copy/api/brand-centre.openapi.yaml` |
| Traceability | REQ-* checklist in PR template |
| Manual test | Flow in REQUIREMENTS §11 + local test script |

---

## API summary

Full detail in [REQUIREMENTS.md §7](./REQUIREMENTS.md#7-api-requirements).

```
GET    /routing-template
GET    /scan-status
POST   /scan/retry

GET    /dna
PATCH  /dna/profile | /narrative | /identity
CRUD   /dna/personas | /offerings | /offers | /competitors
POST   /dna/offerings/scan-url | /dna/competitors/scan-url
GET/PATCH /dna/budget/ceiling | /dna/budget/mixes
GET    /dna/account

GET    /intelligence
POST   /intelligence/refresh
CRUD   /intelligence/leaks/*
POST   /intelligence/leaks/:id/move-to-planner

GET    /planner
GET/PATCH /planner/cards/:id
POST   /planner/cards/:id/approve | /acknowledge
```

All routes: `JwtAuthGuard`, role `BRAND`, org-scoped.

---

## Testing checklist

1. Surface scan → `PHASE_1_COLD_START` + routing type set
2. Verify → deep scan job → `GET /dna` populated
3. Budget phase 2 + AI explanation present
4. `PATCH /dna/budget/ceiling` third time in 30d → 429
5. `GET /intelligence` → leaks with drawer JSON
6. Move to planner → Tab 3 card type correct
7. Approve → circuit breaker; status `PROCEEDED_TO_PIPELINE`; no campaigns HTTP call
8. Logout → moved/discarded leaks archived

**Env:** `PARALLEL_API_KEY`, `GEMINI_API_KEY` only (no social keys).

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Redo: driven by REQUIREMENTS.md; slice-based table+API delivery |
