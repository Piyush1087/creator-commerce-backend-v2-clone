CREATE TYPE "ProviderCapabilityState" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN');
CREATE TYPE "ProviderAuthorizationHealth" AS ENUM (
  'USABLE',
  'REAUTHORIZATION_REQUIRED',
  'PROVIDER_ACCESS_BLOCKED',
  'UNKNOWN',
  'DISCONNECTED'
);

ALTER TABLE "creator_social_integrations"
  ADD COLUMN "token_issued_at" TIMESTAMP(3),
  ADD COLUMN "token_refreshed_at" TIMESTAMP(3),
  ADD COLUMN "authorization_generation" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credential_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "authorization_health" "ProviderAuthorizationHealth" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "authorization_health_reason_code" VARCHAR(100),
  ADD COLUMN "basic_authorization_capability" "ProviderCapabilityState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "insights_capability" "ProviderCapabilityState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "last_authorization_validated_at" TIMESTAMP(3),
  ADD COLUMN "disconnected_at" TIMESTAMP(3);

UPDATE "creator_social_integrations"
SET
  "authorization_health" = CASE
    WHEN "token_state_condition" = 'EXPIRED' THEN 'REAUTHORIZATION_REQUIRED'::"ProviderAuthorizationHealth"
    WHEN "token_state_condition" = 'REVOKED' THEN 'DISCONNECTED'::"ProviderAuthorizationHealth"
    ELSE 'UNKNOWN'::"ProviderAuthorizationHealth"
  END,
  "basic_authorization_capability" = CASE
    WHEN "token_state_condition" IN ('EXPIRED', 'REVOKED') THEN 'UNAVAILABLE'::"ProviderCapabilityState"
    ELSE 'UNKNOWN'::"ProviderCapabilityState"
  END,
  "insights_capability" = CASE
    WHEN "token_state_condition" = 'REVOKED' THEN 'UNAVAILABLE'::"ProviderCapabilityState"
    ELSE 'UNKNOWN'::"ProviderCapabilityState"
  END,
  "token_issued_at" = CASE
    WHEN "oauth_access_token_encrypted" IS NOT NULL THEN "created_at"
    ELSE NULL
  END,
  "disconnected_at" = CASE
    WHEN "token_state_condition" = 'REVOKED' THEN "updated_at"
    ELSE NULL
  END;

ALTER TABLE "creator_social_integrations"
  ADD CONSTRAINT "creator_social_integrations_authorization_generation_check"
  CHECK ("authorization_generation" >= 0),
  ADD CONSTRAINT "creator_social_integrations_credential_version_check"
  CHECK ("credential_version" > 0),
  ADD CONSTRAINT "creator_social_integrations_disconnected_shape_check"
  CHECK (
    "authorization_health" <> 'DISCONNECTED'
    OR "disconnected_at" IS NOT NULL
  );

CREATE INDEX "creator_social_integrations_authorization_health_idx"
  ON "creator_social_integrations"("platform_network", "authorization_health");
