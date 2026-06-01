# Brand Centre — engineering requirements

**Status:** Source of truth for backend implementation and code review  
**Derived from:** `product-team-docs/` (read-only reference)  
**Last updated:** 2026-05-27

Use requirement IDs (`REQ-*`) when tracing code, tests, and PRs. When product docs change, update this file first, then implementation plan and schema.

---

## 1. Scope

### 1.1 In scope (v1 backend)

| Area | Requirement |
| --- | --- |
| Events 1–4 | Surface cold start, deep scan, intelligence refresh, move-to-planner |
| Tab 1 | Brand DNA — all zones/sections including industry routing |
| Tab 2 | Intelligence baseline + actionable leak cards |
| Tab 3 | Planner cards (new / suggested update / auto-pause) |
| AI | Parallel.ai + Gemini only for scan, intelligence, planner |
| Auth | JWT-scoped `/api/v1/brand-centre/*` for post-login brand users |
| Onboarding hooks | Surface scan → Event 1; email verify → Event 2 |

### 1.2 Out of scope (v1 — documented exceptions)

| Item | Requirement ID | Notes |
| --- | --- | --- |
| Public profile page | REQ-SCOPE-001 | Tab 1 UI references it; **no backend route** in v1 |
| Campaigns module handoff | REQ-SCOPE-002 | Tab 3 approve sets `PROCEEDED_TO_PIPELINE` only; **no export** to external campaigns app |
| Live social APIs | REQ-SCOPE-003 | No Instagram Graph, YouTube Analytics, Meta Ads APIs; metrics are **AI-inferred** with `source: ai_inferred` |
| Real escrow / billing | REQ-SCOPE-004 | Tab 1 account section returns **placeholder** status |
| `campaigns_execution` table | REQ-SCOPE-005 | SUGGESTED_UPDATE matching uses in-app planner cards until campaigns programme ships |
| Product SQL literal copy | REQ-SCOPE-006 | Product `BE_Schema` is reference; slot into org-centric Prisma model |

---

## 2. System events

### REQ-EVT-001 — Event 1: Onboarding surface scan (sync)

**Trigger:** User submits domain in onboarding Step 1; surface scan completes successfully.

**Must:**

1. Parse and normalize root domain; reject duplicate `website_url` / domain registration.
2. Map currency from country: India → `INR`, United States → `USD`, all others → `USD`.
3. Run surface scraper (existing onboarding runner) for catalog, competitors, visual hints.
4. Set `brandRoutingType` from onboarding `IndustryVertical` (see REQ-RT-001).
5. **Compute Phase 1 Cold Start** budget row (`PHASE_1_COLD_START`) so Tab 1 pie charts are populated before deep analytics.
6. Persist cold-start mixes from routing template (optional lightweight Gemini on scrape text).

**Outputs:**

| Output | Storage |
| --- | --- |
| Surface catalog entities | `Offering`, `Competitor`, `Location` (existing onboarding) |
| Routing type | `BrandProfile.brandRoutingType` |
| Interim budget + mixes | `BrandBudgetConfiguration` phase `PHASE_1_COLD_START` |
| Utilization | 0% until campaigns exist |

**Must not:** Treat validation floor (₹50k / $1k) as the cold-start seed amount.

---

### REQ-EVT-002 — Event 2: Email verification → deep scan (async)

**Trigger:** User successfully verifies email (onboarding Step 6 OTP).

**Must:**

1. Set `isVerified = true` (existing verification service).
2. Enqueue background job `DEEP_SCAN` without blocking HTTP response (<500ms).
3. Execute **Prompt 1** with: brand URL, routing type, country/currency, discovered products JSON, competitors JSON, raw surface scrape text.
4. Validate output against `BrandDNAMasterSchema` + Tab 2 baseline subset (`baselineHealth`, `shareOfVoice`, `financials`).
5. Apply healthcare compliance filter when routing = `HEALTHCARE_TREATMENT` (forbidden terms → `doNotSayList`).
6. Persist Tab 1 DNA: narrative, visuals, personas, enriched offerings (3 USPs each), offers ledger.
7. Persist Tab 2 baseline: health metrics, SOV, growth impact matrix seed.
8. Upgrade budget to **Prompt 1** `masterMonthlyBudget` + strategy mixes; set phase `PHASE_2_SELF_HEALING`.
9. Store AI explanation text for budget adjustment modal.
10. Update scan status: `DEEP_SCAN_IN_PROGRESS` → `READY` | `FAILED`.

