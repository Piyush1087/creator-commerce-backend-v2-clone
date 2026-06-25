-- Align marketplace migration artifacts with Prisma schema (runs after 20260624120000).

DROP INDEX IF EXISTS "idx_creator_profiles_eligibility_lookup";

ALTER TABLE "creator_profiles"
  ALTER COLUMN "tiktok_handle" SET DATA TYPE TEXT,
  ALTER COLUMN "primary_region" SET DATA TYPE TEXT;

ALTER TABLE "integration_bridge_signals_ledger"
  ALTER COLUMN "signal_id" DROP DEFAULT,
  ALTER COLUMN "synchronized_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "updated_at" DROP DEFAULT,
  ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

ALTER TABLE "uce_campaign_collaborations"
  ALTER COLUMN "invitation_token" SET DATA TYPE TEXT,
  ALTER COLUMN "invitation_source_channel" SET DATA TYPE TEXT;

CREATE INDEX IF NOT EXISTS "brand_audience_personas_brand_profile_id_idx"
  ON "brand_audience_personas"("brand_profile_id");

DROP INDEX IF EXISTS "uce_campaign_collaborations_invitation_token_key";
CREATE UNIQUE INDEX "uce_campaign_collaborations_invitation_token_key"
  ON "uce_campaign_collaborations"("invitation_token");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'brand_performance_leaks_brand_profile_id_is_archived_priority_r'
  ) THEN
    ALTER INDEX "brand_performance_leaks_brand_profile_id_is_archived_priority_r"
      RENAME TO "brand_performance_leaks_brand_profile_id_is_archived_priori_idx";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'escrow_transaction_ledger_brand_id_collaboration_id_transacti_i'
  ) THEN
    ALTER INDEX "escrow_transaction_ledger_brand_id_collaboration_id_transacti_i"
      RENAME TO "escrow_transaction_ledger_brand_id_collaboration_id_transac_idx";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'integration_bridge_signals_ledger_brand_profile_id_created_at_i'
  ) THEN
    ALTER INDEX "integration_bridge_signals_ledger_brand_profile_id_created_at_i"
      RENAME TO "integration_bridge_signals_ledger_brand_profile_id_created__idx";
  END IF;
END $$;
