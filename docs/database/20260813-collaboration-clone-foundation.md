# Collaboration clone foundation migrations

Date: 2026-08-13
Applied locally: Docker `thecreatorshop` via `npx prisma migrate deploy`

Frozen clone commit `13ce652` ships eight additive Collaboration migrations.
They were applied after a local volume reset. They are **not** auto-applied to
RDS until a reviewed deploy.

## Migrations

1. `20260810180000_collaboration_phase_1_foundation`
   - Adapted SQL: create Collaboration enums / canonical tables /
     `uce_brief_deliverables` / commercial + application columns
   - Does **not** `CREATE` existing campaign Phase 1–3 tables
2. `20260810193000_collaboration_phase_3_commercial_commands`
3. `20260810213000_collaboration_phase_3_1_financial_boundary`
4. `20260810233000_collaboration_phase_4_1_fulfillment`
5. `20260811013000_collaboration_phase_4_2_production`
6. `20260811143000_collaboration_phase_4_4_publishing`
7. `20260811180000_collaboration_phase_4_6_settlement`
8. `20260812190000_collaboration_phase_4_7_feedback`

## Compatibility notes

- Keep `uuid()` ids
- `UceCampaignCreator` unique remains handle-based; clone’s
  `campaignId+creatorUserId` unique is **not** introduced
- Production `currentStage` stays `UceMilestoneStage`; canonical stage is
  additive (`canonicalStage`)
- `CollaborationEscrowLock` and `CONTRACT_LOCK_RESERVE` live in escrow tables
  owned by brand-escrow
- Campaign Phase 1–3, escrow vault, and SST deploy wiring are unchanged