**Prompt 1 rules (from product):**

- Verify inventory URLs match brand root domain.
- Exactly 3 brand USPs; exactly 3 selling points per inventory item.
- Construct strategy mixes from scrape + routing type; each mix sums to **100**.
- Calculate baseline health metrics and archetype distributions (each archetype set sums to **100**).

**Outputs:** Populated Tab 1 + Tab 2 baseline; real budget phase 2.

---

### REQ-EVT-003 — Event 3: Tab 2 intelligence refresh (async)

**Trigger:** User mounts Tab 2 (`GET /intelligence`) when data stale **or** `POST /intelligence/refresh`. Optional 24h cron in prod later.

**Must:**

1. Enqueue job `INTELLIGENCE_REFRESH`.
2. Execute **Prompt 2** with: baseline health JSON, SOV JSON, strategy mix JSON.
3. Validate leak array; bin each card into `PDP` | `PAID` | `ROSTER` | `CREATIVE_HOOK`.
4. Assign priority rank and performance color (RED/HIGH, YELLOW/MEDIUM, GREEN/LOW).
5. Include drawer payload: `underlyingDataLogic`, `competitiveDiscrepancy`, `actionableStepsChecklist` (min 1 step).
6. **Eviction filter:** discard cards with `projectedLiftPercentage < 1.0`.
7. Per-card lift 0–100%; cumulative across cards ≤ 500%.
8. Persist to `BrandPerformanceLeak`; update `refreshedAt`.

**Outputs:** Tab 2 recommendation grid + drawer-ready JSON.

**v1 data note:** No live social pull; inputs are AI-inferred baselines from Event 2.

---

### REQ-EVT-004 — Event 4: Move to Campaign Planner

**Trigger:** User clicks Move to Campaign Planner on Tab 2 card (`POST /intelligence/leaks/:id/move-to-planner`).

**Must:**

1. Mark leak `plannerStatus = PUSHED_TO_PLANNER`.
2. Route card type:
   - `PAUSE_ACTIVE_BRIEF` → `AUTO_PAUSE_LOG`, `workflowStatus = AUTO_EXECUTED_BYPASS`
   - Existing match on `objective × creatorTier` → `SUGGESTED_UPDATE` + `existingTargetCampaignId`
   - Else → `NEW_CAMPAIGN`
3. Execute **Prompt 3** with brand DNA JSON, selected leak JSON, active campaigns matrix (v1: in-app planner cards).
4. Validate against `BrandPlannerMasterSchema`.
5. Persist `BrandPlannerCard`; link leak → card.
6. On logout / 30 min inactivity: archive leaks with `PUSHED_TO_PLANNER` or `DISCARDED` (`isArchived = true`).

**Tab 2 → Tab 3 field mapping:**

| Leak field | Planner field |
| --- | --- |
| `insightTitle` | Campaign / brief name |
| `shortDescription20Words` | Creative direction summary |
| `priorityRank` | P1 / priority badge |
| `leakBucket` | Team routing tag (PDP, PAID, etc.) |

---

## 3. Tab 1 — Brand DNA

### REQ-T1-001 — Profile (Section 1)

| Field | Editable | Validation |
| --- | --- | --- |
| Logo | Yes | Absolute URL |
| Brand name | Yes | Min 2 chars |
| Website | No | Set at onboarding |
| IG / YT / TikTok handles | Yes | Must start with `@`, min 2 chars |
| Country / currency | No* | Auto-mapped at onboarding |
| Industry > sub-industry > niche | No | From onboarding |
| Lifecycle stage | Yes | Default `GROWTH_STAGE` |

\*Currency rule: IN→INR, US→USD, else USD.

---

### REQ-T1-002 — Narrative (Section 2)

| Field | Rule |
| --- | --- |
| Tagline | 5–255 chars |
| Brief description | Min 20 chars |
| Brand USPs | **Exactly 3** |
| Tone of voice | Min 1 tag |
| Do-not-say list | Min 1 entry; healthcare auto-append from Prompt 1 |

---

### REQ-T1-003 — Identity matrix (Section 3)

| Field | Rule |
| --- | --- |
| Color palette | Min 1 hex (`#RGB` or `#RRGGBB`) |
| Fonts | Min 1 |
| Aesthetics | Min 1 tag |
| Personas | Min 1; each has geo, age windows, interests |
| Empty persona save | Discard; revert to last saved |

---

### REQ-T1-004 — Offerings Sections 4 & 5 (industry routing)

