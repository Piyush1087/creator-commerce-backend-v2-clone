# Retained / leftover schema register

**Living file.** Every freeze amendment and AI run that touches schema, INV-13, or OUT modules **must re-mark this list**. Silent `DROP TABLE` / Prisma model delete remains **forbidden** until a later amendment records `DROPPED_WITH_AUTHORITY`.

Canonical schema: `prisma/schema.prisma`.  
Writer proof: `../phase-d-invariants/inv-13-competing-writers.md`.  
Charter: amendment Phase D — INV-13.

```text
KEEP                     = table stays; do not drop this amendment
DROP_CANDIDATE           = may be considered later; still KEEP until authority + named migration
DROPPED_WITH_AUTHORITY   = dummy_tcs / Parent named the drop; migration exists; fill dropped_in
```

Do not invent drops. Add a row when a leftover model is found. Re-stamp `last_reviewed` even if status is unchanged.

## Review log

| When | Amendment / run | What changed |
| --- | --- | --- |
| 2026-09-11 | C-04 / C-02A / Payouts v1 | Opened this register. INV-13 writers `410`. All rows `KEEP`. No drop. |

## INV-13 leftover (canonical journey must not write these)

| Prisma model | Table (`@@map`) | Canonical instead | Writers this amendment | Remaining reads / seed | Status | Drop later? |
| --- | --- | --- | --- | --- | --- | --- |
| `UceCampaignCollaboration` | `uce_campaign_collaborations` | `Collaboration` | `410` | Approve may read leftover id (`ucePipelineCollaborationId`) | KEEP | DROP_CANDIDATE after leftover reads gone |
| `UceCollaborationLogistics` | `uce_collaboration_logistics` | C-04 fulfillment / destination | `410` with Pair 1 pipeline | leftover-origin only | KEEP | DROP_CANDIDATE with Pair 1 family |
| `UceCollaborationContentDraft` | `uce_collaboration_content_drafts` | C-04 production | `410` | leftover-origin only | KEEP | DROP_CANDIDATE with Pair 1 family |
| `UceCollaborationLiveTelemetry` | `uce_collaboration_live_telemetry` | C-04 publishing | `410` | leftover-origin only | KEEP | DROP_CANDIDATE with Pair 1 family |
| `UceCollaborationAuditLog` | `uce_collaboration_audit_logs` | C-04 events | `410` | leftover-origin only | KEEP | DROP_CANDIDATE with Pair 1 family |
| `CollaborationCommercial` | `collaboration_commercials` | `CollaborationCommercialAgreement` | `410` + trigger on `CANONICAL_V1` | leftover-origin seed; escrow may read `finalQuote` | KEEP | DROP_CANDIDATE after leftover-origin seed/reads gone |
| `CollaborationLogistics` | `collaboration_logistics` | C-04 destination / fulfillment | `410` + trigger | leftover-origin seed | KEEP | DROP_CANDIDATE with Pair 2 family |
| `CollaborationMedia` | `collaboration_media` | C-04 production media | `410` + trigger | leftover-origin seed | KEEP | DROP_CANDIDATE with Pair 2 family |
| `CollaborationFinalization` | `collaboration_finalization` | C-04 publishing / settlement | `410` + trigger | leftover-origin seed | KEEP | DROP_CANDIDATE with Pair 2 family |
| `CreatorBankDetails` | `creator_bank_details` | `CreatorPayoutDestination` (C-05) | collab POST `410` | none on canonical journey | KEEP | DROP_CANDIDATE after C-06 accepted (money identity) |
| `CreatorSettlementProfile` | `creator_settlement_profiles` | C-05 destinations now; C-06 later | not C-05 P1D writer | mixed leftover | KEEP | **not** a drop candidate until C-06 dummy_tcs authority |

## OUT_OF_MVP schema (chrome hidden; modules still imported)

| Prisma model | Table | Status | Drop later? |
| --- | --- | --- | --- |
| `CoPilotThread` | `co_pilot_threads` | KEEP | DROP_CANDIDATE when Co-Pilot drop is authorized |
| `CoPilotMessage` | `co_pilot_messages` | KEEP | same family |
| `CoPilotMessageFeedback` | `co_pilot_message_feedback` | KEEP | same family |
| `CoPilotSlotSession` | `co_pilot_slot_sessions` | KEEP | same family |
| `CoPilotInteractionLog` | `co_pilot_interaction_logs` | KEEP | same family |
| `CreatorCoPilotThread` | `creator_co_pilot_threads` | KEEP | DROP_CANDIDATE when Creator Co-Pilot drop is authorized |
| `CreatorCoPilotMessage` | `creator_co_pilot_messages` | KEEP | same family |
| `CreatorCoPilotMessageFeedback` | `creator_co_pilot_message_feedback` | KEEP | same family |
| `CreatorCoPilotSlotSession` | `creator_co_pilot_slot_sessions` | KEEP | same family |
| `CreatorCoPilotInteractionLog` | `creator_co_pilot_interaction_logs` | KEEP | same family |
| Marketplace-era tables (`20260624120000_creator_marketplace`) | mixed / C-03 still uses some apply paths | KEEP | classify per-table on a later run; do not family-drop |

## How the next amendment uses this file

1. Re-read INV-13 writer proof. If a leftover write is live again, that is a breaker, not a drop.
2. For each row: keep `KEEP`, or move to `DROP_CANDIDATE` with a reason, or `DROPPED_WITH_AUTHORITY` only with dummy_tcs/Parent + a named migration.
3. Append a line to **Review log**.
4. Do not migrate `thecreatorshop`. Do not drop on `freeze_mvp_canonical_v1` as cleanup.
5. Production-data authority is required before any drop that could exist in AWS.
