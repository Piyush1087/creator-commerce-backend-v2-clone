# Discovery Backend Schema Reconciliation

**Status:** FROZEN — Discovery Steps 1–6 reconciled  
**Scope:** Discovery Workspace persistence boundary  
**Repository working views:** `backend/campaign_schema.prisma`, `backend/intelligence_schema.prisma`

## 1. Purpose

This artifact reconciles the frozen Discovery domain, orchestration/UI, runtime/lifecycle, validation/identity-resolution, and backend-schema decisions against the current Campaign and Intelligence Prisma working views.

It is a migration and implementation guide. It does **not** replace the production Prisma schema and must not invent production relations that have not been verified.

The Discovery persistence design must preserve the existing Campaign aggregate and must not duplicate Campaign, CampaignAsset, Brief, Campaign Page readiness, Meta capability, Outreach, Applicant, Collaboration, or Intelligence-engine state.

---

## 2. Existing schema baseline

The current `backend/campaign_schema.prisma` working view already owns:

- `UceCampaign`
- `UceCampaignStrategy`
- `UceCampaignTargeting`
- `UceCampaignCommercials`
- `UceCampaignAsset`
- `UceBrief`
- `UceBriefDeliverable`

Discovery extends this aggregate. It does not require structural changes to Strategy, Targeting, Commercials, CampaignAsset, Brief, or BriefDeliverable.

The current schema already defines `UceMediaPlatform`; Discovery must reuse it rather than create a Discovery-specific platform enum.

The current `backend/intelligence_schema.prisma` establishes a separate Intelligence persistence boundary and intentionally defers detailed Processor Execution and Intelligence State/History models until those objects are reconciled. Discovery must respect that boundary.

---

## 3. Canonical ownership boundary

### Campaign / Discovery owns

- the durable Campaign ↔ creator relationship;
- creator acquisition provenance within a Campaign;
- Discovery review state;
- the published creator recommendation projection required by Discovery and downstream Campaign workflows;
- Campaign recommendation-context identity/version;
- thin Campaign-facing recommendation-run state;
- recommendation score/band/rank/explanation history;
- lightweight CSV import audit state.

### Intelligence owns / will own

- Creator Marketplace API acquisition artifacts;
- L1 candidate universe;
- L2 base-AI qualification artifacts;
- L3 deep/vision evaluation artifacts;
- reusable candidate caches/pools;
- processor/model/API execution telemetry;
- tokens/costs/retries/errors;
- evidence and artifact lineage;
- cache TTL and invalidation mechanics;
- stage reuse policy across recommendation contexts.

### Derived; do not persist as Discovery state

- Discovery workspace visibility;
- Discovery readiness;
- `activeDiscovery`;
- Campaign execution readiness;
- Meta capability/connection projection;
- Outreach quota availability;
- Applicants/Collaborations workspace activation;
- Campaign Page hydration state.

---

## 4. Durable CampaignCreator identity

Introduce `UceCampaignCreator` as the durable Campaign ↔ creator bridge.

A CampaignCreator survives movement through Discovery and downstream Campaign lifecycle. Do not introduce separate `DiscoveryCreator`, `ApplicantCreator`, `OutreachCreator`, or `CollaborationCreator` identity models merely to represent workspace projections.

### Required semantic fields

```prisma
enum UceCampaignCreatorSource {
  META_MARKETPLACE
  MANUAL
}

enum UceCampaignCreatorIngestionMethod {
  MARKETPLACE_RECOMMENDATION
  MANUAL_SINGLE
  MANUAL_CSV
}

enum UceCampaignCreatorReviewState {
  PENDING_REVIEW
  REVIEWED
  REJECTED
}

model UceCampaignCreator {
  id         String @id @default(cuid())
  campaignId String @map("campaign_id")

  // Keep unresolved in this working view until the production Creator model is verified.
  creatorId String? @map("creator_id")

  platform               UceMediaPlatform
  socialHandle           String @map("social_handle")
  normalizedSocialHandle String @map("normalized_social_handle")
  email                  String?

  source          UceCampaignCreatorSource
  ingestionMethod UceCampaignCreatorIngestionMethod @map("ingestion_method")
  reviewState     UceCampaignCreatorReviewState @default(PENDING_REVIEW) @map("review_state")

  campaign        UceCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recommendations UceCampaignCreatorRecommendation[]

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([campaignId, platform, normalizedSocialHandle])
  @@index([campaignId, reviewState])
  @@index([campaignId, source])
  @@index([creatorId])
  @@map("uce_campaign_creators")
}
```

