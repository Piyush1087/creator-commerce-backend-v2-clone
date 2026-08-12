# Phase F4 — Consolidated Schema Migration Audit

## Scope
Baseline: `b8360dfd0cd9ea5d326ec5890e2139c9b9975281`

Target schema/runtime authority: `7e346185b009f618bbfc02c3c8cbae143c10e1fe`

This migration is a **dev/pre-production artifact**. It is not approved for direct production application.

## Generated migration profile
The Prisma schema diff is additive overall: new Campaign/Collaboration canonical enums, tables, columns, indexes, and foreign keys are introduced while legacy Product/Brief/Collaboration/reporting structures remain present.

## Safety corrections applied in F4
1. Prisma generated a destructive drop/re-add for `uce_campaign_targeting.audience_gender` while changing String → enum. F4 replaces that with an in-place explicit enum cast so existing values are preserved. Unexpected historical values intentionally fail for manual review rather than being silently coerced.
2. Added the database-level `uce_campaign_assets_exactly_one_reference_check` required by the canonical Campaign Asset contract.

## Deliberately retained migration debt
- Existing Campaign × Creator Collaboration uniqueness remains in place during this transitional migration. `source_application_id` is added and unique, but removal of the old uniqueness constraint waits for lineage/backfill review.
- Canonical Application Asset/Brief foreign keys are nullable; no legacy Product/Brief ID is copied into a canonical FK.
- Collaboration canonical Asset/Brief references are nullable for the same reason.
- Existing Campaign rows receive compatibility defaults for newly added canonical fields. These defaults are not evidence that historic records were semantically backfilled.
- Existing Collaboration rows receive compatibility defaults for canonical lifecycle/stage fields. Historic stage/lifecycle backfill remains separate work.
- Legacy Campaign Product/Brief, reporting snapshots, UCE Collaboration, legacy Collaboration children, Escrow and payout structures are not dropped.
- No historical Product → Offering/Offer mapping is fabricated.
- No financial ledger, escrow balance, payout evidence, or settlement history is rewritten.

## F5 rule
Apply this migration first only to a safe dev/test PostgreSQL target. Before production migration, the developer must independently inspect real data, lineage, legacy enum values, backfill requirements, constraint timing, and financial records.
