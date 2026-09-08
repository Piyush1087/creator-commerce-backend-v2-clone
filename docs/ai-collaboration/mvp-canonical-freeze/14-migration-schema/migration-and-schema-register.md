# Migration and schema register (§14)

**Canonical Prisma source:** `growth-verse/creator-commerce-backend-v2` `prisma/schema.prisma`  
**Migrations directory:** `prisma/migrations/`  
**Freeze branch (RUN 1 tip):** `13a1dedc0ead8eef24a27c48067364258119b0fc`  
**Date:** 2026-09-08

There is one schema file. No second Prisma project in the canonical backend.

## Migration count and head

```text
MIGRATION_COUNT = 87
FIRST = 20260514180000_init_discovery_and_users
HEAD  = 20260910122000_c03_application_handoff_notifications
```

Folder names are unique (no duplicate migration identities). One early folder has no descriptive suffix: `20260515060635`.

## Accepted-module migrations present

| Area | Representative migrations |
| --- | --- |
| Gatekeeper | `20260820120000_gatekeeper_submission_audit`, `20260821120000_gatekeeper_recovery_requests` |
| Brand Preview | `20260822120000_brand_preview_runtime` |
| Brand Centre / PI / DE | `20260826140000_brand_centre_canonical_state`, `20260827223000_product_intelligence_v1_canonical_offering_foundation`, DE wave migrations |
| Brand Settings / escrow / pricing / auth | `20260828121000_bs03_billing_profile` through `20260907120000_bs12_auth_security` |
| C-01 | `20260908120000_c01_i1_organization_workspace_foundation` … `20260908123000_c01_i1_campaign_continuation` |
| C-05 | `20260909120000_c05_p0_team_user_identity` … `20260909123000_c05_p0_payout_destination` |
| C-03 | `20260910120000_c03_campaign_asset_brief_convergence` … `20260910122000_c03_application_handoff_notifications` |
| Collaboration Brand | `20260811130000_collaboration_phase_1_foundation` through Phase 4.7 |

Deferred C-02A / C-04 / Brand Payouts v1 migrations are **not** required on this freeze because those modules are not pulled.

## Destructive operations

No `DROP TABLE` found in `prisma/migrations/**/migration.sql`. Early `DROP COLUMN` exists on `users`/`organizations` (`20260515060635`, `20260525093955_remove_user_hashed_password`) — historical, already in chain.

Co-Pilot tables remain. Schema drop is **not** this checkpoint.

## Unused / OUT models (still in schema)

Classify, do not drop this run:

| Models | Disposition |
| --- | --- |
| `CoPilotThread` `CoPilotMessage` `CoPilotMessageFeedback` `CoPilotSlotSession` `CoPilotInteractionLog` | OUT_OF_MVP |
| Marketplace-era tables from `20260624120000_creator_marketplace` | OUT_OF_MVP / C-03 mixed |
| Duplicate collab: `UceCampaignCollaboration*` vs `Collaboration*` | UNKNOWN_REQUIRES_REVIEW |
| Duplicate money identity: `CreatorBankDetails` vs `CreatorPayoutDestination` vs `CreatorSettlementProfile` | UNKNOWN_REQUIRES_REVIEW |

## Prisma validate (this run)

```text
npx prisma validate
RESULT = PASS
The schema at prisma/schema.prisma is valid
DATE   = 2026-09-08
```

## Fresh empty database `0 → head`

```text
STATUS = NOT_PROVEN_ON_DISPOSABLE_DB
CLASS  = ENVIRONMENT_BLOCKED until a disposable Postgres is migrated
```

Command the later validation run must use (local/disposable only):

```text
npx prisma migrate deploy
npx prisma validate
```

Application boot against migrated DB is part of §18, not this register.

## Production-data posture (no AWS inspection)

```text
FRESH_DB_EXPECTED                     = AWS-dev greenfield is an AWS-worker choice, not assumed
HISTORICAL_DATA_RECONCILIATION_REQUIRED = possible if AWS worker targets an existing RDS
PRODUCTION_DB_STATE_UNKNOWN           = THIS FREEZE POSTURE
```

Do not silently assume a destructive fresh start on any existing production database. That is an AWS/release gate.

## Seed vs production

Seeds (`npm run db:seed:dev-creator`, `db:seed:dev-c03-opportunity`) are **local/dev fixtures**, not production data. `CREATOR_APPLY_BYPASS_EMAILS` is a QA targeting bypass — must be empty in production unless intentionally enabled (see security register).
