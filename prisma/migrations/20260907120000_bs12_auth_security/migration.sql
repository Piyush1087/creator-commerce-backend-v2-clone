-- BS-12: canonical identity, authentication methods, sessions and recovery.
-- Fail before adding normalized-email authority when two historical Users would
-- normalize to the same permanent identity. Ambiguous identities are never merged.

CREATE TYPE "UserAuthState" AS ENUM ('PROVISIONAL', 'ACTIVE', 'RECOVERY_REQUIRED', 'DISABLED');
CREATE TYPE "AuthMethodType" AS ENUM ('PASSWORD', 'GOOGLE', 'EMAIL_OTP');
CREATE TYPE "EmailOtpPurpose" AS ENUM ('LOGIN', 'BRAND_VERIFICATION', 'CREATOR_EMAIL_VERIFICATION', 'TEAM_INVITE', 'SOCIAL_SYNC_INVITE');
CREATE TYPE "AuthDeliveryStatus" AS ENUM ('PENDING', 'MESSAGE_ACCEPTED', 'REJECTED', 'DELIVERY_UNKNOWN');
CREATE TYPE "SecurityEventType" AS ENUM ('SESSION_CREATED', 'SESSION_REVOKED', 'ALL_SESSIONS_REVOKED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED', 'GOOGLE_LINKED', 'GOOGLE_LINK_CONFLICT', 'OTP_ISSUED', 'OTP_VERIFIED', 'AUTH_DISABLED');

ALTER TABLE "users"
  ADD COLUMN "normalized_email" TEXT,
  ADD COLUMN "auth_state" "UserAuthState" NOT NULL DEFAULT 'PROVISIONAL';

UPDATE "users"
SET "normalized_email" = lower(normalize(btrim("email"), NFC));

DO $$
DECLARE collision text;
BEGIN
  SELECT string_agg(normalized_email, ', ' ORDER BY normalized_email)
  INTO collision
  FROM (
    SELECT "normalized_email" AS normalized_email
    FROM "users"
    GROUP BY "normalized_email"
    HAVING count(*) > 1
  ) collisions;
  IF collision IS NOT NULL THEN
    RAISE EXCEPTION 'BS12_NORMALIZED_EMAIL_COLLISION_RECONCILIATION_REQUIRED: %', collision;
  END IF;
END $$;

CREATE FUNCTION "users_set_normalized_email"() RETURNS trigger AS $$
BEGIN
  NEW."normalized_email" := lower(normalize(btrim(NEW."email"), NFC));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "users_set_normalized_email_trigger"
BEFORE INSERT OR UPDATE OF "email", "normalized_email" ON "users"
FOR EACH ROW EXECUTE FUNCTION "users_set_normalized_email"();

ALTER TABLE "users" ALTER COLUMN "normalized_email" SET NOT NULL;
CREATE UNIQUE INDEX "users_normalized_email_key" ON "users"("normalized_email");

UPDATE "users"
SET "auth_state" = CASE
  WHEN "google_subject_id" IS NOT NULL THEN 'ACTIVE'::"UserAuthState"
  WHEN "email_verified_at" IS NOT NULL AND "hashed_password" LIKE 'scrypt$%' THEN 'ACTIVE'::"UserAuthState"
  WHEN "hashed_password" IS NOT NULL OR "email_verified_at" IS NOT NULL THEN 'RECOVERY_REQUIRED'::"UserAuthState"
  ELSE 'PROVISIONAL'::"UserAuthState"
END;

CREATE TABLE "user_auth_methods" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "AuthMethodType" NOT NULL,
  "credential_hash" TEXT,
  "provider_subject_id" VARCHAR(255),
  "provider_email_normalized" VARCHAR(320),
  "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_auth_methods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_auth_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_auth_methods_shape_check" CHECK (
    ("type" = 'PASSWORD' AND "credential_hash" IS NOT NULL AND "provider_subject_id" IS NULL)
    OR ("type" = 'GOOGLE' AND "credential_hash" IS NULL AND "provider_subject_id" IS NOT NULL)
    OR ("type" = 'EMAIL_OTP' AND "credential_hash" IS NULL AND "provider_subject_id" IS NULL)
  )
);
CREATE UNIQUE INDEX "user_auth_methods_user_id_type_key" ON "user_auth_methods"("user_id", "type");
CREATE UNIQUE INDEX "user_auth_methods_provider_subject_id_key" ON "user_auth_methods"("provider_subject_id");
CREATE INDEX "user_auth_methods_type_provider_email_normalized_idx" ON "user_auth_methods"("type", "provider_email_normalized");

