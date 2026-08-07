-- Brand onboarding: password gate after identity, Instagram sync + settings integrations

CREATE TYPE "BrandIntegrationProvider" AS ENUM ('INSTAGRAM', 'META_BUSINESS_SUITE');
CREATE TYPE "BrandIntegrationStatus" AS ENUM (
  'CONNECTED',
  'PARTIALLY_CONNECTED',
  'TOKEN_EXPIRED',
  'DISCONNECTED'
);
CREATE TYPE "BrandIntegrationScope" AS ENUM (
  'BASIC_PROFILE',
  'ENGAGEMENT_INSIGHTS',
  'TARGETED_OUTREACH'
);
CREATE TYPE "InstagramSyncInvitationStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'COMPLETED',
  'EXPIRED'
);

ALTER TABLE "brand_profiles"
  ADD COLUMN "identity_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "social_sync_skipped" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "brand_integrations" (
  "integration_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "provider" "BrandIntegrationProvider" NOT NULL,
  "status" "BrandIntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "current_platform_handle" VARCHAR(255) NOT NULL,
  "inbound_oauth_handle" VARCHAR(255),
  "access_token_encrypted" TEXT,
  "refresh_token_encrypted" TEXT,
  "granted_scopes" "BrandIntegrationScope"[] DEFAULT ARRAY[]::"BrandIntegrationScope"[],
  "token_expires_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_integrations_pkey" PRIMARY KEY ("integration_id")
);

CREATE TABLE "instagram_sync_invitations" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "InstagramSyncInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "token" TEXT NOT NULL,
  "otp_code" TEXT,
  "otp_expires_at" TIMESTAMP(3),
  "brand_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instagram_sync_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_brand_provider_pair"
  ON "brand_integrations"("brand_id", "provider");

CREATE INDEX "idx_brand_integrations_lookup"
  ON "brand_integrations"("brand_id", "provider", "status");

CREATE INDEX "idx_integrations_token_expiration"
  ON "brand_integrations"("status", "token_expires_at");

CREATE UNIQUE INDEX "instagram_sync_invitations_token_key"
  ON "instagram_sync_invitations"("token");

CREATE INDEX "instagram_sync_invitations_token_idx"
  ON "instagram_sync_invitations"("token");

CREATE INDEX "instagram_sync_invitations_brand_id_idx"
  ON "instagram_sync_invitations"("brand_id");

ALTER TABLE "brand_integrations"
  ADD CONSTRAINT "brand_integrations_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "instagram_sync_invitations"
  ADD CONSTRAINT "instagram_sync_invitations_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