See REQ-RT-002. Universal rules:

- Add URL must match verified brand domain (no competitor domains).
- AI scan URL → preview image + name → user confirms before save.
- Primary offerings max **5**; groupings max **3**.
- Each entity: 3 selling points (USPs); optional do-not-say; drawer fields per routing template.
- Entity URLs must be http(s) on brand domain namespace.

---

### REQ-T1-005 — Offers ledger (Section 6)

| Field | Rule |
| --- | --- |
| Offer name | Min 2 chars, mandatory |
| Description | Mandatory |
| Promo code | `[A-Z0-9_-]{2,50}` uppercase |
| Applicability | Sitewide / product / collection |
| Validity | ISO datetime start/end |
| Uniqueness | Per brand: `(brandProfileId, promoCode)` unique |

---

### REQ-T1-006 — Competitors (Section 7)

- Max **3** active competitors.
- Add URL: must not be own domain; no 404.
- AI fetches name + logo on confirm.

---

### REQ-T1-007 — Budget Zone 2

#### Ceiling (Section 1)

| Rule | Detail |
| --- | --- |
| Display | Monthly budget + utilization % (booked + spent / total) |
| Edit floor | ₹50,000 INR / $1,000 USD (and equivalent policy for other currencies using USD floor) |
| Cannot go below | Already booked escrow commitments |
| Edit limit | Max **2** changes to `masterMonthlyBudget` per rolling **30 days** |
| Violation | HTTP 429 with explicit message |

#### Distribution mix (Section 2)

| Chart | Dimensions | Sum rule |
| --- | --- | --- |
| Asset mix | product, collection, sale | = 100 |
| Tier mix | nano, micro, midTier, mega, celebrity | = 100 |
| Objective mix | pulse, proof, push, production | = 100 |

- Mixes are **AI-calculated** at deep scan (Prompt 1); user can adjust via modal.
- Modal shows AI explanation text.
- Per-slot minimum when sliding: ₹30,000 / $500.
- Deficit guard: proposed slot amount ≥ booked commitments for that slot.

#### Budget phases

| Phase | When | Source |
| --- | --- | --- |
| `PHASE_1_COLD_START` | Event 1 | Routing cold-start template (+ optional light Gemini) |
| `PHASE_2_SELF_HEALING` | Event 2 | Prompt 1 `financials` |

---

### REQ-T1-008 — Account Zone 3 (placeholders v1)

Return read-only placeholders:

- Escrow status badge
- Subscription tier + outreach quota (used/total)
- Meta connection status badge
- Team invite link surface

No live integration webhooks in v1.

---

## 4. Industry routing

### REQ-RT-001 — Routing type enum

`D2C_SKINCARE` | `SAAS_PRODUCT` | `HEALTHCARE_TREATMENT` | `OFFLINE_EXPERIENCE`

**Map from `IndustryVertical`:**

| IndustryVertical | BrandRoutingType |
| --- | --- |
| D2C | D2C_SKINCARE |
| SAAS_AI | SAAS_PRODUCT |
| HEALTHCARE | HEALTHCARE_TREATMENT |
| OFFLINE_SERVICES | OFFLINE_EXPERIENCE |
| Other supported / unknown | D2C_SKINCARE (MVP fallback) |

---

### REQ-RT-002 — Section 4 & 5 template matrix

| Routing | Sec 4 header | Entity type | Max | Sec 5 header | Max |
| --- | --- | --- | --- | --- | --- |
| D2C_SKINCARE | Hero Products | PRODUCT | 5 | Key Collections | 3 |
| SAAS_PRODUCT | Core Platforms & Modules | MODULE | 5 | Subscription Plans & Tiers | 3 |
| HEALTHCARE_TREATMENT | Treatments & Programs | TREATMENT | 5 | Specialties & Departments | 3 |
| OFFLINE_EXPERIENCE | Experiences & Venues | EXPERIENCE | 5 | Locations & Properties | 3 |

Section 5 groupings stored as `OfferingType.COLLECTION` with routing-specific labels in API metadata.

**API must expose** routing template (section titles, limits, drawer field schema, compliance hints) on `GET /routing-template` and inside `GET /dna`.

---

## 5. Tab 2 — Intelligence & Gaps

### REQ-T2-001 — Dashboard metadata

- System status: ACTIVE
- Data refreshed timestamp
- Date range label: Last 30 Days

---

### REQ-T2-002 — Zone 1 baseline (from Prompt 1 + display enrichments)

