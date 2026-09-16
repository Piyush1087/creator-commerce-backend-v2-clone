-- C1 adds only the durable Instagram-owned sync coordinator state.
CREATE TYPE "InstagramSyncCapabilityClass" AS ENUM (
  'INITIAL_30_DAY', 'PROFILE_MEDIA_PERFORMANCE', 'AUDIENCE'
);
CREATE TYPE "InstagramSyncCoordinatorStatus" AS ENUM (
  'PENDING', 'DUE', 'RUNNING', 'BACKOFF', 'BLOCKED_AUTHORIZATION', 'COMPLETED'
);
CREATE TYPE "InstagramSyncTrigger" AS ENUM (
  'INITIAL_CONNECT', 'SCHEDULED', 'MANUAL', 'RECONNECT'
);

CREATE TABLE "instagram_intelligence_sync_jobs" (
  "sync_job_id" UUID NOT NULL,
  "brand_id" TEXT NOT NULL,
  "integration_id" TEXT NOT NULL,
  "provider_account_id" VARCHAR(100) NOT NULL,
  "authorization_generation" INTEGER NOT NULL,
  "capability_class" "InstagramSyncCapabilityClass" NOT NULL,
  "status" "InstagramSyncCoordinatorStatus" NOT NULL DEFAULT 'PENDING',
  "trigger" "InstagramSyncTrigger" NOT NULL,
  "execution_window_start" TIMESTAMP(3),
  "execution_window_end" TIMESTAMP(3),
  "request_identity" VARCHAR(255) NOT NULL,
  "cursor" JSONB,
  "lease_token" UUID,
  "lease_owner_ref" VARCHAR(255),
  "lease_expires_at" TIMESTAMP(3),
  "last_heartbeat_at" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3),
  "last_success_at" TIMESTAMP(3),
  "last_manual_requested_at" TIMESTAMP(3),
  "manual_pending" BOOLEAN NOT NULL DEFAULT false,
  "next_due_at" TIMESTAMP(3),
  "backoff_until" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "consecutive_failure_count" INTEGER NOT NULL DEFAULT 0,
  "last_completed_generation_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reason_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instagram_intelligence_sync_jobs_pkey" PRIMARY KEY ("sync_job_id")
);

CREATE UNIQUE INDEX "instagram_intelligence_sync_jobs_lease_token_key"
  ON "instagram_intelligence_sync_jobs"("lease_token");
CREATE UNIQUE INDEX "uq_instagram_sync_generation_class"
  ON "instagram_intelligence_sync_jobs"("brand_id", "integration_id", "provider_account_id", "authorization_generation", "capability_class");
CREATE INDEX "idx_instagram_sync_due"
  ON "instagram_intelligence_sync_jobs"("status", "next_due_at", "backoff_until", "lease_expires_at");
CREATE INDEX "idx_instagram_sync_fence"
  ON "instagram_intelligence_sync_jobs"("brand_id", "integration_id", "authorization_generation");

ALTER TABLE "instagram_intelligence_sync_jobs"
  ADD CONSTRAINT "instagram_intelligence_sync_jobs_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "instagram_intelligence_sync_jobs"
  ADD CONSTRAINT "instagram_intelligence_sync_jobs_integration_id_fkey"
  FOREIGN KEY ("integration_id") REFERENCES "brand_integrations"("integration_id") ON DELETE CASCADE ON UPDATE CASCADE;
