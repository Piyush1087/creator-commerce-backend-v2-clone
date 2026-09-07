# C04 Brand Payouts lineage implementation handoff

Status: `COMPLETE`

## Immutable binding

- C04 base SHA: `fc4d4b59e2a44d7ddced6bc5dde5119c501ec275`
- C04 base tree: `083c52dc06c19a23f47491935b472ee5e62bd1c5`
- V3 evidence commit: `ce3865ca5adb17063df5ef59824a3a97dfc4ede8`
- implementation source commit: `5a4f70075da13f9e49bdc501097fe0f571c3f405`
- implementation source tree: `a02866045c4ba70ed9012e47c9e7ee285a213ac5`
- migration identity: `20260911125000_c04_brand_payouts_reserve_entitlement_lineage`
- migration SQL SHA-256 (Git-canonical raw bytes): `6e384abdaf7cf9fa35973ca31e1a5cb541f60bd328937ff3d27844b9dfdb4d72`
- superseded reported migration SHA-256: `aa5c1900d06a1c240413be547f8ebe23b933085f93c766b51fdd2933bf91da0f` (metadata error; not a durable Git-object hash)
- migration count: `84 -> 85`

## Implemented invariant

Migration 85 adds the frozen C04 reserve-to-confirmation-to-entitlement lineage. Canonical confirmations bind the reserve instruction, commercial agreement, escrow lock, reserve ledger transaction, Brand, campaign, Creator, amount, currency, approval reference, and execution-attempt reference. Deferred database validation requires the final APPLIED confirmation, financial-authority projection, and canonical event to agree at commit. Append-only guards protect completed reserve instructions, canonical confirmations, and canonical entitlements.

The submitted amount is stored as a canonical `VARCHAR(15)` decimal string and constrained before any numeric coercion. The accepted form is `^(0|[1-9][0-9]{0,11})\.[0-9]{2}$`, with numeric positivity and a maximum of `999999999999.99`. Runtime input is normalized with `Prisma.Decimal(...).toFixed(2)` before hashing and persistence. This prevents the superseded `DECIMAL(14,2)` behavior from converting `125.251` to `125.25` before the scale check while retaining exact two-decimal economics and lossless replay/digest comparison.

## Proof results

| Gate | Result |
| --- | --- |
| Decimal non-rounding | `125.25` committed; direct SQL `125.251` rejected with `C04_FUNDING_LINEAGE_MISMATCH`; rejected row count `0`; maximum format/range checks both true |
| Fresh migration | all 85 committed migrations applied to owned disposable PostgreSQL |
| Populated upgrade | migration 84 state seeded, migration 85 applied; legacy confirmation remained `LEGACY_UNRECONCILED/LEGACY_APPLIED`; legacy authority remained `LEGACY_UNRECONCILED` with nullable lineage |
| Direct SQL negatives | false APPLIED, cross-Collaboration substitution, reserve update/delete, and completed-reserve supersession rejected; canonical entitlement accepted; entitlement update/delete rejected |
| Concurrency/replay | two independent connections raced the same confirmation identity; loser blocked then hit uniqueness after winner commit; authority count `1`, event count `1`; P2002 replay winner is reread and compared without a second mutation/broadcast |
| Lineage/supersession | exact reserve/agreement/Brand/campaign/Creator/lock/ledger/amount/currency projection enforced; completed reserve cannot be superseded |
| RBAC/cross-Brand | existing C04 Owner/Manager/Assistant authority tests passed; Brand-2 confirmation against Brand-1 reserve was rejected with zero rows |
| Rollback/retry | forced migration-85 failure left new-column count `0`; failed migration recorded; after `migrate resolve --rolled-back`, retry applied and status was current |
| Focused tests | 41/41 unit/contract tests and 6/6 isolated PostgreSQL runtime tests passed |
| Schema/build | Prisma format, validate, generate and Nest production build passed |
| Startup | built AppModule started on loopback; `/`, `/health/live`, and `/health` returned HTTP 200; database reported `up`; process stopped cleanly |

Both fresh and populated databases reported all 85 migrations applied and current. A full Prisma database-to-schema diff also reported the repository's pre-existing physical-name and unrelated historical drift; it reported no missing C04 migration-85 column, relation, constraint, trigger, enum, or index. The only C04-table entries were names for two indexes that predate migration 85, so no unrelated rename migration was introduced.

## Scope and safety

Only the bounded C04 schema, additive migration 85, collaboration runtime, focused tests, and this handoff evidence changed. All database activity used owned loopback disposable PostgreSQL. No provider credential was supplied to a financial provider, no provider method/action was invoked, no AWS or production action occurred, no non-disposable database was mutated, and no canonical merge was performed.

The prior V3 evidence remains authoritative for unchanged inputs. Broad gates were not rerun because the standing authority explicitly directs the lowest sufficient proof after the amount-representation correction.

## Files

- `prisma/migrations/20260911125000_c04_brand_payouts_reserve_entitlement_lineage/migration.sql`
- `prisma/schema.prisma`
- `src/features/collaboration/services/collaboration-trusted-confirmation.service.ts`
- `src/features/collaboration/services/collaboration-trusted-confirmation.service.test.ts`
- `docs/ai-collaboration/evidence/c04-brand-payouts-lineage-implementation/decision-register.json`
- `docs/ai-collaboration/evidence/c04-brand-payouts-lineage-implementation/proof-summary.json`

## Terminal disposition

`COMPLETE_BLOCKER_SET = NONE`

This is a C04 implementation handoff only. It does not accept or merge the branch and does not begin P3A, P3S, generalized recovery, provider-enabled P6, AWS, production, or canonical deployment work.