INSERT INTO "user_auth_methods" ("id", "user_id", "type", "credential_hash", "verified_at", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", 'PASSWORD', "hashed_password", COALESCE("email_verified_at", "created_at"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "hashed_password" LIKE 'scrypt$%';

INSERT INTO "user_auth_methods" ("id", "user_id", "type", "provider_subject_id", "provider_email_normalized", "verified_at", "created_at", "updated_at")
SELECT gen_random_uuid()::text, "id", 'GOOGLE', "google_subject_id", "normalized_email", COALESCE("email_verified_at", "created_at"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users"
WHERE "google_subject_id" IS NOT NULL;

CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "current_refresh_token_digest" CHAR(64) NOT NULL,
  "refresh_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_refreshed_at" TIMESTAMP(3),
  "absolute_expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revocation_reason" VARCHAR(100),
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "auth_sessions_refresh_version_check" CHECK ("refresh_version" > 0)
);
CREATE UNIQUE INDEX "auth_sessions_current_refresh_token_digest_key" ON "auth_sessions"("current_refresh_token_digest");
CREATE INDEX "auth_sessions_user_id_revoked_at_absolute_expires_at_idx" ON "auth_sessions"("user_id", "revoked_at", "absolute_expires_at");

CREATE TABLE "auth_refresh_credentials" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "digest" CHAR(64) NOT NULL,
  "version" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed_at" TIMESTAMP(3),
  CONSTRAINT "auth_refresh_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_refresh_credentials_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "auth_refresh_credentials_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "auth_refresh_credentials_digest_key" ON "auth_refresh_credentials"("digest");
CREATE UNIQUE INDEX "auth_refresh_credentials_session_id_version_key" ON "auth_refresh_credentials"("session_id", "version");
CREATE INDEX "auth_refresh_credentials_session_id_consumed_at_idx" ON "auth_refresh_credentials"("session_id", "consumed_at");

CREATE TABLE "email_otp_challenges" (
  "id" TEXT NOT NULL,
  "normalized_email" VARCHAR(320) NOT NULL,
  "purpose" "EmailOtpPurpose" NOT NULL,
  "digest" CHAR(64) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "delivery_status" "AuthDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider_message_id" VARCHAR(255),
  CONSTRAINT "email_otp_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "email_otp_challenges_attempts_check" CHECK ("attempt_count" >= 0 AND "max_attempts" > 0 AND "attempt_count" <= "max_attempts")
);
CREATE INDEX "email_otp_challenges_normalized_email_purpose_created_at_idx" ON "email_otp_challenges"("normalized_email", "purpose", "created_at");
CREATE INDEX "email_otp_challenges_normalized_email_purpose_consumed_at_superseded_at_idx" ON "email_otp_challenges"("normalized_email", "purpose", "consumed_at", "superseded_at");

CREATE TABLE "password_reset_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "normalized_email" VARCHAR(320) NOT NULL,
  "token_digest" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "delivery_status" "AuthDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider_message_id" VARCHAR(255),
  CONSTRAINT "password_reset_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "password_reset_challenges_token_digest_key" ON "password_reset_challenges"("token_digest");
CREATE INDEX "password_reset_challenges_user_id_consumed_at_superseded_at_idx" ON "password_reset_challenges"("user_id", "consumed_at", "superseded_at");

CREATE TABLE "auth_throttles" (
  "id" TEXT NOT NULL,
  "identifier_digest" CHAR(64) NOT NULL,
  "kind" VARCHAR(50) NOT NULL,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blocked_until" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_throttles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_throttles_failure_count_check" CHECK ("failure_count" >= 0)
);
CREATE UNIQUE INDEX "auth_throttles_identifier_digest_kind_key" ON "auth_throttles"("identifier_digest", "kind");

CREATE TABLE "security_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "session_id" TEXT,
  "type" "SecurityEventType" NOT NULL,
  "outcome" VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
  "reason_code" VARCHAR(100),
  "context" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "security_events_user_id_created_at_idx" ON "security_events"("user_id", "created_at");
CREATE INDEX "security_events_type_created_at_idx" ON "security_events"("type", "created_at");

-- Historical OTP state is never made canonical. Mark raw legacy Brand codes used;
-- the application no longer reads either legacy OTP table after this cutover.
UPDATE "verification_codes" SET "is_used" = true WHERE "is_used" = false;
