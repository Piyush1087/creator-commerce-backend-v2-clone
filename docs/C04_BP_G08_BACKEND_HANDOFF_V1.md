# C04_BP_G08_BACKEND_HANDOFF_V1

Status: READY FOR C-04 SA FINAL BACKEND HANDOFF REVIEW

## Tested implementation identity

- Backend implementation SHA: `373eaa382f555c376df78c0e95c72ff55cc43791`
- Backend implementation tree: `bd5c3c9570adeeacf2f35df8c4a399637e7bd312`
- Branch: `c04/shared-collaboration-backend-v1`
- Migration count: 84
- Campaign BP-G05 backend authority: `2c390802a4cebd7e6ce5086c7609774b1ff3f3d1`
- Campaign BP-G05 durable handoff: `7901c7743ac1bb46b6ed4f74b768998dbebd28f4`
- Campaign/C-04 topology: divergent descendants of `4c5f42858b950b7cd342f8972f99f548f3daa942`

No Campaign commit was merged or cherry-picked wholesale. Its bounded contract delta was adapted onto the C-04 line.

## Exact Campaign term preservation

`NET_7`, `NET_15`, `NET_30`, `NET_45`, and `NET_60` persist and read back as distinct relational values. The historical `NET_45`/`NET_60` correction is restricted to immutable `canonical_definition.commercials.payout_terms` evidence. Unproven historical `NET_30` rows remain unchanged. `IMMEDIATE` is rejected at the canonical C-04 agreement boundary.

Forward migrations:

1. `20260911123000_c04_bp_g05_extend_exact_payout_terms`
2. `20260911124000_c04_bp_g05_reconcile_exact_payout_terms`

Migrations 1–82 are unchanged.

## Brand Payouts BP-G08 contract

C-04 now durably publishes:

- commercial agreement ID, version, SHA-256 hash, exact Campaign payment term, fee, currency, commission, GST, and reserve economics;
- append-only reserve instructions with request/instruction identity, version, hash, Brand/Campaign/Creator lineage, agreement provenance, caller-independent economics, idempotency, and supersession;
- append-only Creator entitlement and Brand refund-entitlement authority;
- immutable `settlementEligibleAt`, distinct from downstream-owned `paymentDueAt`;
- abnormal-resolution and partial/full financial-recovery instructions with agreement/resolution provenance and effects;
- the existing provider-neutral trusted-confirmation seam for reserve, obligation, processing, settlement, reversal, and recovery confirmations.

Campaign Managers may publish the canonical reserve instruction but do not execute the financial-domain reserve operation. Brand Owner/Finance authority remains downstream. C-04 does not calculate `paymentDueAt` and does not create a second ledger, payout, transfer, reversal, or reconciliation engine.

## Acceptance evidence

- Prisma generate/validate: PASS
- Fresh 0→84: PASS
- Accepted 82→84: PASS
- Legacy-shaped 82→84: PASS
- Five-term relational round-trip and exact evidence-only reconciliation: PASS
- Unproven NET_30 preservation: PASS
- Append-only reserve/financial instruction guards: PASS
- Focused BP-G05/BP-G08 tests: 19 PASS
- C-04 real PostgreSQL affected suite: 6 PASS
- Full backend: 6,233 PASS / 771 guarded
- Build and startup/API smoke: PASS (`/health` 200, `/` 200)
- Changed-file lint/format and candidate secret scan: PASS

Prior frontend SHA `106de9988ea2d4bd534205b083f63ae7ecd1878c` is unchanged. The continuation adds internal, backward-compatible backend persistence and event metadata only; prior F1, browser, PDF, and lint evidence remains authoritative.

## Known nonblocking debt

- Historical canonical Collaborations without an exact relational Campaign term remain compatibility-only and fail closed at new financial-authority boundaries.
- Existing repository-wide Prisma drift diagnostics include accepted pre-existing constraint/index naming differences; the new migration was independently proven through fresh and upgrade replay.

## Explicit exclusions

- Development branch mutation: none
- AWS calls: none
- Production access: none
- Live provider calls: none

Next authorized boundary: `C04_SA_FINAL_BACKEND_HANDOFF_REVIEW_ONLY`.
