# CAMPAIGN_BP_G05_DEVELOPER_HANDOFF_V1

Status: **ACCEPTED — DEVELOPER INTEGRATION NOTICE**

## 1. Purpose

This handoff covers the bounded Campaign correction completed for Brand Payouts gate BP-G05.

Campaign already accepted five canonical payout terms, but its PostgreSQL enum and canonical publish mapper did not preserve `NET_45` and `NET_60` exactly. The correction makes all five canonical terms persist and round-trip without loss:

```text
NET_7
NET_15
NET_30
NET_45
NET_60
```

This is a backend-only compatibility and persistence correction. It does not change Campaign Product behavior, frontend behavior, Brand Payouts runtime logic, provider integration, or C-04 Product logic.

## 2. Source authority

```text
Repository = Piyush1087/creator-commerce-backend-v2-clone
Canonical integration branch = development
Pre-correction development SHA = 4c5f42858b950b7cd342f8972f99f548f3daa942
Pre-correction tree = 5f9b82c09abfe021e2421a0e8debea6ac777429d

Bounded correction branch = campaign/bp-g05-exact-net-terms-persistence
Tested runtime SHA = 2c390802a4cebd7e6ce5086c7609774b1ff3f3d1
Accepted handoff SHA = 7901c7743ac1bb46b6ed4f74b768998dbebd28f4
Accepted tree = d255ebb2c8458326c7d3fb473a325057ccfa5b4f
```

Detailed acceptance evidence:

