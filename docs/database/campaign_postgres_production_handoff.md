# Campaign PostgreSQL Production Migration Handoff

## Purpose

This document is the developer handoff for migrating the Campaign/Collaboration PostgreSQL work completed in the Creator Shop pre-production runtime into the developer-owned production backend/database.

This is **not** an instruction to apply the repository migration blindly to production. The developer must independently inspect the production database, reconcile historical data, author/review the production migration plan, and decide cutover/backfill sequencing.

The authoritative pre-production backend branch at handoff is:

- Repository: `Piyush1087/creator-commerce-backend-v2-clone`
- Branch: `feature/consolidated-schema-preprod`
- Campaign functional closure merge: `d7af091d70972bbab1ab17178596983cdb892964`

The accepted local runtime used PostgreSQL 16 and the isolated database `creator_shop_acceptance`. No AWS/dev/production database was used during acceptance.

---

## 1. What this schema work achieved

The consolidated schema establishes canonical Campaign and Collaboration persistence while intentionally retaining legacy structures where production migration/backfill is not yet proven.

The canonical Campaign path now covers:

- Campaign root and lifecycle/provenance;
- Campaign Strategy;
- Campaign Targeting;
- Campaign Commercials;
- Campaign Assets;
- canonical Briefs and Brief Deliverables;
- canonical Application Asset/Brief lineage;
- Campaign recommendation/import/outreach/applicant/reporting projections;
- approval-to-Collaboration lineage.

The canonical Collaboration path now includes:

- source Application and Campaign/Creator lineage;
- canonical Campaign Asset/Brief lineage;
- lifecycle and canonical stage provenance;
- `CollaborationExecutionSnapshot`;
- canonical commercial agreement structures;
- fulfillment/issues;
- deliverable/submission/publishing execution;
- financial resolution/settlement/feedback/event structures.

This schema was designed as a **modular consolidated authority**, not as parallel `CampaignV2` / `CollaborationV2` aggregates.

---

## 2. Authoritative files

The developer should review these files together rather than using the Prisma schema alone:

1. `prisma/schema.prisma`
   - current consolidated pre-production Prisma authority.

2. `prisma/migrations/20260813005000_consolidated_preprod/migration.sql`
   - history-reconciled F4.1 migration proven against the repository's actual migration history.
   - this is a **pre-production/reference migration artifact**, not an automatically approved production migration.

3. `docs/database/consolidated_schema_static_acceptance.md`
   - Phase E static acceptance and retained compatibility debt.

4. `docs/database/consolidated_schema_migration_f4_1_audit.md`
   - explains why F4.1 superseded the original F4 artifact and records migration-history reconciliation decisions.

5. `docs/database/campaign_postgres_production_handoff.md`
   - this production migration handoff.

---

## 3. Important migration-history finding

The first F4 artifact was generated from a schema snapshot and failed when applied after the repository's complete migration history because the baseline migration `20260812170000_uce_campaign_canonical_definition` had already introduced overlapping fields.

F4.1 corrected this by generating/reconciling the consolidated migration **after materializing the full real pre-F4 migration history**.

Key reconciliations include:

- preserve `uce_campaigns.canonical_definition` because current Campaign runtime still writes it as compatibility evidence;
- convert existing `uce_campaigns.creation_source` from TEXT to `UceCampaignCreationSource` **in place**, after removing the legacy check constraint;
- convert `uce_campaign_targeting.audience_gender` to the canonical enum in place rather than drop/recreate;
- retain the Campaign Asset exactly-one-reference database CHECK constraint;
- reconcile historical index-name collisions, including the legacy non-unique `creator_profiles_public_slug_key` and `users_google_subject_id_key` indexes;
- retain legacy Campaign Product/Brief/UCE Collaboration structures;
- do not rewrite escrow, payout, ledger or settlement history.

The production migration should therefore be authored against the **actual materialized production migration/database state**, not merely diffed from an old Prisma schema snapshot.

---

## 4. Campaign Asset authority

Canonical `UceCampaignAsset` is now the Campaign-side reference to Brand Centre authority.

The product policy frozen during runtime acceptance is:

| Campaign promotes | Canonical Asset authority |
| --- | --- |
| Brand itself | `BrandProfile` |
| Product / service / treatment / experience / plan / collection | `Offering` |
| Promotion / discount / package / commercial offer | `BrandOffer` |

Rules:

- Campaign must reference existing Brand Centre entities.
- Campaign must not synthesize new Offerings/BrandOffers from legacy Product payloads.
- SKU/variant is not a separate canonical Campaign Asset identity in MVP; the parent Offering remains canonical.
- Legacy `UceCampaignProduct` is retained only as compatibility projection.

The database enforces exactly one canonical Campaign Asset source reference. The production migration must preserve/recreate and verify the corresponding CHECK constraint.

