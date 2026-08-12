# Codex Execution Contract — Consolidated Prisma Schema

## Objective

Implement Phase E on `Piyush1087/creator-commerce-backend-v2-clone` branch `feature/consolidated-schema-preprod`.

Do not touch production infrastructure or a production database. This is a source/schema reconciliation and local validation pass.

## Required sources

Read all of these before editing:

### Integration target
- `docs/database/consolidated_schema_migration_handoff.md`
- current `prisma/schema.prisma`

### Canonical Campaign sources in `Piyush1087/dummy_tcs`, branch `campaign/production-integration-review`
- `backend/campaign_schema.prisma`
- `campaign/backend/schema_reconciliation.yaml`

### Canonical Collaboration sources in the same dummy_tcs branch
- `collaboration/backend/collaboration_schema.prisma`
- `collaboration/backend/schema_reconciliation.md`
- `collaboration/backend/dependency_check.md`
- `collaboration/backend/integrated_schema_check.md`

### Brand Centre persistence patch in the same dummy_tcs branch
- `backend/schema/identity_patch.prisma`

## Precedence rule

1. Frozen module contracts/canonical working schemas define domain semantics.
2. `consolidated_schema_migration_handoff.md` defines cross-module integration decisions and migration safety policy.
3. Existing production-style schema wins for already-resolved concrete integration details that do not conflict with canonical semantics, e.g. `UceCampaignCreator.creatorProfileId -> CreatorProfile`.
4. Do not create parallel V2 aggregate models to avoid reconciliation work.

## Safety rules

- Work only on `feature/consolidated-schema-preprod`.
- Do not modify `feature/campaign-phase-1-3-be`, main, development, or production repos.
- Do not connect to any database during E1-E5.
- Do not delete legacy models/fields during the first consolidated pass unless they are provably unused and the handoff explicitly allows immediate removal. Default is retain/deprecate.
- Do not rewrite unrelated Brand Centre, Creator, Settings, Escrow or subscription models.
- Do not invent mappings for ambiguous historical data.
- Keep existing table names/IDs where the handoff says evolve in place.
- Preserve existing real relations when stronger than an isolated placeholder.

# E1 — BrandProfile + Campaign root / Strategy / Targeting / Commercials

Implement one focused commit.

### BrandProfile
Apply only missing frozen identity-patch fields from `backend/schema/identity_patch.prisma`:
- businessGeography
- marketsServed
- primaryLanguage
- websiteCurrency
- facebookHandle
- linkedinHandle

Do not duplicate existing compatible fields or alter BrandRoutingType.

### Campaign root
Evolve existing `UceCampaign` additively:
- creationSource + enum
- aiRecommendationId?
- aiRecommendationVersion?
- publishedAt?
- liveAt?
- completedAt?
- archivedAt?

Preserve current Campaign relation identity/table.

### Strategy
Add canonical strategy fields/enums while retaining legacy fields temporarily where source compatibility requires them:
- publishingSchedule
- publishFrom?
- publishUntil?
- canonical CampaignObjective
- primaryKpiId
- supportingKpiIds
- platforms
- one visibilityScope

Do not create a second Campaign Strategy model.

Do not make old `platformDeliverables` the canonical deliverable owner.

### Targeting
Add/align:
- minimumFollowers
- maximumFollowers?
- enum audienceGender
- audienceAffinityIds
- structured audienceGeographies Json

Preserve creatorArchetypes and age bounds.
Retain legacy followerTiers/targetLocations/etc only for compatibility during this pass, clearly commented deprecated/non-authoritative where appropriate.

### Commercials
Add/align:
- receivesBrandSupport
- brandSupportType
- brandSupportEstimatedValue
- commercialOffer
- totalCampaignBudget
- canonical advancePaymentPercentage behavior/default for new rows
- payoutTerms including NET_45/NET_60
- currency

Retain legacy fixed/min/max fields temporarily if current source consumers still compile.
Do not turn the old 30% default into the new canonical default.

### E1 validation
Run without DB connection if possible:
- `npx prisma format`
- `npx prisma validate`
- `npx prisma generate`
- existing Campaign schema/unit tests that do not require PostgreSQL
- backend TypeScript build/typecheck if available

Fix only defects caused by E1.
Commit E1 separately and report SHA + changed fields + any compatibility fields retained.

# E2 — Campaign Asset + Brief + Deliverables + Application

Implement after E1 passes.

Create canonical:
- UceCampaignAsset
- UceBrief
- UceBriefDeliverable

Use BrandProfile/Offering/BrandOffer real relations where available. Preserve old `UceCampaignProduct` and `UceCampaignBrief` as legacy compatibility models during this pass.

Do not reuse legacy CampaignProduct table as if it had canonical CampaignAsset semantics.

Add the Prisma-side uniqueness/index structure, and document the required PostgreSQL exactly-one-reference CHECK constraint in a migration note/file. Do not pretend Prisma uniqueness alone enforces the invariant.