The exact production relation to canonical Creator must be added only after the production Creator model is inspected and verified.

---

## 5. Identity and ingestion rules

### 5.1 Campaign-level uniqueness

One creator may have at most one CampaignCreator identity per Campaign/platform/social identity.

Marketplace recommendation, manual single-add, CSV ingestion, later Marketplace resolution, and concurrent ingestion paths must converge on the same CampaignCreator.

The intended database guard is:

```prisma
@@unique([campaignId, platform, normalizedSocialHandle])
```

Production integration must verify database collation/normalization behavior before relying on this constraint alone.

### 5.2 Manual / CSV required fields

Manual single-add and CSV ingestion require at runtime:

- email; and
- social handle.

The social handle must pass a lightweight crawl/validation before CampaignCreator creation.

`email` remains nullable at the database level because a Marketplace-recommended creator may not expose an email during Discovery. Runtime validation is source/method-aware.

### 5.3 Social-handle normalization

Incoming Instagram identities must be normalized before comparison. Supported forms such as `@creator`, `creator`, and a supported Instagram profile URL must converge on the same normalized handle where resolvable.

The display handle and normalized comparison identity are separate concerns.

### 5.4 Acquisition source

`source` records how the creator first entered the Campaign and is immutable after successful creation.

- Marketplace first → `META_MARKETPLACE`
- Manual single/CSV first → `MANUAL`

Later Marketplace enrichment of a manually sourced creator must not rewrite `source`.

CSV is not a source. It is an ingestion method.

---

## 6. Review state

Persist only:

```text
PENDING_REVIEW
REVIEWED
REJECTED
```

Canonical transitions:

```text
PENDING_REVIEW → REVIEWED
PENDING_REVIEW → REJECTED
REVIEWED       → REJECTED
REJECTED       → REVIEWED   // Restore
```

Do not add `CONTACTED`, `APPLIED`, `COLLABORATING`, or similar downstream states to CampaignCreator review state.

Review state is a Discovery workflow aid. It is not itself a creator recommendation score, Outreach eligibility engine, or Application validity gate.

A valid Application from a Discovery-rejected creator remains valid. The historical Discovery rejection remains auditable; Applicants owns presentation of current-Campaign and cross-Campaign application/collaboration history.

---

## 7. Recommendation history must not be destructive

Do not store only the latest score/band/rank directly on CampaignCreator as canonical truth.

A creator may be evaluated under multiple Campaign recommendation contexts. Historical recommendation provenance must survive re-evaluation.

Introduce a recommendation-history model:

```prisma
enum UceRecommendationScoreBand {
  HIGH
  MEDIUM
  LOW
}

model UceCampaignCreatorRecommendation {
  id                      String @id @default(cuid())
  campaignCreatorId       String @map("campaign_creator_id")
  recommendationRunId     String @map("recommendation_run_id")
  recommendationContextId String @map("recommendation_context_id")

  score       Decimal @db.Decimal(5, 2)
  scoreBand   UceRecommendationScoreBand @map("score_band")
  rank        Int
  explanation String?

  evaluatedAt DateTime @default(now()) @map("evaluated_at")

  campaignCreator       UceCampaignCreator @relation(fields: [campaignCreatorId], references: [id], onDelete: Cascade)
  recommendationRun     UceCreatorRecommendationRun @relation(fields: [recommendationRunId], references: [id], onDelete: Restrict)
  recommendationContext UceCampaignRecommendationContext @relation(fields: [recommendationContextId], references: [id], onDelete: Restrict)

  @@index([campaignCreatorId, evaluatedAt])
  @@index([recommendationRunId])
  @@index([recommendationContextId])
  @@map("uce_campaign_creator_recommendations")
}
```

