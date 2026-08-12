# Creator Shop Consolidated PostgreSQL / Prisma Schema Handoff

Status: PRE-PRODUCTION CONSOLIDATION AUTHORITY
Branch: `feature/consolidated-schema-preprod`
Baseline: `feature/campaign-phase-1-3-be` @ `7533af6373fac9093d7c9d083f4f669545e9f7d2`

## Purpose

This branch is the integration target for the canonical Brand Centre, Campaign and Collaboration persistence contracts that were developed in isolation in `Piyush1087/dummy_tcs`.

The goal is to make this backend clone the executable pre-production persistence authority used for Campaign, Collaboration and later module runtime testing. It is **not** an instruction to apply generated migrations directly to production.

The production developer must independently inspect production data, runtime consumers, backfill quality and financial records before migrating the production database.

## Authority model

- `dummy_tcs` canonical module schemas/contracts = semantic/design authority.
- this backend clone `prisma/schema.prisma` after consolidation = executable pre-production persistence authority.
- production backend/database = final deployment target after independent developer migration review.

Where an isolated working schema left an integration detail unresolved but production already has a valid concrete relation, preserve the production relation. Example: retain `UceCampaignCreator.creatorProfileId -> CreatorProfile` rather than replacing it with an unresolved generic creator ID.

## Frozen relational spine

```text
BrandProfile
    -> UceCampaign
        -> UceCampaignAsset
            -> UceBrief
                -> UceBriefDeliverable
        -> UceCampaignCreator
        -> UceApplication
            -> Collaboration
```

`UceCampaignCreator` remains the Campaign-scoped creator identity. `CreatorProfile` remains cross-Campaign creator identity. `User` remains the authenticated execution actor.

## Cross-module ownership

- Brand identity, country, industry, Offerings and Brand Offers: Brand Centre.
- Campaign strategy, targeting, commercial policy, Campaign asset selection, discovery/applications/share/report publication projection: Campaign.
- Application decision and immutable application-time snapshot: Campaign/Application.
- Collaboration creation identity: approved `UceApplication`.
- Collaboration workflow, immutable execution snapshot, creator-specific commercial agreement, fulfillment, deliverable execution, publishing execution, financial entitlement/resolution, settlement state, feedback, messages and events: Collaboration.
- Money movement and banking details: Escrow/Payout/Settings, not Collaboration.
- AI reasoning/raw intelligence execution: Intelligence Platform; Campaign/Collaboration persist only accepted/published projections and provenance where required.

## Migration philosophy

Use an expand -> backfill -> cutover -> contract approach.

1. Add canonical fields/enums without deleting legacy fields.
2. Create canonical destination tables.
3. Backfill and establish explicit lineage mappings.
4. Move runtime reads/writes to canonical structures.
5. Enforce final constraints only after data is healthy.
6. Retire legacy structures in a later migration/release.

Do not rewrite historic rows merely for aesthetic schema purity. Preserve evidence when historical data cannot be deterministically normalized.

---

# Campaign reconciliation

## Keep / alter in place

### `UceCampaign`
Keep existing table identity and Brand relation. Add/align:

- `creationSource`: `MANUAL | AI_RECOMMENDED`
- `aiRecommendationId?`
- `aiRecommendationVersion?`
- `publishedAt?`
- `liveAt?`
- `completedAt?`
- `archivedAt?`

Keep lifecycle values: `DRAFT, PUBLISHED, LIVE, PAUSED, COMPLETED, ARCHIVED`.

### `UceCampaignStrategy`
Evolve in place from legacy timeline/deliverables semantics to:

- `publishingSchedule`: `EVERGREEN | SCHEDULED`
- `publishFrom?`
- `publishUntil?`
- canonical `CampaignObjective`: `PULSE | PROOF | PRODUCTION | PUSH`
- `primaryKpiId`
- `supportingKpiIds[]`
- `platforms[]`
- one `visibilityScope`

Legacy `dynamicDaysLimit` is not canonical Create Campaign state. Legacy `platformDeliverables` moves to Brief/Deliverables.

Do not invent semantic mappings for old Campaign objectives if actual production history cannot be mapped confidently. Historical rows may require compatibility/manual review.

### `UceCampaignTargeting`
Evolve to:

- `creatorArchetypes[]`
- `minimumFollowers`
- `maximumFollowers?`
- `audienceAgeMin`
- `audienceAgeMax`
- enum `audienceGender`: `ALL | FEMALE | MALE`
- `audienceAffinityIds[]`
- structured `audienceGeographies` JSON validated by service/runtime contract

Retire as canonical Campaign-owned fields:

- `followerTiers`
- free-form `targetLocations`
- Campaign-owned `industryVertical`
- targeting-owned `visibilityScopes`
- legacy Create-Campaign `disqualifyingKeywords`
- legacy `applicationScope`

Do not claim historic free-form location strings are provider-normalized geography unless actually normalized.

### `UceCampaignCommercials`
Evolve to:

- `receivesBrandSupport`
- `brandSupportType?`: `PRODUCT | SERVICE | EXPERIENCE | ACCESS_SUBSCRIPTION | OTHER`
- `brandSupportEstimatedValue?`
- `compensationType`: `FIXED_FEE | NEGOTIABLE`
- `commercialOffer`
- `totalCampaignBudget`
- `advancePaymentPercentage`
- `payoutTerms`
- `currency` (derived from Brand country at Campaign boundary and persisted)

Legacy `fixedFeeAmount`, `negotiableMinFee`, `negotiableMaxFee` are not three canonical fields. `commercialOffer` is the fixed payout for FIXED_FEE or starting/minimum advertised payout for NEGOTIABLE. There is no Campaign-level maximum negotiated payout field.

New Campaign default advance percentage is 0, but historic 30% rows must preserve their historic value.

`UcePayoutTerms` must support `NET_45` and `NET_60`; `IMMEDIATE` may remain for compatibility but is not valid Create Campaign input.

## New canonical Campaign structures

Create:

- `UceCampaignAsset`
- `UceBrief`
- `UceBriefDeliverable`
- `UceCampaignRecommendationContext`
- `UceCreatorRecommendationRun`
- `UceCampaignCreatorRecommendation`
- `UceCampaignCreatorImport`
- `UceOutreach`
- `UceOutreachAttempt`
- `UceOutreachTrackingEvent`
- `UceApplicantIntelligence`
- `UceCampaignReport`
- `UceCampaignReportCalculation`

### Campaign Asset

`UceCampaignAsset` is a Campaign-owned selection/reference to exactly one Brand Centre entity:

- BRAND -> `brandProfileId`
- OFFERING -> `offeringId`
- OFFER -> `brandOfferId`

Enforce the exactly-one-reference + kind consistency using a PostgreSQL CHECK in the eventual migration. Prisma model uniqueness alone is insufficient.

Do not treat legacy `UceCampaignProduct` as a simple rename; its semantics duplicate product data. Create canonical assets, backfill mappings, switch references, then retire the old model later.

### Brief

Canonical Brief belongs to one `UceCampaignAsset`; it does not need a second authoritative `campaignId`.

Use explicit lifecycle `DRAFT | PUBLISHED | PAUSED`, creation source, Brief metadata and normalized `UceBriefDeliverable[]`.

Deliverable definitions are first-class rows. Do not keep Campaign Strategy `platformDeliverables` as canonical execution obligations.

### Campaign Creator

Keep production `creatorProfileId -> CreatorProfile`. Preserve Campaign/platform/normalized-handle uniqueness. Add canonical recommendation/outreach relations rather than replacing Creator identity.

### Application

Keep Application identity, request replay protection, lifecycle, supersession and immutable snapshot. Retarget canonical references from legacy Product/Brief to `UceCampaignAsset` / `UceBrief`.

Enforce ancestry transactionally:

- Application CampaignCreator belongs to Application Campaign.
- Application CampaignAsset belongs to Application Campaign.
- Application Brief belongs to Application CampaignAsset.

Add `UceApplicantIntelligence` as a thin published decision-facing projection. Intelligence readiness must not gate Approve/Reject.

### Reporting

Campaign-facing Reporting authority becomes `UceCampaignReport` + append-oriented `UceCampaignReportCalculation[]` with explicit `latestCalculationId` publication pointer.

Do not destroy legacy reporting evidence immediately. Old snapshots/timeseries/gallery may remain transitional evidence or move to Intelligence/Reporting ownership, but must stop being the canonical Brand-facing report once the new publication model is active.

