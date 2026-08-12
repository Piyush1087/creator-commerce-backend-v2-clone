from pathlib import Path
import sys

SCHEMA = Path('prisma/schema.prisma')


def patch_schema() -> None:
    s = SCHEMA.read_text()
    anchor = '  creationSource          UceCampaignCreationSource @default(MANUAL) @map("creation_source")\n'
    addition = '  canonicalDefinition     Json?                     @map("canonical_definition")\n'
    if addition not in s:
        if anchor not in s:
            raise SystemExit('UceCampaign creationSource anchor not found')
        s = s.replace(anchor, anchor + addition, 1)
        SCHEMA.write_text(s)


def patch_sql(src: str, dst: str) -> None:
    sql = Path(src).read_text()

    targeting_old = '''ALTER TABLE "uce_campaign_targeting" ADD COLUMN     "audience_affinity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "audience_geographies" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "maximum_followers" INTEGER,
ADD COLUMN     "minimum_followers" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "audience_gender",
ADD COLUMN     "audience_gender" "UceAudienceGender" NOT NULL DEFAULT 'ALL';'''
    targeting_safe = '''ALTER TABLE "uce_campaign_targeting" ADD COLUMN     "audience_affinity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "audience_geographies" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "maximum_followers" INTEGER,
ADD COLUMN     "minimum_followers" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "uce_campaign_targeting"
ALTER COLUMN "audience_gender" DROP DEFAULT,
ALTER COLUMN "audience_gender" TYPE "UceAudienceGender"
USING ("audience_gender"::"UceAudienceGender"),
ALTER COLUMN "audience_gender" SET DEFAULT 'ALL';'''
    if targeting_old not in sql:
        raise SystemExit('Expected destructive audience_gender block not found')
    sql = sql.replace(targeting_old, targeting_safe, 1)

    campaign_old = '''ALTER TABLE "uce_campaigns" ADD COLUMN     "ai_recommendation_id" TEXT,
ADD COLUMN     "ai_recommendation_version" TEXT,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "live_at" TIMESTAMP(3),
ADD COLUMN     "published_at" TIMESTAMP(3),
DROP COLUMN "creation_source",
ADD COLUMN     "creation_source" "UceCampaignCreationSource" NOT NULL DEFAULT 'MANUAL';'''
    campaign_safe = '''ALTER TABLE "uce_campaigns" ADD COLUMN     "ai_recommendation_id" TEXT,
ADD COLUMN     "ai_recommendation_version" TEXT,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "live_at" TIMESTAMP(3),
ADD COLUMN     "published_at" TIMESTAMP(3);

ALTER TABLE "uce_campaigns"
DROP CONSTRAINT IF EXISTS "uce_campaigns_creation_source_check";

ALTER TABLE "uce_campaigns"
ALTER COLUMN "creation_source" DROP DEFAULT,
ALTER COLUMN "creation_source" TYPE "UceCampaignCreationSource"
USING ("creation_source"::"UceCampaignCreationSource"),
ALTER COLUMN "creation_source" SET DEFAULT 'MANUAL';'''
    if campaign_old not in sql:
        raise SystemExit('Expected destructive creation_source block not found')
    sql = sql.replace(campaign_old, campaign_safe, 1)

    marker = 'CREATE TABLE "uce_campaign_assets"'
    idx = sql.find(marker)
    if idx < 0:
        raise SystemExit('Campaign Asset table block not found')
    tail = sql[idx:]
    asset_old = '    CONSTRAINT "uce_campaign_assets_pkey" PRIMARY KEY ("id")\n);'
    asset_safe = '''    CONSTRAINT "uce_campaign_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uce_campaign_assets_exactly_one_reference_check" CHECK (
      ("kind" = 'BRAND' AND "brand_profile_id" IS NOT NULL AND "offering_id" IS NULL AND "brand_offer_id" IS NULL) OR
      ("kind" = 'OFFERING' AND "brand_profile_id" IS NULL AND "offering_id" IS NOT NULL AND "brand_offer_id" IS NULL) OR
      ("kind" = 'OFFER' AND "brand_profile_id" IS NULL AND "offering_id" IS NULL AND "brand_offer_id" IS NOT NULL)
    )
);'''
    if asset_old not in tail:
        raise SystemExit('Campaign Asset primary-key block not found')
    sql = sql[:idx] + tail.replace(asset_old, asset_safe, 1)

    # History contains non-unique indexes using names that the consolidated Prisma
    # schema now assigns to UNIQUE indexes. Replace those exact legacy indexes rather
    # than silently skipping them; the zero-diff gate verifies final semantics.
    for index_name in (
        'creator_profiles_public_slug_key',
        'users_google_subject_id_key',
    ):
        statement = f'CREATE UNIQUE INDEX "{index_name}"'
        if statement in sql:
            sql = sql.replace(
                statement,
                f'DROP INDEX IF EXISTS "{index_name}";\nCREATE UNIQUE INDEX "{index_name}"',
                1,
            )

    # Other same-name index drift can safely skip recreation. A semantic difference
    # still fails the final Prisma diff gate.
    sql = sql.replace('CREATE UNIQUE INDEX "', 'CREATE UNIQUE INDEX IF NOT EXISTS "')
    sql = sql.replace('CREATE INDEX "', 'CREATE INDEX IF NOT EXISTS "')
    # Undo IF NOT EXISTS for the two indexes we intentionally replace above.
    sql = sql.replace('CREATE UNIQUE INDEX IF NOT EXISTS "creator_profiles_public_slug_key"', 'CREATE UNIQUE INDEX "creator_profiles_public_slug_key"')
    sql = sql.replace('CREATE UNIQUE INDEX IF NOT EXISTS "users_google_subject_id_key"', 'CREATE UNIQUE INDEX "users_google_subject_id_key"')

    forbidden = [
        'DROP COLUMN "canonical_definition"',
        'DROP TABLE "uce_campaign_products"',
        'DROP TABLE "uce_campaign_briefs"',
        'DROP TABLE "uce_campaign_collaborations"',
        'DROP TABLE "brand_escrow_vaults"',
        'DROP TABLE "escrow_transaction_ledger"',
    ]
    for token in forbidden:
        if token in sql:
            raise SystemExit(f'Forbidden destructive operation remains: {token}')

    header = (
        '-- Phase F4.1 consolidated pre-production migration, reconciled against the real repository migration history.\n'
        '-- The prior F4 schema-snapshot artifact was superseded after F5 exposed baseline overlap.\n'
        '-- DEV/PRE-PRODUCTION ONLY. Production requires independent data/backfill review.\n\n'
    )
    Path(dst).write_text(header + sql)


def write_audit() -> None:
    p = Path('docs/database/consolidated_schema_migration_f4_1_audit.md')
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text('''# Phase F4.1 — Migration-History Reconciliation

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
''')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit('usage: f4_1_reconcile.py patch-schema|patch-sql|write-audit [args]')
    cmd = sys.argv[1]
    if cmd == 'patch-schema':
        patch_schema()
    elif cmd == 'patch-sql':
        if len(sys.argv) != 4:
            raise SystemExit('patch-sql requires SRC DST')
        patch_sql(sys.argv[2], sys.argv[3])
    elif cmd == 'write-audit':
        write_audit()
    else:
        raise SystemExit(f'unknown command: {cmd}')