The numeric score is persisted internally for ranking/replenishment/audit. The Discovery UI displays only the canonical `HIGH | MEDIUM | LOW` score band. Discovery does not independently derive band thresholds.

`rank` is persisted independently of score so Intelligence-owned ordering/tie-breaking is not reconstructed downstream.

---

## 8. Campaign Recommendation Context

The current Campaign working view has no generic Campaign snapshot/version primitive that can safely be reused for creator recommendation context.

`UceCampaign.aiRecommendationId` and `aiRecommendationVersion` describe AI Campaign recommendation provenance and must **not** be reused as creator-recommendation context versioning. Manual Campaigns also require creator recommendation contexts.

Introduce a small first-class context identity:

```prisma
model UceCampaignRecommendationContext {
  id         String @id @default(cuid())
  campaignId String @map("campaign_id")

  version     Int
  contextHash String? @map("context_hash")

  campaign        UceCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  runs            UceCreatorRecommendationRun[]
  recommendations UceCampaignCreatorRecommendation[]

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([campaignId, version])
  @@index([campaignId])
  @@map("uce_campaign_recommendation_contexts")
}
```

Do not duplicate the Campaign strategy/targeting/commercial object into this model yet.

A material recommendation-relevant Campaign change creates a new recommendation-context identity/version. Old recommendation scores remain valid historical records and must not silently be represented as if calculated against the newer context.

Exactly which Campaign fields constitute recommendation context, how a context snapshot is serialized/referenced, and which L1/L2/L3 artifacts remain reusable across context versions are deferred to Intelligence reconciliation.

---

## 9. Thin Campaign-facing Recommendation Run

Discovery supports:

- initial recommendation; and
- demand-driven incremental replenishment.

Do not model recommendation as a single immutable Day-0 pool and do not assume a mandatory daily refresh.

Introduce a thin Campaign-facing run object:

```prisma
enum UceCreatorRecommendationRunType {
  INITIAL
  REPLENISHMENT
}

enum UceCreatorRecommendationRunStatus {
  RUNNING
  SUCCEEDED
  FAILED
}

model UceCreatorRecommendationRun {
  id                      String @id @default(cuid())
  campaignId              String @map("campaign_id")
  recommendationContextId String @map("recommendation_context_id")

  type   UceCreatorRecommendationRunType
  status UceCreatorRecommendationRunStatus

  startedAt   DateTime @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  campaign              UceCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recommendationContext UceCampaignRecommendationContext @relation(fields: [recommendationContextId], references: [id], onDelete: Restrict)
  recommendations       UceCampaignCreatorRecommendation[]

  @@index([campaignId, status])
  @@index([recommendationContextId])
  @@map("uce_creator_recommendation_runs")
}
```

`NOT_STARTED` is derived from the absence of an applicable run; do not persist a placeholder run solely to represent it.

This model is intentionally thin. Detailed processor/API/model/L1/L2/L3 execution belongs to the Intelligence persistence boundary. The Campaign-facing run may later reference Intelligence execution provenance once the generic Processor Execution model is frozen.

---

## 10. Demand-driven staged replenishment boundary

Discovery owns the published recommendation inventory/projection, not the upstream candidate machinery.

Conceptual Intelligence stages remain:

```text
L1 — Marketplace candidate acquisition / broad candidate universe
L2 — base AI qualification / smaller qualified pool
L3 — deep media/vision evaluation / final Recommendation Score
```

A replenishment event should use the deepest valid reusable Intelligence stage available before repeating more expensive upstream work.