---

# Collaboration reconciliation

## Aggregate root

Keep the existing `collaborations` table identity where safely possible, but evolve its semantics substantially.

Canonical root fields include:

- `sourceApplicationId` (creation/idempotency identity; eventually UNIQUE and required for new canonical rows)
- `campaignId`
- `campaignCreatorId`
- `campaignAssetId`
- `briefId`
- `brandProfileId`
- `creatorUserId`
- `lifecycle`: `ACTIVE | PAUSED | COMPLETED | CANCELLED | TERMINATED`
- `currentStage`: `NEGOTIATION | SECUREMENT | FULFILLMENT | PRODUCTION | PUBLISHING_SETTLEMENT`
- `currentStageStatus`: `NOT_STARTED | IN_PROGRESS | BLOCKED | COMPLETED | SKIPPED`
- `aggregateVersion`
- terminal provenance (`endedFromStage`, reason, actor, endedAt, completedAt)
- inbox/read cache fields may remain projections only

Do not persist `isPaused` / `isTerminated` as workflow authority once lifecycle is canonical.

## Collaboration identity correction

Final canonical uniqueness is:

`UNIQUE(sourceApplicationId)`

Retire `@@unique([campaignId, creatorUserId])` only after the Application-based provisioning path is active and historical lineage has been reviewed.

This supersedes the transitional Campaign implementation that used Campaign+Creator uniqueness as its available concurrency guard.

One approved Application may create at most one Collaboration. Do not fabricate missing historic Applications merely to satisfy the future NOT NULL constraint.

## Locked execution snapshot

Create `CollaborationExecutionSnapshot` and require it for new canonical provisioning. It freezes execution-relevant Campaign, Asset, Brief, Application, Creator, Brand, usage-rights, creator requirements, brand support and Campaign commercial context including advance percentage and commercial currency.

ApplicationSnapshot and CollaborationExecutionSnapshot are intentionally different:

- Application snapshot = submission-time truth.
- Collaboration snapshot = locked execution-time truth.

## Commercial agreement

Create `CollaborationCommercialAgreement` and migrate useful legacy commercial values.

Canonical concepts include negotiation state, proposed/counter/agreed Creator fee, currency, configurable advance percentage/amount/balance, non-cash consideration, financial policy snapshots, platform commission/tax snapshots, payment rail, securement state and external financial execution references.

Retire hard-coded `advance30Amount` / `balance70Amount` as policy authority.

Creator bank/payment destination remains Settings/Payout-owned, not Collaboration-owned.

## Fulfillment

Replace logistics-only workflow authority with generalized `CollaborationFulfillment` + `CollaborationFulfillmentIssue[]` supporting physical, digital, service, experience and other consideration/evidence patterns.

## Deliverable execution

Create `CollaborationDeliverableExecution` from a specific canonical `UceBriefDeliverable`, preserving both source lineage and an immutable definition snapshot.

Create append-oriented `CollaborationSubmissionVersion[]` per execution.

`publishingRequired` is a required locked execution fact with NO default. The upstream derivation/authoring rule is not yet frozen; provisioning must explicitly resolve it and must not assume false or assume every deliverable is published.

## Publishing

Create `CollaborationPublishingExecution` per Deliverable Execution. Retire the single Collaboration-level live-post/compliance concept as authority.

## Financial resolution vs settlement

Create separate:

- `CollaborationFinancialResolution`: entitlement/policy decision.
- `CollaborationSettlement`: payout/refund execution state and authoritative confirmations.

Escrow/Payout owns money movement. Collaboration owns commercial obligations and entitlement/resolution.

## Feedback / event history

Create `CollaborationFeedbackWindow`, per-role `CollaborationFeedback`, and append-oriented `CollaborationEvent` with aggregate versioning.

Keep `CollaborationMessage` substantially intact; messages remain subordinate to domain state.

## Legacy `UceCampaignCollaboration`

Do not create another operational Collaboration aggregate. Existing `UceCampaignCollaboration` is a migration/compatibility bridge only.

Migrate/reassign its data by ownership:

- prospect/applicant/acquisition -> Campaign/Applications/Discovery
- operational workflow -> canonical Collaboration
- logistics/content -> Fulfillment/Deliverable execution
- telemetry/reporting -> Reporting/Intelligence evidence

