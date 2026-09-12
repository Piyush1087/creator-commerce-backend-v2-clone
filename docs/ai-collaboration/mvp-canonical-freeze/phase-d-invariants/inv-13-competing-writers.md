# INV-13 — competing runtime writers vs retained schema

**Date:** 2026-09-11  
**Amendment:** prove duplicate models; silent Prisma drop is forbidden  
**Result:** Pair 1 and Pair 2 leftover *journey* writers retired `410`. Overall **PASS classified** for competing writers (tables retained). No Prisma drop. Freeze itself is still not PASS.

```text
competing runtime writer     = live service still creates/updates the non-canonical model on the canonical journey
harmless retained schema     = table/model remains; no canonical journey writes it
retired competing transition = HTTP/service throw before write; table may remain
silent Prisma drop           = FORBIDDEN this amendment
```

## Pair 1 — Collaboration identity

| Model | Disposition | Proof |
| --- | --- | --- |
| `Collaboration` | Canonical (C-03 handoff, C-04) | `approved-application-collaboration.service.ts` `collaboration-provision.service.ts` create |
| `UceCampaignCollaboration` | Harmless retained schema | Parent 2026-09-10: stop writing. Brand UCE pipeline mutations, creator-uce apply, marketplace command/invite, and C-03 approve leftover update are `410` (`UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED` / `OUT_OF_MVP_COMPETING_TRANSITION_RETIRED`). Reads remain. Table not dropped |

Canonical Brand application approve still provisions `Collaboration`. It may *read* a leftover UCE row id for compatibility linking (`ucePipelineCollaborationId`). It does not update/create `UceCampaignCollaboration`.

## Pair 2 — Commercial / logistics / media aggregates

| Model | Disposition | Proof |
| --- | --- | --- |
| `CollaborationCommercialAgreement` | Canonical C-04 | `collaboration-negotiation.service.ts` `collaboration-securement.service.ts` |
| `CollaborationCommercial` `CollaborationLogistics` `CollaborationMedia` `CollaborationFinalization` | Harmless retained schema | Trigger `c04_prevent_canonical_legacy_write` on `CANONICAL_V1` rows. Leftover Brand Collab HTTP already `410`. Leftover `CollaborationService` mutating methods now throw `410 LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED` before Prisma. Canonical escrow reserve (`executeCanonicalReserve`) no longer writes `CollaborationCommercial`; vault / lock / ledger remain. Tables not dropped |

Canonical C-03 handoff (`approved-application-collaboration.service.ts`) creates `CollaborationCommercialAgreement`, not the leftover aggregates.

Leftover-origin seed: `collaboration-provision.service.ts` `provisionFromUceApproval` may still create leftover child rows for leftover-origin Collaboration (`sourceApplicationId` null). That is leftover-origin fixture/seed, not a C-04 agreement writer on `CANONICAL_V1`. Canonical rows remain DB-guarded.

Escrow may still *read* leftover `commercials.finalQuote` when a leftover-origin row has one. That is a read of retained schema, not a competing write.

## Pair 3 — Creator money identity

| Model | Disposition | Proof |
| --- | --- | --- |
| `CreatorPayoutDestination` | Canonical C-05 | `prisma-creator-payout-settings.repository.ts` |
| `CreatorBankDetails` | Harmless retained schema | `POST /api/v1/collaboration/creator/bank-details` is already `410` |
| `CreatorSettlementProfile` | Retained / mixed leftover | Not C-05 P1D writer. Do not drop |

## What this amendment did not drop

No `DROP TABLE`. Living leftover list (re-mark every later run): `../14-migration-schema/retained-schema-register.md`.
