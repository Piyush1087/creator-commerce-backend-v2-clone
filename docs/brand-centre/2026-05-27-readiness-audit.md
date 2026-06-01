# Brand Centre — readiness audit (pre test run)

**Date:** 2026-05-27  
**Compared against:** `docs/brand-centre/REQUIREMENTS.md` + `product-team-docs/*`  
**Repos:** `creator-commerce-backend-v2`, `creator-commerce-frontend-v2`

Use this before E2E testing to know what **should** work vs what will still show `-` or static UI.

---

## Executive summary

| Layer | Verdict | Notes |
| --- | --- | --- |
| **Schema + migrations** | ✅ Aligned | Brand Centre tables, enums, `planStartedAt`, `strategicDna`, jobs, baseline, leaks, planner |
| **Backend APIs + workers** | ✅ v1 complete | Events 1–4 implemented; documented scope exceptions apply |
| **Deep scan (Event 2)** | ⚠️ Testable with caveats | Normalizers fix partial Gemini JSON; scrape **input** to Prompt 1 is thinner than product spec |
| **Frontend Tab 1** | ⚠️ Read OK | Real fetch + `-`; **edit/actions not wired** |
| **Frontend Tab 2** | ⚠️ Partial vs product UI | Layout matches Stitch; **~40% of required fields rendered** (Zone 1 §2–3 missing; one leak card only) |
| **Frontend Tab 3** | ⚠️ Partial vs product UI | Real cards from API; **sidebar metrics static**; actions not wired |

**Recommendation for test run:** Validate **backend + Tab 1 DNA** end-to-end first. Treat Tab 2/3 as “data smoke test” until UI gaps below are closed.

---

## Event pipeline vs REQUIREMENTS

| Event | REQ | Backend | Frontend |
| --- | --- | --- | --- |
| 1 Surface → cold start | REQ-EVT-001 | ✅ `BrandCentreColdStartService` after surface scan | Tab 1 budget shows Phase 1 mixes |
| 2 Verify → deep scan | REQ-EVT-002 | ✅ Job + `DeepScanWorker` + Prompt 1 Zod + persist | Banner + poll; DNA populates on `READY` |
| 3 Tab 2 refresh | REQ-EVT-003 | ✅ `GET /intelligence` may enqueue; Prompt 2 worker | Fetches `/intelligence`; needs `scanStatus=READY` |
| 4 Move to planner | REQ-EVT-004 | ✅ API + Prompt 3 worker | **Not wired** (buttons disabled) |

---

## Deep scan — backend detail

### Implemented (REQ-EVT-002)

| Requirement | Implementation |
| --- | --- |
| Enqueue on email verify | `brand-verification.service.ts` → `enqueueDeepScan` |
| Prompt 1 `.prompt.md` + Zod | `deep-scan-strategy.prompt.md`, `deep-scan-prompt1.schema.ts` |
| Persist narrative / visuals / compliance | `BrandProfile` + `strategicDna` JSON |
| Personas | `BrandAudiencePersona` replace-all on success |
| 3 USPs + tone + do-not-say | `strategicDna` + profile tagline/description |
| Inventory 3 selling points | `applyPrompt1InventoryEntities` |
| Offers ledger | `applyPrompt1OffersLedger` (optional rows) |
| Budget Phase 2 | `BrandBudgetConfiguration` `PHASE_2_SELF_HEALING` + mixes |
| Tab 2 baseline seed | `BrandIntelligenceBaseline` (growthImpactMatrix, baselineHealth, shareOfVoice) |
| Healthcare compliance | In prompt + normalizer fallbacks by routing type |
| Retry | `POST /scan/retry` |
| Partial Gemini recovery | `normalize-deep-scan-payload.util.ts` |

### Gaps / risks (affects test quality)

| # | Gap | Product says | Code today | Impact on test |
| --- | --- | --- | --- | --- |
| D1 | **Raw surface scrape text** | Full Parallel markdown bundles in Prompt 1 input | ✅ `surfaceScrapeBundles` stored at surface scan; deep scan uses it (fallback: profile JSON snapshot) | Re-run surface scan + deep scan for brands created before this column |
| D2 | **Optional PDP re-extract** | May re-scrape offering URLs in deep scan | Not implemented | OK for v1 if surface catalog is good |
| D3 | **`inventoryInfrastructure` required in prompt** | Min 1 entity when present | Zod: optional block; normalizer synthesizes from offerings or drops empty | Fixed failures; may skip entities if Gemini empty and synthesis fails |
| D4 | **`offersLedger` strict fields** | Full ledger rows | Normalizer **filters** invalid rows → `[]` | No offers in Tab 1 if Gemini omits datetimes — expected `-` |
| D5 | **Failed job scan status** | Product implies failed state visibility | On failure: `scanStatus` → `SURFACE_COMPLETE`, `deepIntelStatus` → `FAILED` | Banner may hide failure; check `scan-status` job `FAILED` |
| D6 | **Parallel in deep scan** | Product doc mentions Parallel + Gemini | Deep scan = **Gemini only** on DB snapshot | Accept for v1 per IMPLEMENTATION_PLAN |

