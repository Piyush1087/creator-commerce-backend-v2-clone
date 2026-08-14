# Collaboration clone reconcile (backend)

Date: 2026-08-13
Branch: `feature/collab-clone-reconcile-be`
Frozen source: clone commit `13ce652` (`collaboration/final-backend-reconciliation`)

## Source of truth

- Executable implementation: frozen clone commit `13ce652`
- Product semantics only: dummy_tcs (not schema/API SoT)
- Deployment destination: developer `creator-commerce-backend-v2` + SST
- Do not blindly overwrite campaign Phase 1–3, escrow, pricing, or SST

## What landed

- Checked out clone `src/features/collaboration/` into this repo
- Adapted phase-1 SQL so it does not recreate existing `uce_applications` /
  `uce_campaign_creators` / `uce_application_snapshots`
- Production `UceCampaignCreator` uniqueness stays handle-based
  (`campaignId_platform_normalizedSocialHandle`); optional `creatorUserId` added
- Pipeline provisions Application-origin Collaboration via
  `legacyPipelineCollaborationId` + `provisionFromApprovedApplication`
- Pricing clone services (`PlanCommercialPolicyService`,
  `BusinessGeographyFinancialPolicyService`) exported from `PricingModule`
- Clone `CollaborationEscrowReserveService` added under brand-escrow ownership;
  existing vault/ledger/hardened escrow services kept
- Co-pilot HITL routes canonical rows through canonical commands; LIVE campaign
  status is preserved

## Local validation

- `npx prisma generate` succeeded
- `npx prisma migrate deploy` applied all eight clone migrations on local Docker
- Collaboration `node:test` suite: 101 passed, 0 failed
- Full `tsc -p tsconfig.build.json` hung on this Windows host (known); typecheck
  is deferred to CI / `nest build`

## Out of scope

- Pause/resume product commands
- Real payout adapter / TDS / FX
- Asset provider
- Commit, PR, or deploy