Keep `ucePipelineCollaborationId` only as temporary lineage where needed. Retire legacy operational authority only after runtime cutover and data verification.

---

# Escrow / Payout safety boundary

Retain existing production infrastructure such as:

- `BrandEscrowVault`
- `CollaborationEscrowLock`
- `EscrowTransactionLedger`
- `IdempotencyRegistry`
- Creator settlement/payment infrastructure

Generalize old fixed-30/70 policy, but do not rewrite historical financial balances/ledger rows for schema neatness.

If `CollaborationEscrowLock` lives in the same integrated Prisma schema, preserve the real relational FK. Opaque external refs may supplement it but should not replace a valid same-database relation.

Any production migration affecting escrow balances, transaction ledger history, payout evidence or settlement records requires a separate financial-data review.

---

# Deletion / mutation policy

Configuration may remain mutable where domain contracts permit it. Historical decision/execution evidence must be protected.

Examples of protected/append-oriented structures:

- ApplicationSnapshot
- CollaborationExecutionSnapshot
- CollaborationEvent
- CollaborationSubmissionVersion
- published Campaign Report calculations
- financial resolution / settlement evidence
- Escrow transaction ledger

Avoid cascading deletion from Campaign/Application/Asset/Brief into existing Collaborations. Prefer Restrict for contractual/historical lineage; archive through lifecycle instead of destructive deletion.

---

# Ordered implementation plan

## E1 — BrandProfile + Campaign root / Strategy / Targeting / Commercials

- Preserve existing BrandProfile; apply already-frozen Brand Identity compatible additions if absent.
- Add canonical Campaign provenance/timestamps.
- Reconcile Campaign Strategy/Targeting/Commercial fields and enums additively first.
- Do not drop legacy fields yet.

## E2 — CampaignAsset + Brief + Deliverables + Application

- Add canonical Asset/Brief/Deliverable tables.
- Add exactly-one-reference migration constraint plan.
- Introduce mapping/backfill path from legacy CampaignProduct/Brief.
- Retarget Application only after mapping verification; keep legacy references temporarily if needed.

## E3 — CampaignCreator / recommendation provenance / import / Outreach / Applicant Intelligence / Reporting / Share

- Preserve production CreatorProfile integration.
- Add recommendation/import/outreach/reporting canonical structures.
- Keep Share and Application identity where already compatible.

## E4 — Collaboration root + children

- Add canonical lifecycle/stage fields and Application lineage additively.
- Add execution snapshot, commercial agreement, fulfillment, deliverable/submission/publishing, resolution/settlement, feedback/events.
- Preserve legacy Collaboration children until migration/cutover.

## E5 — Cross-module FKs + Escrow compatibility

- Resolve CampaignAsset -> BrandProfile/Offering/BrandOffer relations.
- Resolve BriefDeliverable -> CollaborationDeliverableExecution.
- Resolve Application -> Collaboration reverse relation.
- Preserve Creator/User and Escrow relational ownership.
- Introduce Restrict semantics for historical Collaboration lineage where safe.

## E6 — Validate and generate

- `npx prisma format`
- `npx prisma validate`
- `npx prisma generate`
- generate a clean/dev migration only after schema validation.
- run Campaign and Collaboration focused tests.

Do not mark this branch production-migration-ready solely because a clean/dev migration succeeds.

---

# Production developer review requirements

Before production migration, independently investigate at least:

1. production row counts and null/data-quality profiles for affected tables;
2. legacy Campaign objective/timeline mappings;
3. free-form geography normalization quality;
4. CampaignProduct -> Brand Centre Offering/Offer/Brand mapping;
5. legacy Brief deliverable normalization;
6. existing Application ancestry integrity;
7. historical Collaboration -> Application lineage;
8. `UceCampaignCollaboration` active runtime/read consumers;
9. Campaign+Creator uniqueness removal implications;
10. financial/escrow/settlement row history;
11. dual-write/cutover strategy and whether migration must be split across releases.

Recommended production deployment pattern:

- Release A: ADD + BACKFILL + CUTOVER, preserve legacy structures read-only.
- Release B: RETIRE legacy structures only after runtime/data verification.

Never apply a blanket `prisma migrate reset` to production or a shared environment containing valuable data.