### Deep scan test expectations

After verify + worker `COMPLETED` + `scanStatus=READY`:

| Check | API / DB |
| --- | --- |
| `GET /scan-status` | `scanStatus: READY`, job `COMPLETED` |
| `GET /dna` | tagline, description, `narrative.brandUsps` length 3, personas ≥1, offerings `sellingPoints` length 3, `isDeepScanned` |
| `GET /dna/budget` | `allocationPhase: PHASE_2_SELF_HEALING`, mixes sum 100 |
| `GET /intelligence` | `baseline` non-null; `leaks` may be `[]` until refresh job runs |

---

## Schema vs product (`BrandCentre-BE_Schema.md` + REQUIREMENTS)

| Area | Status |
| --- | --- |
| `BrandProfile` extensions (routing, handles, strategicDna, scan flags) | ✅ |
| `BrandBudgetConfiguration` + modification log | ✅ |
| `BrandAudiencePersona`, `BrandOffer` | ✅ |
| `BrandIntelligenceBaseline` | ✅ |
| `BrandPerformanceLeak` + drawer JSON | ✅ |
| `BrandPlannerCard` + aggregation key | ✅ |
| `BrandCentreJob` queue | ✅ |
| `planStartedAt` (no `trialEndsAt` set) | ✅ |
| `campaigns_execution` | ❌ Out of scope REQ-SCOPE-005 |

---

## Tab 1 — requirements vs implementation

### Backend (REQ-T1-*)

| REQ | Status | Notes |
| --- | --- | --- |
| T1-001 Profile | ✅ GET/PATCH | Public profile route N/A (REQ-SCOPE-001) |
| T1-002 Narrative | ✅ | 3 USPs enforced on PATCH |
| T1-003 Identity + personas | ✅ CRUD | |
| T1-004 Offerings routing | ✅ | Max 5 primary / 3 collection via template; domain URL check |
| T1-005 Offers | ✅ CRUD | Unique promo per brand |
| T1-006 Competitors max 3 | ✅ | |
| T1-007 Budget | ✅ | 2 edits / 30d, floor validation in budget service |
| T1-008 Account placeholders | ✅ | |

### Frontend (`BrandCentre-tab1.md`)

| Product section | Status | Notes |
| --- | --- | --- |
| Profile, narrative, identity, budget zones | ✅ Display | `-` for empty |
| Catalog (offerings, offers, competitors) | ✅ Display | From `mapDnaCatalogView` |
| Edit / add / drawers / save | ❌ | Buttons present, **no PATCH/POST** |
| View public profile | ❌ | Disabled / no route |
| Budget adjustment modal | ❌ | Charts read-only |
| Persona card details (geo, age, affluence) | ⚠️ | Name only in carousel |

---

## Tab 2 — requirements vs implementation

### Backend (REQ-T2-*)

| REQ | Status | Notes |
| --- | --- | --- |
| T2-001 Metadata | ✅ | `systemStatus`, `dateRangeLabel`, `dataRefreshedAt` |
| T2-002 Baseline in API | ✅ | Returned under `baseline.*` from `BrandIntelligenceBaseline` |
| T2-003 Leaks | ✅ | Prompt 2, ≥1% lift filter, drawer stored in DB |
| Leak detail API | ✅ | `GET /intelligence/leaks/:id` includes `drawerDeepDive` |
| List leaks API | ⚠️ | Summary only — **no drawer** in list (by design) |

### Frontend (`BrandCentre-tab2.md`)

