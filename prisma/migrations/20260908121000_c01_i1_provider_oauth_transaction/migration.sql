CREATE TYPE "ProviderOAuthProvider" AS ENUM ('INSTAGRAM');
CREATE TYPE "ProviderOAuthSubjectType" AS ENUM ('BRAND', 'CREATOR');

ALTER TABLE "brand_instagram_oauth_states" RENAME TO "provider_oauth_transactions";
ALTER TABLE "provider_oauth_transactions"
  RENAME CONSTRAINT "brand_instagram_oauth_states_pkey"
  TO "provider_oauth_transactions_pkey";
ALTER TABLE "provider_oauth_transactions"
  RENAME CONSTRAINT "brand_instagram_oauth_states_brand_profile_id_fkey"
  TO "provider_oauth_transactions_brand_profile_id_fkey";
ALTER TABLE "provider_oauth_transactions"
  RENAME CONSTRAINT "brand_instagram_oauth_states_initiated_by_user_id_fkey"
  TO "provider_oauth_transactions_initiated_by_user_id_fkey";
ALTER TABLE "provider_oauth_transactions"
  ADD COLUMN "provider" "ProviderOAuthProvider" NOT NULL DEFAULT 'INSTAGRAM',
  ADD COLUMN "subject_type" "ProviderOAuthSubjectType" NOT NULL DEFAULT 'BRAND',
  ADD COLUMN "creator_profile_id" TEXT,
  ALTER COLUMN "brand_profile_id" DROP NOT NULL,
  ALTER COLUMN "initiated_by_role" DROP NOT NULL,
  ALTER COLUMN "initiated_by_role" DROP DEFAULT;
ALTER TABLE "provider_oauth_transactions" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "provider_oauth_transactions" ALTER COLUMN "subject_type" DROP DEFAULT;

ALTER TABLE "provider_oauth_transactions"
  ADD CONSTRAINT "provider_oauth_transactions_creator_profile_id_fkey"
  FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "provider_oauth_transactions_subject_shape_check" CHECK (
    (
      "subject_type" = 'BRAND'
      AND "brand_profile_id" IS NOT NULL
      AND "creator_profile_id" IS NULL
      AND "initiated_by_role" IS NOT NULL
    )
    OR
    (
      "subject_type" = 'CREATOR'
      AND "brand_profile_id" IS NULL
      AND "creator_profile_id" IS NOT NULL
      AND "initiated_by_role" IS NULL
      AND "intent" IN ('INITIAL_CONNECT', 'RECONNECT')
    )
  ),
  ADD CONSTRAINT "provider_oauth_transactions_generation_check"
  CHECK ("expected_generation" >= 0);

CREATE INDEX "provider_oauth_transactions_creator_profile_id_idx"
  ON "provider_oauth_transactions"("creator_profile_id");

ALTER INDEX "brand_instagram_oauth_states_state_hash_key"
  RENAME TO "provider_oauth_transactions_state_hash_key";
ALTER INDEX "brand_instagram_oauth_states_expires_at_consumed_at_idx"
  RENAME TO "provider_oauth_transactions_expires_at_consumed_at_idx";
ALTER INDEX "brand_instagram_oauth_states_brand_profile_id_idx"
  RENAME TO "provider_oauth_transactions_brand_profile_id_idx";
ALTER INDEX "brand_instagram_oauth_states_initiated_by_user_id_idx"
  RENAME TO "provider_oauth_transactions_initiated_by_user_id_idx";