Historical Product → Offering/BrandOffer mapping is **not solved by runtime code** and must be treated as production migration/backfill work.

---

## 5. Brief authority

Canonical ancestry is:

`Campaign → CampaignAsset → Brief → BriefDeliverable`

New runtime behavior treats canonical Briefs as authority for readiness/application approval.

Legacy `UceCampaignBrief` remains a compatibility projection.

Production migration must not assume historical legacy Brief rows already contain sufficient canonical Asset lineage. Historical Brief backfill must be reviewed together with historical Product/Offering mapping.

---

## 6. Application and approval lineage

The accepted runtime now persists canonical Application references:

- Campaign;
- Creator;
- canonical Campaign Asset;
- canonical Brief.

Approval consumes those persisted canonical references and provisions Collaboration with:

- `sourceApplicationId`;
- Campaign/Creator lineage;
- canonical Asset/Brief references;
- canonical lifecycle/stage initialization;
- `CollaborationExecutionSnapshot`.

Legacy Product/Brief Application fields remain compatibility fields.

### Production backfill dependency

Historical Applications created before this cutover may not have canonical Asset/Brief references. Before enforcing stricter non-null lineage or retiring legacy fields, production data must be classified and backfilled safely.

Do not infer canonical IDs at approval time from ambiguous legacy IDs.

---

## 7. Collaboration migration boundaries

The consolidated schema adds canonical Collaboration structures but intentionally retains legacy Collaboration persistence while migration is incomplete.

Retained compatibility debt includes:

- legacy `currentStage` / `UceMilestoneStage` runtime field;
- additive `canonicalCurrentStage` rather than reinterpreting historical stage values;
- transitional Campaign+Creator uniqueness;
- legacy `CollaborationCommercial`;
- legacy `CollaborationLogistics`;
- legacy `CollaborationMedia`;
- legacy `CollaborationFinalization`;
- `UceCampaignCollaboration`;
- existing escrow lock and ledger ownership.

Production migration must backfill/validate source Application, CampaignCreator, Asset, Brief, lifecycle/stage, execution snapshot and aggregate-version lineage before removing these compatibility structures.

---

## 8. Reporting compatibility

`UceCampaignReportingSnapshot` remains append-oriented and one-to-many per Campaign.

Do **not** make `campaignId` unique on this legacy snapshot model.

The accepted Campaign publication runtime writes an initial compatibility snapshot with `create(...)`, not singleton `upsert(...)`.

Canonical reporting authority is designed around `UceCampaignReport` plus append-oriented `UceCampaignReportCalculation` and `latestCalculationId` publication semantics.

Legacy snapshot/timeseries/gallery data should remain available until reporting cutover and retention policy are separately accepted.

---

## 9. Financial / escrow boundary

The Campaign/Collaboration schema work did **not** authorize rewriting production financial authority.

The developer must treat the following as protected production domains:

- escrow vaults;
- escrow locks;
- payout ownership;
- transaction/ledger history;
- settlement history;
- financial-resolution history.

No migration should truncate, reinterpret or backfill these records without a separate financial migration review.

---

## 10. Required production investigation before migration

Before creating a production migration, inspect at minimum:

### A. Migration state

- exact production `_prisma_migrations` rows/order;
- whether production matches repository migration history;
- manually applied schema changes not represented in Prisma migrations;
- failed/rolled-back migrations.

### B. Existing Campaign rows

Measure:

- Campaign count by lifecycle/status;
- null/non-null `creation_source` values and distinct values;
- `audience_gender` distinct values;
- `canonical_definition` usage;
- Product/Brief counts per Campaign;
- Campaigns with no Product/Brief;
- duplicate or ambiguous Product identities;
- Campaigns whose products can/cannot deterministically map to Brand Centre Offerings/Offers.

### C. Applications

Measure:

- total Application count;
- Application counts with legacy Product/Brief IDs;
- whether canonical Asset/Brief fields already exist/populated;
- duplicate Campaign+Creator Applications;
- approved Applications without recoverable canonical lineage.

### D. Collaborations

Measure:

- Collaboration count by lifecycle/stage;
- Campaign+Creator duplicates;
- rows with recoverable source Application;
- legacy Product/Brief lineage;
- existing execution/financial child rows;
- active/terminal Collaborations that must not be reinterpreted.

### E. Brand Centre mapping

Measure whether historical Campaign products/promotions can be mapped to:

- `BrandProfile`;
- `Offering`;
- `BrandOffer`.

Classify mappings as:

- deterministic;
- probable/manual-review;
- unmappable.

Do not auto-create canonical Brand Centre entities merely to make migration pass.

---

## 11. Recommended production migration sequence

This is the recommended control sequence; the developer should adjust it after inspecting production data.

### Step 1 — Snapshot and dry-run