The Campaign schema must **not** add L1/L2/L3 candidate/cache tables at this stage.

Replenishment may eventually consider:

- usable creator quantity;
- remaining recommendation quality;
- Campaign urgency;
- fixed-date deadline proximity;
- evergreen steady-state demand.

Exact thresholds, buffer sizes, deadline curves, run frequency, cross-Campaign capacity allocation, cache TTLs, and storage destinations are intentionally deferred.

---

## 11. CSV import audit object

Manual single-entry and CSV are one manual acquisition source but different ingestion methods.

A lightweight persisted CSV import object is permitted for idempotency/audit/counts:

```prisma
enum UceCampaignCreatorImportStatus {
  PENDING
  VALIDATED
  IMPORTING
  COMPLETED
  FAILED
}

model UceCampaignCreatorImport {
  id         String @id @default(cuid())
  campaignId String @map("campaign_id")

  status UceCampaignCreatorImportStatus

  totalRows     Int @default(0) @map("total_rows")
  validRows     Int @default(0) @map("valid_rows")
  importedRows  Int @default(0) @map("imported_rows")
  invalidRows   Int @default(0) @map("invalid_rows")
  duplicateRows Int @default(0) @map("duplicate_rows")

  campaign UceCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now()) @map("created_at")
  completedAt DateTime? @map("completed_at")

  @@index([campaignId, status])
  @@map("uce_campaign_creator_imports")
}
```

Do not persist every invalid CSV row, mapping step, or preview row in the Campaign schema unless a later audit/product requirement proves it necessary.

CSV flow remains:

```text
UPLOAD → MAP → VALIDATE → PREVIEW → CONFIRM → IMPORT
```

Partial import of valid rows is allowed. Duplicate/invalid rows do not block valid rows.

---

## 12. `UceCampaign` relation additions

The Campaign working view should eventually add relations equivalent to:

```prisma
creators               UceCampaignCreator[]
recommendationContexts UceCampaignRecommendationContext[]
recommendationRuns     UceCreatorRecommendationRun[]
creatorImports         UceCampaignCreatorImport[]
```

These are additive Discovery relations and must not alter the semantics of existing Strategy, Targeting, Commercials, Asset, Brief, or Deliverable relations.

---

## 13. No persisted Discovery lifecycle state

Do not add fields such as:

```text
campaign.discoveryState
campaign.discoveryReady
campaign.hasDiscovery
campaign.activeDiscovery
campaignCreator.isActiveInDiscovery
```

Recommendation runtime and operational availability are derived from existing Campaign lifecycle/readiness, Meta capability, recommendation runs, creator state, and downstream objects.

Campaign Pause, Meta disconnection, Outreach quota exhaustion, readiness loss, and recommendation failure are non-destructive to persisted CampaignCreator/recommendation history.

---

## 14. Application boundary

Do not invent a required Application relation in this working view until the production Application model is verified.

Discovery semantics require:

- a valid Application does not require CampaignCreator to be `REVIEWED`;
- a Discovery-rejected creator may still submit a valid Application if they legitimately have Campaign access;
- Application submission moves the creator out of the active Discovery projection without deleting CampaignCreator or rewriting review history;
- Applicants owns current-Campaign and cross-Campaign application/collaboration history presentation;
- a valid applicant should not require fabrication of a Discovery record solely to satisfy a foreign key.

Any future CampaignCreator ↔ Application relation must preserve these invariants.

---

## 15. Lightweight social-handle validation

Manual and CSV creator ingestion require both email and social handle.

The social handle must be validated using a lightweight crawl before CampaignCreator creation.

Do not introduce a Campaign-domain `SocialHandleValidationRun` for MVP. If validation evidence/execution telemetry later needs persistence, reconcile it with the Intelligence Processor Execution / evidence architecture rather than duplicating it in Campaign persistence.

---

## 16. Campaign Page persistence-boundary amendment

