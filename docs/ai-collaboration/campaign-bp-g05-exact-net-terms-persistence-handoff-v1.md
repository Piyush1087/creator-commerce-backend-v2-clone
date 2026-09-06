# Campaign BP-G05 exact NET-term persistence handoff v1

## A. Authority and baseline

- Repository: `Piyush1087/creator-commerce-backend-v2-clone`
- Canonical engineering branch: `development`
- Verified remote canonical head before correction: `4c5f42858b950b7cd342f8972f99f548f3daa942`
- Verified pre-correction tree: `5f9b82c09abfe021e2421a0e8debea6ac777429d`
- Historical accepted floor `f7eb11bc72051f034f7d46ff2ad5c6b4d4b9e0fd` is an ancestor of that head.
- Bounded branch: `campaign/bp-g05-exact-net-terms-persistence`
- Pre-correction migration count: 74
- Pre-correction migration head: `20260909123000_c05_p0_payout_destination`
- Pre-correction worktree: clean
- Tested Campaign backend checkpoint: `2c390802a4cebd7e6ce5086c7609774b1ff3f3d1`

`BRANCHING.md` identifies `development` as the integration authority. No authority drift was found.

## B. Pre-mutation lossiness matrix

| Location | Input | Current output before correction | Lossy | Correction required |
| --- | --- | --- | --- | --- |
| `validation/shared/campaign.shared.schema.ts` canonical create/edit schema | Five canonical NET terms | Same accepted value | No | No |
| `canonical-campaign-wizard.schema.ts` | Five canonical NET terms | Same accepted value | No | No |
| `canonical-campaign-draft.schema.ts` | Five canonical NET terms | Same accepted value | No | No |
| `uce-wizard.schema.ts` compatibility create DTO | `NET_45`, `NET_60` | Rejected as unsupported | Yes | Yes |
| `prisma/schema.prisma` `UcePayoutTerms` | `NET_45`, `NET_60` | No relational enum label | Yes | Yes |
| Initial UCE migration | `NET_45`, `NET_60` | No relational enum label | Yes | Add a new migration; do not rewrite history |
| `canonical-campaign-create.service.ts` publish mapper | `NET_7` | `NET_7` | No | Replace mapper with exhaustive identity mapping |
| `canonical-campaign-create.service.ts` publish mapper | `NET_15` | `NET_15` | No | Replace mapper with exhaustive identity mapping |
| `canonical-campaign-create.service.ts` publish mapper | `NET_30` | `NET_30` | No | Replace mapper with exhaustive identity mapping |
| `canonical-campaign-create.service.ts` publish mapper | `NET_45` | `NET_30` | Yes | Yes |
| `canonical-campaign-create.service.ts` publish mapper | `NET_60` | `NET_30` | Yes | Yes |
| Canonical definition serializer | Five canonical NET terms | Exact input value | No | No |
| `BrandUceCampaignService.createCampaign` | Accepted compatibility DTO term | Direct relational value | No | DTO/Prisma enum expansion only |
| `BrandUceCampaignService.getCampaignShell` REST/read projection | Stored relational term | Exact stored term | No | No |
| `duplicateCampaign` | Stored relational term | Exact copied term | No | No |
| Campaign Page read model | Payment term | Not exposed by that projection | N/A | No; details/shell path remains authoritative |
| Collaboration provisioning/thread mapping | Campaign payment term | Not currently projected or transformed | No | No C-04 modification in BP-G05 |
| Brand Centre bridge fixture | No selectable term; explicit compatibility default | `NET_30` | No input is lost | No |
| Co-pilot HITL fixture | Explicit `NET_15` | `NET_15` | No | No |
| Raw SQL / seed / fixture search | Five canonical NET terms | No additional normalization rule found | No | No |
| `docs/validation-reference.md` | Enum documentation | Omitted `NET_45`, `NET_60` | Yes, documentation only | Yes |

The complete search covered `prisma/`, `src/`, `test/`, `tests/`, `scripts/`, `fixtures/`, `seed/`, and `docs/` for `UcePayoutTerms`, payment/payout field variants, every NET label, canonical-definition fields, raw SQL, defaults, switches, and fallbacks. No additional `NET_45`/`NET_60` to `NET_30` conversion was found.

## C. Exact files changed at tested backend checkpoint