- take production DB backup/snapshot;
- clone production into a disposable migration-review database;
- run all investigation queries against the clone first.

### Step 2 — Materialize actual baseline

- confirm actual schema/migration history;
- compare production DB → target consolidated Prisma schema;
- identify drift separately from intended Campaign changes.

### Step 3 — Additive schema first

Prefer additive changes before authority cutover:

- enums;
- canonical tables;
- nullable canonical lineage columns;
- safe indexes;
- non-destructive constraints where existing rows already satisfy them.

### Step 4 — Backfill Brand/Campaign lineage

- map historical Campaign Product/Promotion → existing BrandProfile/Offering/BrandOffer;
- create CampaignAsset rows only where mapping is valid;
- map Briefs to canonical Campaign Assets;
- record/manual-review unresolved rows.

### Step 5 — Backfill Applications

Populate canonical Asset/Brief lineage only where deterministic and valid.

Do not invent references for unresolved historical Applications.

### Step 6 — Backfill Collaborations

Populate recoverable:

- source Application;
- CampaignCreator;
- Asset/Brief;
- canonical lifecycle/stage;
- execution snapshot / aggregate version where appropriate.

Active Collaborations require extra review because their runtime behavior must remain stable during cutover.

### Step 7 — Runtime deployment/cutover

Deploy the accepted backend runtime together with the compatible production migration plan.

Avoid a state where:

- runtime requires canonical fields that production data has not yet received; or
- schema constraints become strict before backfill is complete.

### Step 8 — Verify production

Run application-level smoke plus DB assertions before declaring migration complete.

### Step 9 — Retire legacy later

Do not drop legacy Product/Brief/Collaboration/reporting structures in the initial production migration.

Removal should be a later migration after all consumers and historical rows are verified canonical.

---

## 12. Required migration acceptance checks

At minimum, the migration rehearsal should prove:

- Prisma validate/generate passes against target code;
- target DB → Prisma schema diff is understood/zero except explicitly documented production-only drift;
- no unintended destructive table/column operations;
- Campaign Asset exactly-one-reference CHECK exists and works;
- existing Campaign rows remain readable;
- legacy Product/Brief structures remain intact;
- canonical Campaign Assets/Briefs are correctly linked where backfilled;
- new Campaign draft/autosave/publish works;
- readiness uses canonical Asset/Brief authority;
- Creator Application persists canonical IDs;
- approval creates exactly one Collaboration;
- `sourceApplicationId` and canonical Asset/Brief references persist;
- `CollaborationExecutionSnapshot` is created;
- repeated approval is idempotent;
- Campaign lifecycle remains valid;
- Share/read models work;
- legacy reporting snapshot remains append-style;
- escrow/payout/ledger row counts and balances are unchanged unless separately approved.

---

## 13. Validation already completed in pre-production/local acceptance

The consolidated schema/runtime was proven against an isolated PostgreSQL 16 acceptance environment.

Accepted results included:

- repository migration history applied successfully;
- corrected F4.1 migration applied successfully;
- 41 migrations applied, 0 unfinished;
- Prisma validate PASS;
- Prisma generate PASS;
- DB → Prisma schema diff zero;
- Campaign Asset CHECK present;
- canonical Campaign/Asset/Brief/Application/Collaboration/ExecutionSnapshot structures present;
- intentionally retained legacy Campaign Product/Brief/UCE Collaboration structures present;
- Campaign backend runtime acceptance PASS;
- Campaign regression 24/24 PASS;
- eligibility tests 4/4 PASS;
- frontend canonical runtime cutover acceptance PASS.

These results prove the target pre-production design/runtime, **not the safety of applying the same SQL blindly to production data**.

---

## 14. Explicit retained debt after production handoff

The following should be tracked rather than silently removed during the first production migration:

- legacy Campaign Product/Brief compatibility structures;
- historical Product → Offering/BrandOffer mapping gaps;
- legacy Application Product/Brief references;
- legacy Collaboration stage/commercial/logistics/media/finalization structures;
- transitional Campaign+Creator Collaboration uniqueness;
- legacy reporting snapshots/timeseries/gallery;
- historical source-Application/Asset/Brief gaps;
- public share-page consumption remains a separate product/runtime concern;
- pause/resume-specific timestamps were not invented where absent from schema;
- production financial/escrow migration remains separately governed.

---

## 15. Developer sign-off expected

Before migrating production, please return a short migration review containing:

1. production schema/migration-history findings;
2. production row counts and drift findings;
3. historical Product/Brief → canonical mapping strategy;
4. Application and Collaboration backfill strategy;
5. treatment of unresolved historical rows;
6. exact production migration files/SQL proposed;
7. rollback plan;
8. staging/clone rehearsal result;
9. post-migration verification result;
10. any differences from this pre-production schema that must intentionally remain.

Production migration should be considered complete only after this independent review and rehearsal are accepted.
