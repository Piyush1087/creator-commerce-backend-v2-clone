# Canonical reconciliation migration-94 fixture V1

This directory contains the deterministic, synthetic input fixture for the canonical reconciliation migration-upgrade gate. It is pinned to backend freeze commit `129b291ecbca4a1e79451215a81726000cfb5bff`, tree `9fe6585addf8d8ccee9973b9b55cc0312c6e2b0b`, where the ordered Prisma inventory contains exactly 94 migrations.

The fixture contains no production, staging, customer, creator, brand, provider, token, credential, secret, or personal data. Reserved `.invalid` domains, fixed UUIDs in the `94000000-...` namespace, fixed timestamps, fictional text, and synthetic hashes are used throughout.

## Preconditions and load

Use a fresh disposable PostgreSQL 16 database. Check out the pinned freeze, install from the lockfile, apply only the migrations present at that commit, confirm that exactly 94 migrations finished, and then load the SQL with fail-fast behavior:

```sh
npm ci
npm run db:migrate:deploy
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" \
  -f test/fixtures/canonical-reconciliation/migration-94/canonical_migration_94_fixture_v1.sql
```

Do not load this file into a shared, production, staging, developer, or populated database. Do not run migrations 95-106 as part of Gate A0. The SQL uses a single transaction and is intentionally not idempotent: a second load must fail rather than conceal a non-clean test database.

Verify the SQL file against `fixture_manifest_v1.json` before use. V1 contains 43 inserted rows across 24 tables. Two independent clean builds produced the same canonical fixture snapshot SHA-256: `30888a28f4fe1caa8c7893c26825d6d488d127655ed0f02eeb80eb17c14aaf60`.

## Coverage matrix

| Later migration | Migration-94 fixture coverage | Expected later effect |
| --- | --- | --- |
| 95 `20260911020000_instagram_de_persistence_foundation` | Existing owned-website resource, capture, three capability executions, capability/resource links, evidence, observations, support, relations, freshness, and provider-execution linkage | Existing website rows remain valid; new provider/account/authorization-generation columns remain null; widened capability checks preserve all rows. |
| 96 `20260912090000_c3_r0_evidence_model_derivation_provenance` | Two C2 rows use the exact contract marker; one has `supporting_evidence_refs`, one has `supportingEvidenceRefs`, including duplicate and unsorted references | Both rows become `DETERMINISTIC_DERIVATION`; parent references are extracted, sorted, and deduplicated. Other evidence remains nullable with an empty parent array. |
| 97 `20260912170000_instagram_c1_sync_coordinator` | Brand and Brand Intelligence prerequisites exist | No migration-94 row is possible because this migration creates the sync-job table; the existing prerequisite identity is available for later upgrade-gate assertions. |
| 98 `20260914010000_instagram_w4_audio_observations` | The existing Data Extraction graph spans messaging, deterministic-derived, and visual capability families | Audio is a newly admitted capability; existing capability rows and constraints remain valid. |
| 99 `20260914185000_creator_audience_subject_enum` | Complete creator user/profile/workspace/owner-member chain | No migration-94 `CREATOR` Intelligence subject is possible because the enum member is added by this migration. |
| 100 `20260914190000_creator_audience_shared_owner_scope` | Brand profile plus complete Data Extraction/Evidence and Intelligence subject/action/object/component/current/evidence graphs; creator prerequisites also exist | Brand rows receive one consistent owner scope, composite identities are rebuilt, and all existing graph rows remain linked. Creator prerequisites support later explicit creator-scope assertions. |
| 101 `20260914191000_creator_audience_owner_scope_lineage` | Resource-capture-artifact-evidence-capability-observation and subject-object-component-current-evidence lineage is fully linked | Owner-scope uniqueness and lineage triggers accept the preserved graph and prevent cross-owner substitution. |
| 102 `20260915100000_creator_brand_canonical_profile_revision` | Active creator user, creator profile, workspace, and OWNER membership | No migration-94 aggregate row is possible because this migration creates the profile/revision tables; all required actor and ownership prerequisites exist. |
| 103 `20260915200000_creator_work_preferences_canonical_revision` | Same active creator ownership and actor chain | No migration-94 aggregate row is possible because this migration creates the preference/revision tables; all required prerequisites exist. |
| 104 `20260915210000_creator_rate_card_canonical_revision` | Same active creator ownership and actor chain; no payout or financial data is fabricated | No migration-94 aggregate row is possible because this migration creates the rate-card/revision tables; identity prerequisites exist without inventing financial authority. |
| 105 `20260916170000_creator_portfolio_v3_canonical_item_revision` | Same creator profile/workspace/member prerequisites and public slug | No migration-94 portfolio row is possible because this migration creates the portfolio tables. |
| 106 `20260916180000_creator_media_kit_v3` | Same creator identity/workspace/member prerequisites, public slug, and public-media-kit flag | No migration-94 media-kit row is possible because this migration creates the media-kit tables. |

The fixture deliberately does not invent rows for tables or enum values that do not exist at migration 94. Assertions for those newly created structures belong to the later Gate A upgrade runner, not this input artifact.

## Determinism and safety checks

Gate A0 validation used two independently created PostgreSQL 16 databases, migrated each from empty through exactly migration 94, loaded this SQL once, and compared canonical JSON snapshots of every fixture-owned row. Both snapshots contained 43 rows and had the same SHA-256 recorded above.

Before publication, verify:

- the SQL SHA-256 and byte count match the manifest;
- both target databases report exactly 94 completed, non-rolled-back Prisma migrations;
- the two C2 evidence rows retain their respective snake_case and camelCase keys;
- `intelligence_owner_scopes` and the migration-95 provider columns are absent;
- the worktree contains only the three files in this directory;
- secret and PII scans find only the intentional `.invalid` synthetic addresses.