The current Campaign working view states that Campaign Page-derived Intelligence output is not persisted. Discovery introduces a narrow intentional exception.

The canonical interpretation becomes:

> Campaign Page readiness/hydration/reporting/Intelligence projections remain derived and are not persisted merely for page rendering. Discovery may persist the **published creator recommendation projection and provenance** required for CampaignCreator lifecycle, ranking, replenishment, auditability, Outreach and downstream Campaign workflows.

Raw L1/L2/L3 Intelligence artifacts remain outside Campaign persistence.

---

## 17. Runtime and validation requirements not expressible by Prisma alone

Service/domain validation remains authoritative for:

- Manual/CSV email + social-handle requirement;
- lightweight social-handle crawl success;
- source-aware email nullability;
- social-handle normalization;
- identity conflict resolution;
- cross-source deduplication/concurrency;
- first-acquisition source immutability;
- CampaignCreator review-state transitions;
- Campaign lifecycle/readiness operation checks;
- Meta requirement for Marketplace-dependent acquisition;
- recommendation payload/provenance validation;
- recommendation score range;
- canonical score-band ownership by Intelligence;
- context-aware recommendation deduplication;
- idempotent recommendation ingestion;
- idempotent CSV confirmation/import;
- idempotent manual-add retries;
- atomic logical publication of successful recommendation results.

Database constraints should reinforce, not replace, these domain rules.

---

## 18. Production merge requirements

Before production migration, the developer must:

1. inspect the authoritative production Creator model and reconcile `creatorId` plus optional relation without inventing a parallel Creator identity;
2. verify PostgreSQL normalization/collation behavior for `normalizedSocialHandle` uniqueness;
3. add the Discovery relations to the production Campaign aggregate using actual production model names;
4. verify whether an existing generic import/audit primitive should replace `UceCampaignCreatorImport`;
5. verify the production Application model before adding any CampaignCreator/Application relation;
6. preserve existing Campaign/Product/Brief migrations and constraints;
7. reconcile future Intelligence Processor Execution references without moving L1/L2/L3 artifacts into Campaign persistence;
8. implement service-level source-aware and lifecycle-aware validation;
9. create reviewed migrations only after the merged production schema passes Prisma validation and migration review.

---

## 19. Explicitly deferred

The following are **not** resolved by this artifact:

- exact creator recommendation score formula;
- HIGH/MEDIUM/LOW thresholds;
- exact L1/L2/L3 contracts;
- storage destination for reusable L1/L2/L3 artifacts;
- cache TTL/invalidation;
- exact replenishment inventory threshold;
- exact days-of-buffer;
- fixed-date deadline urgency curve;
- cross-Campaign Intelligence/API capacity scheduler;
- treatment of unused old-context candidates: discard vs rescore vs retain-as-stale;
- which upstream artifacts survive a recommendation-context version change;
- exact Campaign recommendation-context snapshot representation;
- canonical Creator production relation;
- Applicants persistence schema;
- Outreach persistence/schema and quota engine;
- Collaboration persistence/schema.

These deferrals are intentional and must not be filled by ad-hoc Campaign-schema fields.

---

## 20. Frozen schema invariants