- `prisma/schema.prisma`
- `prisma/migrations/20260910120000_campaign_bp_g05_extend_payout_terms/migration.sql`
- `prisma/migrations/20260910121000_campaign_bp_g05_reconcile_exact_payout_terms/migration.sql`
- `src/features/brand-uce/services/canonical-campaign-create.service.ts`
- `src/features/brand-uce/services/canonical-campaign-create.service.test.ts`
- `src/features/brand-uce/services/canonical-campaign-payout-terms.integration.test.ts`
- `src/features/brand-uce/schemas/uce-wizard.schema.ts`
- `src/features/brand-uce/schemas/uce-wizard.payout-terms.test.ts`
- `src/features/brand-intelligence/offering-factual.architecture.test.ts` (migration-count invariant only; no Product logic)
- `docs/validation-reference.md`

No Product logic, Brand Payouts code, C-04 code, provider code, or unrelated schema was changed.

## D. Migration identity, schema delta, and SQL

The migration is split because PostgreSQL enum labels added in one migration transaction must be committed before a later migration safely uses them in data updates.

1. `20260910120000_campaign_bp_g05_extend_payout_terms`
   - SQL SHA-256: `02fb0645cd10f26e1f219a0d36a927475507d3ba4ca7b0a73df4523b0428714e`
2. `20260910121000_campaign_bp_g05_reconcile_exact_payout_terms`
   - SQL SHA-256: `6d00cdf0dc80e01d7213c497a758fe3c4b10cdf0c2869f744ba8ec4c036b34a7`

Schema delta:

```prisma
enum UcePayoutTerms {
  IMMEDIATE
  NET_7
  NET_15
  NET_30
  NET_45
  NET_60
}
```

Complete enum-extension SQL:

```sql
ALTER TYPE "UcePayoutTerms" ADD VALUE IF NOT EXISTS 'NET_45';
ALTER TYPE "UcePayoutTerms" ADD VALUE IF NOT EXISTS 'NET_60';
```

Complete exact-evidence reconciliation SQL:

```sql
UPDATE "uce_campaign_commercials" AS commercials
SET "final_balance_terms" = 'NET_45'::"UcePayoutTerms"
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}' = 'NET_45';

UPDATE "uce_campaign_commercials" AS commercials
SET "final_balance_terms" = 'NET_60'::"UcePayoutTerms"
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}' = 'NET_60';
```

Both migrations are additive. They contain no enum deletion, table recreation, mass default conversion, or inferred historical rewrite.

## E. Historical reconciliation evidence

For published canonical Campaigns, `canonical_definition` is written as the accepted complete definition at publish. The audited runtime has no post-publication canonical-definition edit path. Draft autosave mutates only DRAFT definitions before relational Campaign commercials exist. Therefore an exact published `commercials.payout_terms` value of `NET_45` or `NET_60` is accepted immutable canonical Campaign evidence for this bounded reconciliation.

Eligibility before mutation is exactly:

```sql
SELECT campaign."id",
       campaign."canonical_definition" #>> '{commercials,payout_terms}' AS canonical_value,
       commercials."final_balance_terms" AS relational_value
FROM "uce_campaigns" campaign
JOIN "uce_campaign_commercials" commercials
  ON commercials."campaign_id" = campaign."id"
WHERE commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}'
      IN ('NET_45', 'NET_60');
```

Disposable PostgreSQL fixtures proved:

| Canonical evidence | Before | After |
| --- | --- | --- |
| `NET_45` | `NET_30` | `NET_45` |
| `NET_60` | `NET_30` | `NET_60` |
| Absent/unproven | `NET_30` | `NET_30` (untouched) |

No shared, staging, or production database was queried or mutated.

## F. Rollback and recovery

- **Schema rollback:** retain additive `NET_45` and `NET_60` enum labels. Routine PostgreSQL enum-label removal is destructive and is not an approved rollback.
- **Service rollback:** reverting to the lossy service is unsafe while exact rows exist. Roll forward is preferred. Any emergency application rollback must retain readers/generated clients that accept all enum labels.
- **Historical data rollback:** no rollback was executed. Before reconciliation, every eligible fixture's exact relational value was captured as `NET_30`; a separately approved recovery could restore only rows selected by the same exact canonical evidence predicate. Unknown rows must never be changed.

## G. Five-term pre/post matrix