Application migration must be additive first. If current runtime still references legacy Product/Brief, preserve those references and add canonical mapping/reference fields in a way that keeps Prisma valid. Do not silently change an existing column's meaning to point at a different table.

Ensure the target ancestry is explicit:
Campaign -> Asset -> Brief -> Deliverable.

Run format/validate/generate/tests/build and commit E2 separately.

# E3 — CampaignCreator / Recommendations / Import / Outreach / Applicant Intelligence / Reporting

Preserve production `creatorProfileId -> CreatorProfile`.

Add canonical:
- UceCampaignRecommendationContext
- UceCreatorRecommendationRun
- UceCampaignCreatorRecommendation
- UceCampaignCreatorImport
- UceOutreach
- UceOutreachAttempt
- UceOutreachTrackingEvent
- UceApplicantIntelligence
- UceCampaignReport
- UceCampaignReportCalculation

Keep existing Share/Application identity when compatible; do not duplicate them.

Detailed Intelligence execution/raw pools remain Intelligence-owned. Campaign persists only Campaign-facing recommendation/applicant/report publication projections and provenance.

Do not replace legacy reporting evidence yet. Add canonical publication authority alongside it.

Run validation/tests/build and commit E3 separately.

# E4 — Canonical Collaboration root + children

Evolve existing `Collaboration`; do not create `CollaborationV2`.

Add canonical root semantics additively:
- sourceApplicationId initially nullable if required for historical compatibility; unique where representable
- campaignCreatorId
- campaignAssetId
- lifecycle
- canonical currentStage
- currentStageStatus
- aggregateVersion
- terminal provenance fields

Keep old Campaign+Creator uniqueness only if needed to keep transitional runtime/data safe in this first pass; clearly mark it as slated for removal after sourceApplication lineage cutover. Do not treat it as final canonical identity.

Add canonical children:
- CollaborationExecutionSnapshot
- CollaborationCommercialAgreement
- CollaborationFulfillment
- CollaborationFulfillmentIssue
- CollaborationDeliverableExecution
- CollaborationSubmissionVersion
- CollaborationPublishingExecution
- CollaborationFinancialResolution
- CollaborationSettlement
- CollaborationFeedbackWindow
- CollaborationFeedback
- CollaborationEvent

Keep `CollaborationMessage` and adapt indexes/relations if needed.

Preserve legacy CollaborationCommercial, CollaborationLogistics, CollaborationMedia, CollaborationFinalization and UceCampaignCollaboration for migration compatibility. They must no longer be presented/commented as the target authority.

`publishingRequired` on CollaborationDeliverableExecution has no default. Do not invent one.

Run validation/tests/build and commit E4 separately.

# E5 — Cross-module relations + Escrow compatibility

Resolve integrated reverse relations and FK ownership:
- BrandProfile/Offering/BrandOffer -> CampaignAsset
- UceApplication -> optional canonical Collaboration reverse relation
- UceBriefDeliverable -> CollaborationDeliverableExecution[]
- CreatorProfile/User relations needed by Campaign/Collaboration
- Campaign/Asset/Brief historical Collaboration lineage should prefer Restrict rather than destructive cascade where changing it is safe in source schema

Preserve real `CollaborationEscrowLock` relational ownership if it lives in the same Prisma schema. Do not replace it with only an opaque string.

Do not redesign Escrow/Payout tables. Do not alter ledger history semantics beyond compile-compatible relation/generalization requirements.

Run validation/tests/build and commit E5 separately.

# E6 — Consolidated static acceptance

After E1-E5:

1. run `npx prisma format`
2. run `npx prisma validate`
3. run `npx prisma generate`
4. run all Campaign unit/schema smoke tests that do not require DB
5. run Collaboration tests that do not require DB if present
6. run backend lint/typecheck/build
7. inspect schema for duplicate/parallel authorities and relation ambiguity
8. inspect git diff specifically for accidental unrelated edits

Do NOT generate/apply a production migration in this step.
Do NOT use `prisma migrate reset`.

Create `docs/database/consolidated_schema_static_acceptance.md` containing:
- starting SHA
- E1-E5 commit SHAs
- final SHA
- exact checks executed/results
- canonical models added/altered
- legacy compatibility structures intentionally retained
- unresolved migration/backfill dependencies
- any contract ambiguity encountered
- final verdict: STATIC ACCEPTED / STATIC ACCEPTED WITH DEBT / NOT STATIC ACCEPTED

## Stop conditions

Stop and report rather than guessing if any of the following arise:
- a canonical relation cannot be reconciled without choosing between two materially different business semantics not covered by the handoff;
- existing production models show a financial relation whose alteration could change money history;
- Application/Collaboration identity cannot be represented additively without destructive migration;
- Prisma requires changing an unrelated domain model in a way not explained by reverse relations;
- a frozen canonical source conflicts with another frozen source and the handoff has not already resolved precedence.

Do not call the schema production-ready. The developer must perform independent production data/migration review after this pre-production consolidation is statically accepted.
