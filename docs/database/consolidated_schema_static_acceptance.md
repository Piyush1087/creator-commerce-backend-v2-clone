# Consolidated Schema Static Acceptance

## Scope and revisions

- Branch: `feature/consolidated-schema-preprod`
- Starting SHA: `b8360dfd0cd9ea5d326ec5890e2139c9b9975281`
- E1: `0a5b12d7c8ded29a786eac501bc3890eca01e445`
- E2: `a808f8f9c84d6629a1e9f965e6b91d89c28886a5`
- E3: `3c7bf2ae412ec06bf1c8352511550ecbdf7e18f1`
- E4: `6fd4ebbb1acbde04d8966bca5bbcf3d8209e1b4d`
- E5 / final schema SHA: `66503a6f3fe279df5e3bdb442afaec51998c16c1`

No database command, migration generation/application, or database connection was used. Prisma static commands received an inert localhost URL on port 1 only to satisfy configuration parsing.

## E6 checks

- `prisma format`: PASS.
- `prisma validate`: PASS.
- `prisma generate`: PASS (Prisma Client 6.19.3).
- Campaign smoke tests: PASS, 2 files and 13 tests.
- Collaboration tests: NONE PRESENT in the repository.
- Nest backend build: PASS.
- Repository ESLint: FAIL, 1,585 pre-existing Prettier errors spread across unrelated source files. The same two Phase-E TypeScript files already failed formatting at the starting SHA; Phase E did not attempt a repository-wide formatting rewrite.
- Raw `tsc --noEmit`: FAIL because local Vitest typings are absent from this repository install and `.sst/platform/config.d.ts` has not been generated; the Nest TypeScript build passes.
- Parallel-authority inspection: PASS. Exactly one each of `UceCampaign`, `UceCampaignStrategy`, `UceCampaignAsset`, `UceBrief`, `UceCampaignReport`, `UceCampaignReportCalculation`, `Collaboration`, `CollaborationExecutionSnapshot`, and `CollaborationCommercialAgreement` exists. No CampaignV2 or CollaborationV2 aggregate was introduced.
- Diff-scope inspection: PASS. Changes are limited to the Prisma schema, the approved Campaign compatibility write/schema typing, and Phase-E database documentation.

## Canonical persistence added or altered

- BrandProfile frozen identity additions and additive Campaign root, Strategy, Targeting, and Commercial semantics.
- `UceCampaignAsset`, `UceBrief`, and `UceBriefDeliverable` with explicit Campaign-to-Asset-to-Brief-to-Deliverable ancestry.
- Campaign recommendation context/run/result, creator import, outreach/attempt/tracking, applicant intelligence, and canonical report/calculation projections.
- Additive canonical Collaboration lifecycle and terminal provenance fields.
- Canonical Collaboration execution snapshot, commercial agreement, fulfillment/issues, deliverable/submission/publishing execution, financial resolution, settlement, feedback, and append-oriented event models.
- Nullable historical lineage relations from Collaboration to Application, CampaignCreator, CampaignAsset, and canonical Brief, using restrictive deletion semantics.

## Compatibility debt intentionally retained

- Legacy `UceCampaignProduct` and `UceCampaignBrief`, plus legacy Application references; canonical Application references remain additive and nullable.
- Legacy Campaign strategy/targeting/commercial fields used by current runtime.
- Legacy `UceCampaignReportingSnapshot`, hourly timeseries, and asset gallery. Snapshot writes remain append-style; `campaignId` was not made unique. Canonical publication authority is `UceCampaignReport` with append-oriented `UceCampaignReportCalculation`.
- Legacy Collaboration `currentStage` (`UceMilestoneStage`) remains the runtime field. Canonical stage is temporarily stored as `canonicalCurrentStage` until runtime/backfill cutover avoids reinterpreting the existing column.
- Transitional `@@unique([campaignId, creatorUserId])` remains until source-Application lineage is backfilled and cut over.
- Legacy `CollaborationCommercial`, `CollaborationLogistics`, `CollaborationMedia`, `CollaborationFinalization`, and `UceCampaignCollaboration` remain for migration compatibility.
- Existing `CollaborationEscrowLock` and escrow ledger ownership/history are unchanged.

## Migration and backfill dependencies

- Independently review production data and author migrations; this pass generated none.
- Implement and review the documented PostgreSQL exactly-one Campaign Asset reference CHECK constraint.
- Backfill canonical Application Asset/Brief references before enforcing non-null canonical lineage.
- Backfill Collaboration Application, CampaignCreator, Asset, Brief, lifecycle/stage, snapshot, and aggregate-version lineage before runtime cutover.
- Plan explicit authority cutovers before removing any retained legacy model, field, or uniqueness constraint.
- Resolve the repository-wide formatting baseline and generate/install the Vitest/SST type environments for clean standalone lint and raw typecheck gates.

## Contract ambiguity resolved conservatively

The existing Collaboration `current_stage` column has active legacy enum semantics. Reusing it for the canonical enum would silently reinterpret historical data, so the canonical field was added under a separate mapped column and the legacy field retained. This is explicit compatibility debt, not a second aggregate authority.

## Verdict

**STATIC ACCEPTED WITH DEBT**

This verdict is static and pre-production only. Independent production data and migration review is required; the schema is not declared production-ready.
