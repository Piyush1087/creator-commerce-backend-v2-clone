# Brand Centre — schema migration

**Status:** Implement per [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) slices  
**Requirements:** [REQUIREMENTS.md](./REQUIREMENTS.md)  
**Product SQL reference:** `product-team-docs/BrandCentre-BE_Schema.md` (truncated — fill gaps from requirements)

---

## Tenancy model

```
Organization 1──1 BrandProfile
User N──1 Organization (JWT carries organizationId)
BrandProfile 1──N child tables (FK brandProfileId)
```

Product `brand_id` → `brandProfileId`.  
Product `brand_users` → existing `User` + `Organization` (no separate password table).

---

## Enums

```prisma
enum BrandRoutingType {
  D2C_SKINCARE
  SAAS_PRODUCT
  HEALTHCARE_TREATMENT
  OFFLINE_EXPERIENCE
}

enum BudgetAllocationPhase {
  PHASE_1_COLD_START      // REQ-EVT-001
  PHASE_2_SELF_HEALING    // REQ-EVT-002
}

enum BrandCentreJobType {
  DEEP_SCAN
  INTELLIGENCE_REFRESH
  PLANNER_AGGREGATE
}

enum BrandCentreJobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
}

enum PerformanceColor { GREEN YELLOW RED }
enum LeakBucket { PDP PAID ROSTER CREATIVE_HOOK }
enum PriorityRank { HIGH MEDIUM LOW NEGLIGIBLE }
enum PlannerCardType { NEW_CAMPAIGN SUGGESTED_UPDATE AUTO_PAUSE_LOG }
enum CampaignObjective { PULSE PROOF PUSH PRODUCTION }
enum CreatorTier { NANO MICRO MID_TIER MEGA CELEBRITY }
enum PlannerWorkflowStatus {
  PENDING_USER_REVIEW
  PROCEEDED_TO_PIPELINE
  DISCARDED
  AUTO_EXECUTED_BYPASS
}
enum LeakPlannerStatus {
  PENDING_USER_REVIEW
  PUSHED_TO_PLANNER
  DISCARDED
  EXECUTED
}
```

Extend existing `OfferingType` if needed: `PRODUCT`, `MODULE`, `TREATMENT`, `EXPERIENCE`, `COLLECTION`.

---

## Extend `BrandProfile`

| Product field | Prisma field | REQ |
| --- | --- | --- |
| brand_routing_type | `brandRoutingType BrandRoutingType` | REQ-RT-001 |
| lifecycle_stage | `lifecycleStage String @default("GROWTH_STAGE")` | REQ-T1-001 |
| strategic DNA blob | `strategicDna Json?` — narrative, visuals, compliance | REQ-T1-002, REQ-T1-003 |
| ig/yt/tiktok handles | `igHandle`, `ytHandle`, `tiktokHandle String?` | REQ-T1-001 |
| deep scan audit | `deepScanCompletedAt DateTime?` | REQ-EVT-002 |

**Keep existing:** `domain`, `name`, `industry`, `subIndustry`, `industryNiche`, `countryCode`, `currencyCode`, `logoUrl`, `tagline`, `description`, `visualIdentity`, `policyFlags`, `brandValues`, `targetAudience`, `scanStatus`, `deepIntelStatus`, `isVerified`, `isUserEdited`.

**`strategicDna` JSON shape:**

```json
{
  "narrative": { "toneOfVoice": [], "brandUsps": [] },
  "visuals": { "palette": [], "fonts": [], "aesthetics": [] },
  "complianceGuardrails": { "doNotSayList": [] }
}
```

---

## Extend `Offering`

| Field | Type | REQ |
| --- | --- | --- |
| `sellingPoints` | `String[] @default([])` | REQ-T1-004 |
| `doNotSay` | `String[] @default([])` | REQ-T1-004 |
| `isDeepScanned` | exists | REQ-EVT-002 |

Primary vs collection: `type` = PRODUCT|MODULE|TREATMENT|EXPERIENCE vs COLLECTION.

---

## Tab 1 tables

### `BrandAudiencePersona`

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK | |
| personaName | String | REQ-T1-003 |
| demographicsJson | Json | geo, ageWindows, explicitInterests |
| psychographicsText | String? | |
| sortOrder | Int @default(0) | |
| isUserEdited | Boolean @default(false) | |

### `BrandOffer`

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK | |
| offerName | String | REQ-T1-005 |
| promoCode | String | REQ-T1-005 |
| applicabilityScope | String | |
| validityStart | DateTime | |
| validityEnd | DateTime | |
| description | String? | |
| entityLink | String? | product/collection link |
| termsText | String? | |
| isActive | Boolean @default(true) | |

`@@unique([brandProfileId, promoCode])` — REQ-VAL-002

### `BrandBudgetConfiguration`

1:1 with `BrandProfile`.

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK @unique | |
| masterMonthlyBudget | Decimal | REQ-T1-007 |
| allocationPhase | BudgetAllocationPhase | REQ-T1-007 |
| assetMix | Json | product, collection, sale |
| tierMix | Json | nano…celebrity |
| objectiveMix | Json | pulse…production |
| utilizedBooked | Decimal @default(0) | |
| utilizedSpent | Decimal @default(0) | |
| aiExplanationText | String? | REQ-T1-007 modal |
| createdAt / updatedAt | DateTime | |

