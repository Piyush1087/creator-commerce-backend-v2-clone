# DE-W2 capability CHECK compatibility migration

Approved decision: DE_W2_SEVEN_CONSTRAINT_MIGRATION_APPROVED.

Migration: 20260826180000_data_extraction_wave2_supported_capabilities.
Baseline: development@892d86efb414aeb34674b86df53cb35bf56cb261.
Historical migration 20260825181500_add_data_extraction_wave1_evidence_persistence
is unchanged. prisma/schema.prisma is unchanged: capability IDs already use
String/VARCHAR, not a Prisma enum.

## Bounded DDL

One transaction replaces exactly seven CHECK constraints using DROP CONSTRAINT
and ADD CONSTRAINT. No table, column, enum, index, FK, row value or identity
changes. Existing rows remain valid because the old five IDs remain accepted.
The new checks use explicit IN lists; no prefix matching or unchecked fallback.

| Table suffix (data_extraction_) | Removed | Replacement |
| --- | --- | --- |
| capability_executions | ck_de_capexec_wave1_capability | ck_de_capexec_supported_capability |
| capability_resources | ck_de_capresource_wave1_capability | ck_de_capresource_supported_capability |
| evidence_items | ck_de_evidence_wave1_capability | ck_de_evidence_supported_capability |
| capability_evidence | ck_de_capevidence_wave1_capability | ck_de_capevidence_supported_capability |
| semantic_observations | ck_de_observation_wave1_capability | ck_de_observation_supported_capability |
| observation_support | ck_de_obs_support_wave1_capability | ck_de_obs_support_supported_capability |
| observation_relations | ck_de_obs_relation_wave1_capability | ck_de_obs_relation_supported_capability |

Every check accepts exactly:

- owned_website.brand_messaging
- owned_website.brand_company_context
- owned_website.offering_context
- observed_brand_communication_language_signals
- derived_communication_constraint_evidence
- explicit_factual_proof_or_claim_evidence
- owned_website.visual_evidence
- owned_website.serviceability_evidence
- owned_website.location_evidence

Imagery, graphic-treatment, social, Similarweb and all other IDs remain rejected.

## Verification and operational considerations

scripts/verify-de-wave2.ps1 copies the 48 historical migrations into a uniquely
created temporary directory without changing repository migration history. It
deploys those to its own disposable local database. The migration integration test
populates every DE persistence table with representative W1 rows and deploys the
49th migration through Prisma. Before/after JSON row snapshots, xmin and ctid
prove no data/identity/tuple rewrite; all FK definitions are compared unchanged.
All nine IDs are inserted through all seven tables. Each table rejects five
unapproved/deferred IDs specifically with CHECK violation 23514; composite
capability and cross-Brand FK violations remain rejected.

The harness then resets its exact disposable database, applies all 49 migrations
from empty, and repeats current-constraint checks alongside the requested suite.
No production connection is used, and temporary database, role and copied
migration directory are removed. All schema deployment remains manual.
Integration files run serially with fixture-row isolation between files so existing
global BI queue claims cannot consume another test file's pending work. This
test-only cleanup verifies the exact disposable URL/role/database and retains all
migration records, CHECK constraints and foreign keys.

ALTER TABLE constraint validation acquires PostgreSQL table locks and validates
existing rows. This branch does not deploy to production or prescribe its timing.
Code rollback may disable W2 use while leaving the expanded closed checks in
place. Reinstating the old five-ID checks after W2 rows exist would reject those
rows; no automatic destructive data rollback is supplied.