**Growth impact matrix:**

- Total projected revenue lift % (0–500 cap on aggregate)
- Levers: PDP alignment, paid amplification, creator roster (each 0–100)
- Status indicator: GREEN | YELLOW | RED

**Baseline health:**

- reachMoMPercentage, engagementRateVsBenchmark, audienceOverlapPercentage (0–100)
- contentQualityScore (0–10)
- averageHookRate, brandSafetyScore (0–100)
- Archetype match: our brand + competitor average (everyman, expert, jester, rebel = 100 each)

**Share of voice:**

- ourBrandShare (0–100)
- competitorsShareMatrix (record, sum ≤ 100)
- competitorThemesLast30Days (min 1 string)

---

### REQ-T2-003 — Zone 2 leak cards (from Prompt 2)

| Field | Rule |
| --- | --- |
| insightTitle | Min 5 chars |
| shortDescription20Words | 10–150 chars |
| priorityRank | HIGH \| MEDIUM \| LOW \| NEGLIGIBLE |
| leakBucket | PDP \| PAID \| ROSTER \| CREATIVE_HOOK |
| performanceStatus | GREEN \| YELLOW \| RED |
| projectedLiftPercentage | 0–100; **≥ 1.0 to persist** |
| drawerDeepDive.underlyingDataLogic | Min 20 words |
| drawerDeepDive.competitiveDiscrepancy | Min 20 words |
| actionableStepsChecklist | Min 1 step with stepId, stepLabel, isCompleted |
| plannerStatus | PENDING_USER_REVIEW → PUSHED_TO_PLANNER → … |

**Archive:**

- Unresolved vs archived filters
- Archive retention: rolling 30 days
- Eviction on session end for moved/discarded cards

---

## 6. Tab 3 — Campaign Planner

### REQ-T3-001 — Aggregation rule

**Campaign Objective × Creator Tier = 1 unique campaign base.**

Creator tiers: NANO, MICRO, MID_TIER, MEGA, CELEBRITY  
Objectives: PULSE, PROOF, PUSH, PRODUCTION

---

### REQ-T3-002 — Card types

| Type | Badge | Behavior |
| --- | --- | --- |
| NEW_CAMPAIGN | Green | New objective×tier combination |
| SUGGESTED_UPDATE | Yellow | Match existing campaign; requires `existingTargetCampaignId` |
| AUTO_PAUSE_LOG | Red | Read-only; `AUTO_EXECUTED_BYPASS`; acknowledge to dismiss |

---

### REQ-T3-003 — Planner card payload (Prompt 3)

- `aggregationKey`: objective, targetCreatorTier, aiContextHook (min 5 chars)
- `campaignMetadata.audienceDemographics`: geo, gender, age, interests (each min 1)
- `operationalBudgetParameters`: min ≥ 500, max ≥ min
- `campaignArchitectureDeadline`: ISO datetime
- `assetsAndBriefsMatrix`: min 1 entity with min 1 production brief
- Each brief: deliverables (platform + quantity ≥ 1), operational checklists (landing URL, whitelisting flags, discount code)

---

### REQ-T3-004 — Approve & circuit breaker

On `POST /planner/cards/:id/approve`:

1. Compute `C_total = Σ(maxAllocationThreshold × deliverable quantity)` per brief.
2. `remainingFloat = masterMonthlyBudget - activeCommittedSpend`
3. If `C_total > remainingFloat` → reject (circuit breaker); v1 active spend = 0 unless campaigns module exists
4. Set `workflowStatus = PROCEEDED_TO_PIPELINE` — **no external campaigns call in v1**

---

## 7. API requirements

**Base:** `/api/v1/brand-centre`  
**Auth:** JWT, role BRAND, org-scoped to `BrandProfile`

### REQ-API-001 — Foundation

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/routing-template` | Active industry routing metadata |
| GET | `/scan-status` | Deep scan / intel job polling |
| POST | `/scan/retry` | Retry failed deep scan (dev/local) |

### REQ-API-002 — Tab 1

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/dna` | Full Tab 1 aggregate + completeness |
| PATCH | `/dna/profile` | Section 1 |
| PATCH | `/dna/narrative` | Section 2 |
| PATCH | `/dna/identity` | Section 3 visuals |
| GET/POST/PATCH/DELETE | `/dna/personas` | Persona carousel |
| GET | `/dna/offerings` | Primary vs collection |
| POST | `/dna/offerings/scan-url` | Domain-validated URL preview |
| POST/PATCH/DELETE | `/dna/offerings` | CRUD with routing limits |
| GET/POST/PATCH/DELETE | `/dna/offers` | Promo ledger |
| GET/POST/PATCH/DELETE | `/dna/competitors` | Max 3 |
| POST | `/dna/competitors/scan-url` | Competitor URL preview |
| GET | `/dna/budget` | Budget + phase + edit quota |
| PATCH | `/dna/budget/ceiling` | Monthly ceiling |
| PATCH | `/dna/budget/mixes` | Strategy mixes |
| GET | `/dna/account` | Placeholder account infra |