**Phase behaviour:**

- Event 1: insert `PHASE_1_COLD_START` from `budget-cold-start-templates.ts`
- Event 2: Prompt 1 overwrites ceiling + mixes → `PHASE_2_SELF_HEALING`

### `BrandBudgetModificationLog`

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK | |
| oldBudget | Decimal | |
| newBudget | Decimal | |
| modifiedAt | DateTime | |

Enforces REQ-T1-007 30-day / 2-edit limit in service (product also describes DB trigger — implement in service first; optional SQL trigger later).

---

## Jobs

### `BrandCentreJob`

| Column | Type |
| --- | --- |
| id | UUID PK |
| brandProfileId | FK |
| type | BrandCentreJobType |
| status | BrandCentreJobStatus |
| payload | Json? |
| attempt | Int @default(0) |
| errorMessage | String? |
| queuedAt | DateTime |
| startedAt | DateTime? |
| finishedAt | DateTime? |

Service rule: one active `QUEUED|RUNNING` per `(brandProfileId, type)` optional.

---

## Tab 2 tables

### `BrandIntelligenceBaseline`

1:1 with profile.

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK @unique | |
| growthImpactMatrix | Json | REQ-T2-002 |
| baselineHealth | Json | REQ-T2-002 |
| shareOfVoice | Json | REQ-T2-002 |
| source | String @default("ai_inferred") | REQ-SCOPE-003 |
| refreshedAt | DateTime? | REQ-T2-001 |

### `BrandPerformanceLeak`

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK | |
| insightTitle | String | REQ-T2-003 |
| shortDescription | String | |
| priorityRank | PriorityRank | |
| leakBucket | LeakBucket | |
| performanceStatus | PerformanceColor | |
| projectedLiftPercentage | Decimal | ≥ 1.0 to persist |
| drawerDeepDive | Json | REQ-T2-003 |
| plannerStatus | LeakPlannerStatus @default(PENDING_USER_REVIEW) | |
| plannerCardId | String? FK → BrandPlannerCard | |
| isArchived | Boolean @default(false) | |
| archivedAt | DateTime? | |
| movedByUserId | String? | |
| createdAt | DateTime | |

Index: `(brandProfileId, isArchived, priorityRank)`.

---

## Tab 3 tables

### `BrandPlannerCard`

| Column | Type | REQ |
| --- | --- | --- |
| id | UUID PK | |
| brandProfileId | FK | |
| cardType | PlannerCardType | REQ-T3-002 |
| aggregationKey | Json | objective, targetCreatorTier, aiContextHook |
| existingTargetCampaignId | String? UUID nullable | REQ-T3-002; no FK to campaigns v1 |
| campaignMetadata | Json | REQ-T3-003 |
| assetsAndBriefsMatrix | Json | REQ-T3-003 |
| workflowStatus | PlannerWorkflowStatus | |
| sourceLeakId | String? FK → BrandPerformanceLeak | |
| createdAt / updatedAt | DateTime | |

---

## Config modules (no tables)

| Module | REQ |
| --- | --- |
| `industry-routing-templates.ts` | REQ-RT-002 |
| `map-industry-vertical.ts` | REQ-RT-001 |
| `budget-cold-start-templates.ts` | REQ-EVT-001 |

---

## Schema-only placeholders (no v1 APIs)

### `BrandSocialConnection` (optional future)

`platform`, `status`, `metadata` Json — Meta/IG badges in Tab 1 Zone 3.

---

## Migration waves

| Wave | Slice | Tables |
| --- | --- | --- |
| 1 | Foundation | `BrandProfile` extend, `BrandCentreJob`, enums |
| 2 | Event 1 + Tab 1 read | `BrandBudgetConfiguration`, personas, offers, budget log, `Offering` extend |
| 3 | Event 2 | `BrandIntelligenceBaseline` |
| 4 | Tab 2 | `BrandPerformanceLeak` |
| 5 | Tab 3 | `BrandPlannerCard` |

Can combine into one migration before coding if preferred.

---

## Product → Prisma mapping reference

| Product table | Our model |
| --- | --- |
| brands | BrandProfile (+ Organization) |
| brand_users | User |
| brand_audience_personas | BrandAudiencePersona |
| brand_offers / offers ledger | BrandOffer |
| tab1_budget_configurations | BrandBudgetConfiguration |
| tab1_budget_modification_logs | BrandBudgetModificationLog |
| inventory entities | Offering |
| competitors | Competitor (existing) |
| tab2 baseline | BrandIntelligenceBaseline |
| tab2_performance_leaks | BrandPerformanceLeak |
| planner drafts | BrandPlannerCard |
| campaigns_execution | **Deferred** — REQ-SCOPE-005 |

---

## Backfill

Optional script: existing `SURFACE_COMPLETE` profiles without budget row → run cold-start seed.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Redo: aligned to REQUIREMENTS.md; two-phase budget; REQ traceability |