- [Campaign BP-G05 exact NET-term persistence handoff](https://github.com/Piyush1087/creator-commerce-backend-v2-clone/blob/7901c7743ac1bb46b6ed4f74b768998dbebd28f4/docs/ai-collaboration/campaign-bp-g05-exact-net-terms-persistence-handoff-v1.md)
- [Tested runtime commit](https://github.com/Piyush1087/creator-commerce-backend-v2-clone/commit/2c390802a4cebd7e6ce5086c7609774b1ff3f3d1)
- [Accepted docs commit](https://github.com/Piyush1087/creator-commerce-backend-v2-clone/commit/7901c7743ac1bb46b6ed4f74b768998dbebd28f4)

## 3. What changed

| Boundary | Before | Accepted behavior |
| --- | --- | --- |
| Prisma `UcePayoutTerms` enum | No `NET_45` or `NET_60` | Both labels added additively |
| Canonical Campaign publish mapper | `NET_45/60` became `NET_30` | Exhaustive identity mapping |
| Compatibility Campaign DTO | Rejected `NET_45/60` | Accepts all five canonical terms |
| Historical affected rows | Exact canonical evidence could disagree with relational `NET_30` | Reconciled only where immutable canonical evidence proves `NET_45` or `NET_60` |

Existing canonical validation, canonical-definition serialization, Campaign shell readback, and Campaign duplication were already identity-preserving.

The PostgreSQL enum retains `IMMEDIATE` for compatibility. `IMMEDIATE` is not a canonical selectable NET term and must continue to fail closed at downstream financial-authority boundaries.

## 4. Exact Campaign migrations

Campaign migration count changed from 74 to 76.

Apply these migrations in order:

1. `20260910120000_campaign_bp_g05_extend_payout_terms`
   - SHA-256: `02fb0645cd10f26e1f219a0d36a927475507d3ba4ca7b0a73df4523b0428714e`
2. `20260910121000_campaign_bp_g05_reconcile_exact_payout_terms`
   - SHA-256: `6d00cdf0dc80e01d7213c497a758fe3c4b10cdf0c2869f744ba8ec4c036b34a7`

Do not combine the two migrations. PostgreSQL requires the enum-extension transaction to commit before the new labels are used by reconciliation SQL.

Do not rewrite an accepted historical migration. Do not remove the additive enum labels during rollback. Roll forward is the safe recovery strategy once exact values exist.

## 5. Consolidated C-04 integration rule

The accepted C-04 backend is a divergent descendant of the same pre-correction Campaign base. C-04 adapted the bounded BP-G05 contract delta rather than merging or cherry-picking the Campaign commit wholesale.

```text
C-04 tested runtime SHA = 373eaa382f555c376df78c0e95c72ff55cc43791
C-04 handoff SHA = fc4d4b59e2a44d7ddced6bc5dde5119c501ec275
C-04 migration count = 84
```

Its corresponding forward migrations are:

1. `20260911123000_c04_bp_g05_extend_exact_payout_terms`
2. `20260911124000_c04_bp_g05_reconcile_exact_payout_terms`

Therefore:

- If the developer's consolidated backend target already consumes the accepted C-04 runtime or an accepted descendant, **do not additionally merge/cherry-pick the Campaign BP-G05 branch or apply the Campaign-named migrations**. The correction is already adapted into the C-04 lineage.
- If Campaign BP-G05 is being integrated independently into a target that does not contain the accepted C-04 adaptation, use the Campaign tested runtime delta and the two Campaign-named migrations.
- Never place both migration pairs into the same consolidated migration graph.
- Before integration, prove ancestry and inspect the target migration graph; do not decide by migration count alone.

The C-03 and C-04 developer handoffs remain authoritative for their own module integrations. This document adds the Campaign-specific explanation and does not replace either handoff.

## 6. Files in the tested Campaign runtime delta

```text
prisma/schema.prisma
prisma/migrations/20260910120000_campaign_bp_g05_extend_payout_terms/migration.sql
prisma/migrations/20260910121000_campaign_bp_g05_reconcile_exact_payout_terms/migration.sql
src/features/brand-uce/services/canonical-campaign-create.service.ts
src/features/brand-uce/services/canonical-campaign-create.service.test.ts
src/features/brand-uce/services/canonical-campaign-payout-terms.integration.test.ts
src/features/brand-uce/schemas/uce-wizard.schema.ts
src/features/brand-uce/schemas/uce-wizard.payout-terms.test.ts
src/features/brand-intelligence/offering-factual.architecture.test.ts
docs/validation-reference.md
```

The Brand Intelligence test change updates only the exact migration-count invariant. It does not change Product Intelligence behavior.

## 7. Deployment and verification

Before application deployment:

1. Confirm which integration route applies: Campaign BP-G05 independently or the accepted C-04 adaptation.
2. Confirm only one BP-G05 migration pair exists in the target migration graph.
3. Back up the target database using the normal deployment procedure.
4. Apply migrations through the repository's normal Prisma deployment route.
5. Regenerate the Prisma client.
6. Deploy application code that accepts all resulting enum labels.

After deployment, verify:

- migration status is clean;
- PostgreSQL enum labels are `IMMEDIATE`, `NET_7`, `NET_15`, `NET_30`, `NET_45`, and `NET_60`;
- new Campaigns persist and read back each of the five canonical NET terms exactly;
- duplication preserves the exact term;
- historical reconciliation changes only rows with exact `canonical_definition.commercials.payout_terms` evidence for `NET_45` or `NET_60`;
- an unproven historical `NET_30` row remains unchanged.

No shared development, staging, production, or AWS database was accessed or changed during BP-G05 acceptance. The developer owns environment-specific backup, migration, deployment, and post-deployment verification.

## 8. Accepted evidence

```text
Prisma generate = PASS
Prisma validate = PASS
74 → 76 upgrade migration = PASS
Fresh 0 → 76 migration = PASS
Focused BP-G05 suite = 22/22 PASS
Campaign readiness suite = 28/28 PASS
Fresh PostgreSQL round-trip suite = 6/6 PASS
Full repository suite = 1,245 PASS; 610 existing opt-in tests skipped; 0 failures
Build = PASS
Changed-file ESLint = PASS
Changed-file TypeScript validation = 0 errors
```

Pre-existing repository-wide standalone gates remain red and were reproduced at the pre-correction SHA:

```text
Repository-wide lint = 1,010 existing errors
Standalone tsc --noEmit = 137 existing errors
```

They are not BP-G05 regressions.

## 9. Required developer closeout

Return the following after integration:

```text
CAMPAIGN_BP_G05_DEVELOPER_INTEGRATION_REPORT

TARGET_BRANCH =
PRE_INTEGRATION_SHA =
POST_INTEGRATION_SHA =
POST_INTEGRATION_TREE =

INTEGRATION_ROUTE =
  CAMPAIGN_BP_G05_DIRECT
  | ALREADY_SUBSUMED_BY_ACCEPTED_C04
  | OTHER_EXPLAINED_ROUTE

ANCESTRY_PROOF =
MIGRATION_PAIR_PRESENT =
DUPLICATE_BP_G05_MIGRATIONS_ABSENT =
DATABASE_BACKUP_STATUS =
MIGRATION_STATUS =
PRISMA_GENERATE =
BUILD =
FIVE_TERM_POSTGRESQL_ROUND_TRIP =
HISTORICAL_RECONCILIATION_PROOF =
UNPROVEN_NET_30_PRESERVED =
FRONTEND_CHANGE = NONE
PROVIDER_ACTION = NONE
PRODUCTION_OR_AWS_ACTIONS =
REMAINING_BLOCKERS =
```

## 10. Handoff conclusion

```text
CAMPAIGN_BP_G05_STATUS = ACCEPTED
DEVELOPER_NOTIFICATION_REQUIRED = YES
SEPARATE_FRONTEND_INTEGRATION = NO
SEPARATE_PROVIDER_INTEGRATION = NO
DUPLICATE_APPLICATION_WITH_C04 = PROHIBITED
```
