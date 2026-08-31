CREATE TYPE "InstagramAuthorizationHealth" AS ENUM (
  'DISCONNECTED',
  'CONNECTED_FULL',
  'PARTIALLY_CONNECTED',
  'NEEDS_REVALIDATION',
  'PROVIDER_ACCESS_BLOCKED',
  'UNKNOWN'
);

CREATE TYPE "InstagramCapabilityState" AS ENUM ('YES', 'NO', 'UNKNOWN', 'DEFERRED');
CREATE TYPE "InstagramIdentityVerification" AS ENUM ('UNVERIFIED', 'VERIFIED');
CREATE TYPE "InstagramOAuthIntent" AS ENUM (
  'INITIAL_CONNECT',
  'RECONNECT',
  'ACCOUNT_CHANGE',
  'LEGACY_IDENTITY_RECONCILIATION'
);
CREATE TYPE "InstagramIgHandleProvenance" AS ENUM (
  'META_DIRECT',
  'USER_ENTERED',
  'WEBSITE_DERIVED',
  'LEGACY_UNKNOWN'
);
CREATE TYPE "InstagramSyncHealth" AS ENUM ('NOT_CONFIGURED');
CREATE TYPE "InstagramDeletionState" AS ENUM (
  'REQUESTED',
  'FENCED',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL'
);
CREATE TYPE "InstagramDeletionSource" AS ENUM ('USER', 'META_CALLBACK');

ALTER TABLE "brand_profiles"
  ADD COLUMN "ig_handle_provenance" "InstagramIgHandleProvenance"
  NOT NULL DEFAULT 'LEGACY_UNKNOWN';

ALTER TABLE "brand_instagram_oauth_states"
  ADD COLUMN "intent" "InstagramOAuthIntent" NOT NULL DEFAULT 'INITIAL_CONNECT',
  ADD COLUMN "initiated_by_role" "BrandRole" NOT NULL DEFAULT 'BRAND_OWNER',
  ADD COLUMN "expected_generation" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expected_provider_account_id" VARCHAR(100);

ALTER TABLE "instagram_sync_invitations"
  ADD COLUMN "oauth_state_hash" VARCHAR(64),
  ADD COLUMN "oauth_redirect_uri" TEXT,
  ADD COLUMN "oauth_expected_generation" INTEGER,
  ADD COLUMN "oauth_state_expires_at" TIMESTAMP(3),
  ADD COLUMN "oauth_state_consumed_at" TIMESTAMP(3);

CREATE INDEX "instagram_sync_invitations_oauth_state_hash_oauth_state_expires_at_idx"
  ON "instagram_sync_invitations"("oauth_state_hash", "oauth_state_expires_at");

ALTER TABLE "brand_integrations"
  ALTER COLUMN "current_platform_handle" DROP NOT NULL,
  ADD COLUMN "provider_account_id" VARCHAR(100),
  ADD COLUMN "provider_app_scoped_user_id" VARCHAR(100),
  ADD COLUMN "identity_verification" "InstagramIdentityVerification" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "authorization_health" "InstagramAuthorizationHealth" NOT NULL DEFAULT 'NEEDS_REVALIDATION',
  ADD COLUMN "first_party_profile_capability" "InstagramCapabilityState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "first_party_insights_capability" "InstagramCapabilityState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "business_discovery_capability" "InstagramCapabilityState" NOT NULL DEFAULT 'DEFERRED',
  ADD COLUMN "creator_marketplace_capability" "InstagramCapabilityState" NOT NULL DEFAULT 'DEFERRED',
  ADD COLUMN "human_action_required" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sync_health" "InstagramSyncHealth" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "authorization_generation" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credential_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "token_issued_at" TIMESTAMP(3),
  ADD COLUMN "token_last_refreshed_at" TIMESTAMP(3),
  ADD COLUMN "token_refresh_attempted_at" TIMESTAMP(3),
  ADD COLUMN "pending_provider_account_id" VARCHAR(100),
  ADD COLUMN "pending_provider_app_scoped_user_id" VARCHAR(100),
  ADD COLUMN "pending_oauth_intent" "InstagramOAuthIntent",
  ADD COLUMN "pending_expected_generation" INTEGER,
  ADD COLUMN "authorization_loss_transition_id" UUID,
  ADD COLUMN "authorization_loss_opened_at" TIMESTAMP(3);

UPDATE "brand_integrations"
SET "authorization_health" = CASE
  WHEN "status" = 'DISCONNECTED' THEN 'DISCONNECTED'::"InstagramAuthorizationHealth"
  ELSE 'NEEDS_REVALIDATION'::"InstagramAuthorizationHealth"
END,
"identity_verification" = 'UNVERIFIED',
"first_party_profile_capability" = 'UNKNOWN',
"first_party_insights_capability" = 'UNKNOWN',
"business_discovery_capability" = 'DEFERRED',
"creator_marketplace_capability" = 'DEFERRED',
"human_action_required" = false,
"token_issued_at" = CASE
  WHEN "access_token_encrypted" IS NOT NULL THEN "updated_at"
  ELSE NULL
END;

CREATE INDEX "idx_integrations_callback_subject"
  ON "brand_integrations"("provider", "provider_app_scoped_user_id");
CREATE INDEX "idx_instagram_refresh_candidates"
  ON "brand_integrations"("provider", "authorization_health", "token_expires_at");

CREATE TABLE "brand_instagram_deletion_requests" (
  "deletion_request_id" UUID NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "provider_account_id" VARCHAR(100),
  "provider_app_scoped_user_id" VARCHAR(100),
  "source" "InstagramDeletionSource" NOT NULL,
  "requester_user_id" TEXT,
  "state" "InstagramDeletionState" NOT NULL DEFAULT 'REQUESTED',
  "requested_generation" INTEGER NOT NULL,
  "fence_generation" INTEGER,
  "callback_request_hash" CHAR(64),
  "confirmation_code" VARCHAR(80) NOT NULL,
  "policy_version" VARCHAR(40) NOT NULL DEFAULT 'BS06_P1_V1',
  "result_summary" JSONB,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error_code" VARCHAR(100),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fenced_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_instagram_deletion_requests_pkey" PRIMARY KEY ("deletion_request_id"),
  CONSTRAINT "brand_instagram_deletion_requests_brand_profile_id_fkey"
    FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "uq_instagram_delete_effective_request"
  ON "brand_instagram_deletion_requests"("brand_profile_id", "source", "requested_generation");
CREATE UNIQUE INDEX "uq_instagram_delete_callback_replay"
  ON "brand_instagram_deletion_requests"("brand_profile_id", "callback_request_hash");
CREATE INDEX "idx_instagram_delete_confirmation"
  ON "brand_instagram_deletion_requests"("confirmation_code");
CREATE INDEX "idx_instagram_delete_worker"
  ON "brand_instagram_deletion_requests"("state", "requested_at");