| Input | Pre canonical definition | Pre relational/readback | Pre result | Post canonical definition | Post relational/readback | Post result |
| --- | --- | --- | --- | --- | --- | --- |
| `NET_7` | `NET_7` | `NET_7` | EXACT | `NET_7` | `NET_7` | EXACT |
| `NET_15` | `NET_15` | `NET_15` | EXACT | `NET_15` | `NET_15` | EXACT |
| `NET_30` | `NET_30` | `NET_30` | EXACT | `NET_30` | `NET_30` | EXACT |
| `NET_45` | `NET_45` | `NET_30` | LOSSY | `NET_45` | `NET_45` | EXACT |
| `NET_60` | `NET_60` | `NET_30` | LOSSY | `NET_60` | `NET_60` | EXACT |

Pre-correction PostgreSQL enum inspection returned only `IMMEDIATE`, `NET_7`, `NET_15`, and `NET_30`. Post-correction inspection returned those four labels plus distinct `NET_45` and `NET_60` labels.

## H. Validation evidence

- Clean npm install: dependency tree valid (`npm 11.17.0`, Node `v24.19.0`).
- Prisma generate: passed.
- Prisma validate: passed.
- Existing 74 migrations applied successfully to a clean PostgreSQL 16 database before correction.
- Upgrade validation: both BP-G05 migrations applied successfully over that database.
- Fresh validation: all 76 migrations applied successfully to a second empty PostgreSQL 16 database.
- Migration status: up to date in both disposable databases.
- Focused BP-G05 and canonical validation suite: 4 files, 22 tests passed.
- Campaign readiness suite: 4 files, 28 tests passed.
- Fresh PostgreSQL round-trip suite: 1 file, 6 tests passed.
- Full repository Vitest suite: 186 files / 1,245 tests passed; 44 files / 610 opt-in tests skipped; zero failures.
- Build (`nest build` plus prompt asset copy): passed.
- Changed BP-G05 TypeScript files: zero TypeScript errors and focused ESLint passed.
- Repository-wide standalone `tsc --noEmit`: remains red with 137 unrelated errors already present at the pre-correction SHA.
- Repository-wide lint: remains red with 1,010 unrelated formatting errors already present at the pre-correction SHA.

The baseline worktree at `4c5f42858b950b7cd342f8972f99f548f3daa942` independently reproduced the same 137 typecheck errors and 1,010 lint errors. They are not BP-G05 regressions and were not modified.

## I. Downstream consumption

Campaign now persists and reads every canonical NET term exactly. A downstream C-04/Collaboration integration may snapshot `UceCampaignCommercials.finalBalanceTerms` directly without compatibility inference. BP-G05 does not alter C-04 or Brand Payouts behavior.

## J. Blast radius

```text
FILES_CHANGED = 11 (6 modified, 5 added including this handoff)
FILES_ADDED = 5
MIGRATIONS_ADDED = 2
UNRELATED_FILES_CHANGED = NONE

CAMPAIGN_PRODUCT_LOGIC_CHANGED = NO
PAYOUTS_CODE_CHANGED = NO
C04_CODE_CHANGED = NO
PROVIDER_CODE_CHANGED = NO
UNRELATED_SCHEMA_CHANGED = NO
```

`offering-factual.architecture.test.ts` changed only its exact repository migration-count invariant from 74 to 76. Product schema and Product Intelligence behavior remain unchanged.

CAMPAIGN_BP_G05_HANDOFF

STATUS = ACCEPTED

CAMPAIGN_BACKEND_SHA = 2c390802a4cebd7e6ce5086c7609774b1ff3f3d1
CAMPAIGN_MIGRATION_IDENTITY = 20260910120000_campaign_bp_g05_extend_payout_terms + 20260910121000_campaign_bp_g05_reconcile_exact_payout_terms
CAMPAIGN_ACCEPTANCE_SHA = 2c390802a4cebd7e6ce5086c7609774b1ff3f3d1

NET_7 = EXACT
NET_15 = EXACT
NET_30 = EXACT
NET_45 = EXACT
NET_60 = EXACT

LOSSY_NET_45_TO_NET_30_MAPPING = REMOVED
LOSSY_NET_60_TO_NET_30_MAPPING = REMOVED

HISTORICAL_RECONCILIATION =
ONLY_WHERE_IMMUTABLE_CANONICAL_EVIDENCE_PROVES_EXACT_TERM

C04_MAY_SNAPSHOT_EXACT_TERM =
YES

BRAND_PAYOUTS_BP_G05 =
SATISFIED

REMAINING_BLOCKERS = NONE
PROVIDER_ACTIONS = NONE