- **DISC-SCHEMA-01** — `UceCampaignCreator` is the durable Campaign ↔ creator bridge across Discovery and downstream lifecycle.
- **DISC-SCHEMA-02** — Do not create separate creator identity models for Discovery, Applicants, Outreach, or Collaborations.
- **DISC-SCHEMA-03** — `creatorId` remains nullable/unresolved in the working view until the production Creator model is verified.
- **DISC-SCHEMA-04** — Reuse `UceMediaPlatform`; do not create a Discovery-specific platform enum.
- **DISC-SCHEMA-05** — Manual/CSV ingestion requires email + social handle at runtime; Marketplace email may remain unavailable.
- **DISC-SCHEMA-06** — Manual/CSV social handles require lightweight crawl validation before CampaignCreator creation.
- **DISC-SCHEMA-07** — `source = META_MARKETPLACE | MANUAL` and records first successful Campaign acquisition.
- **DISC-SCHEMA-08** — CSV is an ingestion method, not an acquisition source.
- **DISC-SCHEMA-09** — Review state is limited to `PENDING_REVIEW | REVIEWED | REJECTED`.
- **DISC-SCHEMA-10** — Campaign + platform + normalized social identity is semantically unique.
- **DISC-SCHEMA-11** — Email is not the primary CampaignCreator uniqueness key.
- **DISC-SCHEMA-12** — Recommendation history is separate from CampaignCreator and is not destructively overwritten.
- **DISC-SCHEMA-13** — Numeric Recommendation Score persists internally; UI exposes only the canonical score band.
- **DISC-SCHEMA-14** — Recommendation band is authoritative Intelligence output.
- **DISC-SCHEMA-15** — Recommendation rank persists independently of numeric score.
- **DISC-SCHEMA-16** — Recommendation explanation/provenance is tied to the evaluation that produced it.
- **DISC-SCHEMA-17** — Campaign Recommendation Context is distinct from AI Campaign recommendation versioning.
- **DISC-SCHEMA-18** — Material recommendation-relevant Campaign changes create a new recommendation-context identity/version.
- **DISC-SCHEMA-19** — Historical scores must not silently be represented as scores for a newer context.
- **DISC-SCHEMA-20** — Recommendation runs support `INITIAL | REPLENISHMENT`.
- **DISC-SCHEMA-21** — Persisted run status is `RUNNING | SUCCEEDED | FAILED`; `NOT_STARTED` is derived from absence of an applicable run.
- **DISC-SCHEMA-22** — Campaign-facing Recommendation Run remains thin; detailed execution telemetry belongs to Intelligence.
- **DISC-SCHEMA-23** — Discovery uses rolling, demand-driven recommendation inventory rather than a mandatory giant Day-0 pool or mandatory daily refresh.
- **DISC-SCHEMA-24** — L1/L2/L3 intermediate artifacts/caches are not Campaign-owned persistence.
- **DISC-SCHEMA-25** — Replenishment should reuse the deepest valid Intelligence stage available before repeating upstream work.
- **DISC-SCHEMA-26** — Lightweight CSV import audit persistence is allowed; invalid/preview rows need not become Campaign-domain records.
- **DISC-SCHEMA-27** — No persisted `activeDiscovery` flag is introduced.
- **DISC-SCHEMA-28** — No duplicate persisted Campaign Discovery lifecycle/readiness enum is introduced.
- **DISC-SCHEMA-29** — Campaign Pause, Meta disconnection, quota exhaustion, readiness loss and recommendation failure do not delete Discovery creator/recommendation history.
- **DISC-SCHEMA-30** — Application integration must preserve valid application behavior independently of Discovery review state.
- **DISC-SCHEMA-31** — Campaign Page-derived Intelligence remains non-persistent except for the narrow published Discovery recommendation projection required by Campaign business lifecycle.
- **DISC-SCHEMA-32** — Production relations must be reconciled against verified production models; the working view must not guess them.

---

## 21. Implementation sequence

Recommended implementation order after this artifact is accepted:

1. patch `backend/campaign_schema.prisma` with the reconciled Discovery enums/models/relations and persistence-boundary comment amendment;
2. validate model/relation consistency in the working view;
3. write/update Discovery runtime/domain validation schemas/contracts against these persistence names;
4. keep L1/L2/L3 storage untouched until Intelligence architecture reconciliation;
5. later reconcile the working view against the authoritative production Prisma schema and create reviewed migrations.

**Frozen conclusion:** Discovery is an additive Campaign-domain extension. Campaign owns the durable CampaignCreator relationship and published recommendation history/provenance; Intelligence owns acquisition/evaluation machinery and reusable upstream artifacts. Derived workspace/readiness/availability state remains outside persistence.