| Product zone / section | Status | Notes |
| --- | --- | --- |
| Meta row (status, refreshed, date range) | ✅ | Real API |
| Zone 1 §1 Growth impact + levers | ✅ | From `baseline.growthImpactMatrix` |
| Zone 1 §2 Baseline health (reach, engagement, archetypes, quality, safety) | ❌ | **Not rendered** — data exists in `baseline.baselineHealth` |
| Zone 1 §3 SOV + competitor themes | ❌ | **Not rendered** — data in `baseline.shareOfVoice` |
| Zone 2 leak **grid** (all cards) | ❌ | Only **`leaks[0]`** shown |
| Drawer: underlying logic, competitive gap, checklist | ❌ | Does not call `GET .../leaks/:id`; no checklist |
| Move to planner / dismiss / archive | ❌ | Disabled / `-` count |
| Default accordion | ⚠️ | Product: Zone 1 collapsed; UI: Zone 2 open |

**Tab 2 test note:** After deep scan, first `GET /intelligence` may enqueue refresh — wait for job `INTELLIGENCE_REFRESH` `COMPLETED`, then reload tab.

---

## Tab 3 — requirements vs implementation

### Backend (REQ-T3-*)

| REQ | Status |
| --- | --- |
| T3-001 Aggregation objective × tier | ✅ Prompt 3 schema |
| T3-002 Card types | ✅ |
| T3-003 Payload matrix | ✅ JSON on card |
| T3-004 Approve circuit breaker | ✅ No external export (REQ-SCOPE-002) |

### Frontend (`BrandCentre-tab3.md`)

| Product area | Status | Notes |
| --- | --- | --- |
| Card lists (new / update / auto-pause) | ✅ | From `planner.cards` by `cardType` |
| Card fields (objective, tier, hook, workflow) | ✅ | `-` when missing |
| Consolidation health 92% / pending tasks | ❌ | **Static** placeholder UI |
| Drawer full strategy + asset matrix | ⚠️ | Partial; no `GET /planner/cards/:id` |
| Launch / discard / approve | ❌ | Not wired |

---

## API surface checklist (REQ-API-001–004)

All routes in `brand-centre.controller.ts` — **implemented** for v1. Frontend consumption:

| Route group | Backend | Frontend uses |
| --- | --- | --- |
| scan-status, retry, session/evict | ✅ | Tab 1 + logout |
| dna + sub-resources | ✅ | Tab 1 read only |
| intelligence + leaks | ✅ | Tab 2 partial |
| planner + cards | ✅ | Tab 3 partial |

---

## Recommended test run order

1. **DB:** `npx prisma migrate deploy` + `npx prisma generate`
2. **Env:** `GEMINI_API_KEY`, `PARALLEL_API_KEY`
3. **New domain** → surface scan → verify email
4. **Watch logs:** `deep-scan.completed` or failure message
5. **`GET /scan-status`** until `READY`
6. **Tab 1:** Confirm DNA fields (not all `-`)
7. **Tab 2:** Open tab → wait for intelligence refresh job if leaks empty → reload
8. **Tab 3:** After `POST .../move-to-planner` (via API/Postman until UI wired) OR existing cards

---

## Priority fix list (to match product docs for display)

### P0 — Before trusting Tab 2/3 UI test

1. **Tab 2:** Render `baseline.baselineHealth` + `baseline.shareOfVoice` (Zone 1 §2–3)
2. **Tab 2:** Map **all** `leaks[]` to opportunity cards (not only index 0)
3. **Tab 2:** Drawer loads `GET /intelligence/leaks/:id` for `drawerDeepDive`

### P1 — Deep scan quality

4. Pass **stored Parallel markdown** (or re-fetch bundles) into `RAW_SURFACE_SCRAPE_TEXT` in deep scan worker

### P2 — Actions + Tab 1 edits

5. Wire Tab 2 move-to-planner / discard
6. Wire Tab 1 PATCH flows and add-offering modals
7. Tab 3: wire approve/discard; fetch card detail; replace static sidebar with API-derived counts

### P3 — Polish

8. Hide empty fields instead of `-` (product preference)
9. Failed deep scan UX on Tab 1 (show job error)

---

## Related docs

| Doc | Use |
| --- | --- |
| `REQUIREMENTS.md` | REQ IDs |
| `READINESS_COMPARISON.md` | Product doc mapping |
| `docs/ai-collaboration/2026-05-27-brand-centre-session-handoff.md` | Commands + file paths |
| `docs/ai-collaboration/2026-05-27-brand-centre-dna-manual-testing.md` | Tab 1 E2E steps |
| `docs/ai-collaboration/2026-05-27-brand-centre-requirements-tracking.md` | Backend REQ checklist (update Tab 2/3 FE notes) |
