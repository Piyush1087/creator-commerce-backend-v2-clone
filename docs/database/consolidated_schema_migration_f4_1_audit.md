# Phase F4.1 — Migration-History Reconciliation

F5 exposed that the original F4 artifact was generated from a schema snapshot rather than from the repository's fully materialized migration history. The baseline migration `20260812170000_uce_campaign_canonical_definition` already created `uce_campaigns.creation_source` as TEXT and `canonical_definition` as JSONB.

F4.1 regenerates the consolidated diff from an ephemeral PostgreSQL 16 database after applying the real pre-F4 migration history.

Safety decisions:
- preserve `canonical_definition` and model it explicitly in Prisma because current Campaign publish runtime still writes it as compatibility evidence;
- convert `uce_campaigns.creation_source` TEXT → `UceCampaignCreationSource` in place after dropping the legacy check constraint;
- convert `uce_campaign_targeting.audience_gender` String → enum in place;
- retain the Campaign Asset exactly-one-reference CHECK constraint;
- reconcile historical same-name index drift, including replacing legacy non-unique `creator_profiles_public_slug_key` and `users_google_subject_id_key` indexes with the unique indexes required by the consolidated Prisma schema;
- retain legacy Campaign Product, Brief and UCE Collaboration tables;
- do not rewrite escrow, payout, financial ledger or settlement history.

Validation requires all pre-F4 migrations to apply to a fresh PostgreSQL 16 database, corrected F4.1 SQL to apply successfully, and Prisma to report no remaining schema difference.