### REQ-API-003 — Tab 2

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/intelligence` | Baseline + leaks; may trigger refresh |
| POST | `/intelligence/refresh` | Enqueue Prompt 2 |
| GET | `/intelligence/leaks` | Filtered list |
| GET | `/intelligence/leaks/:id` | Drawer detail |
| PATCH | `/intelligence/leaks/:id` | Checklist, archive |
| POST | `/intelligence/leaks/:id/discard` | Discard |
| POST | `/intelligence/leaks/:id/move-to-planner` | Event 4 |

### REQ-API-004 — Tab 3

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/planner` | Dashboard by card type |
| GET | `/planner/cards/:id` | Drawer detail |
| PATCH | `/planner/cards/:id` | Discard / status |
| POST | `/planner/cards/:id/approve` | Circuit breaker + PROCEEDED_TO_PIPELINE |
| POST | `/planner/cards/:id/acknowledge` | Auto-pause dismiss |

---

## 8. Data & validation

### REQ-VAL-001 — Zod schemas (API + AI boundaries)

Implement from product validations:

- `BrandDNAMasterSchema` — Tab 1 + Prompt 1 output
- `BrandIntelligenceMasterSchema` — Tab 2 baseline + Prompt 2
- `BrandPlannerMasterSchema` — Tab 3 + Prompt 3

### REQ-VAL-002 — Server-side guardrails

| Guard | Enforcement |
| --- | --- |
| 30-day budget edit limit | Service + `BrandBudgetModificationLog` |
| Promo code tenant scope | DB unique `(brandProfileId, promoCode)` |
| Domain match on offerings | Service on create/update/scan-url |
| Competitor not own domain | Service |
| Mix sum = 100 | Zod + service |
| SUGGESTED_UPDATE requires campaign id | Zod refine |

---

## 9. Async jobs

### REQ-JOB-001 — Job types

`DEEP_SCAN` | `INTELLIGENCE_REFRESH` | `PLANNER_AGGREGATE`

### REQ-JOB-002 — Job lifecycle

Statuses: `QUEUED` → `RUNNING` → `COMPLETED` | `FAILED`

- Enqueue on verify, refresh, move-to-planner
- Local: in-process worker + optional cron recovery for stuck QUEUED
- Prod: same table; swap worker backend later

---

## 10. AI prompts

### REQ-AI-001 — Prompt 1 (deep scan)

Inputs: brand URL, routing type, country, currency, products JSON, competitors JSON, raw scrape text.  
Outputs: strategicDNA, audiencePersonas, baselineHealth, shareOfVoice, financials (mixes + budget).  
Compliance: healthcare term stripping.

### REQ-AI-002 — Prompt 2 (leaks)

Inputs: baseline metrics, SOV, strategy mix.  
Output: JSON array of leak cards with drawer payload.  
Filters: lift ≥ 1%, bucket assignment, traffic lights.

### REQ-AI-003 — Prompt 3 (planner)

Inputs: brand DNA, approved leak(s), active campaigns matrix.  
Output: single planner card object with aggregation key and briefs matrix.

---

## 11. Traceability

| Product doc | Covers |
| --- | --- |
| `BrandCentre-tab1.md` | REQ-T1-*, REQ-RT-*, REQ-T1-007 |
| `BrandCentre-tab2.md` | REQ-T2-* |
| `BrandCentre-tab3.md` | REQ-T3-* |
| `BrandCentre-deepScanLogic.md` | REQ-EVT-*, REQ-T1-007, REQ-T3-004 |
| `BrandCentre-developerDocument.md` | REQ-VAL-*, REQ-AI-*, REQ-EVT-* |
| `BrandCentre-validations.md` | REQ-VAL-001 |
| `BrandCentre-BE_Schema.md` | Schema reference (see SCHEMA_MIGRATION.md) |

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Initial requirements doc — consolidated from product-team-docs |
