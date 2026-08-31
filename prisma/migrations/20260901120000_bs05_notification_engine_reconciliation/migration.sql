-- BS-05 P1: additive canonical notification engine reconciliation.
-- Legacy enum values, settings, notifications, and recipient delivery flags remain intact.

ALTER TYPE "SettingsNotificationCategory" ADD VALUE IF NOT EXISTS 'BILLING_SUBSCRIPTION';
ALTER TYPE "SettingsNotificationCategory" ADD VALUE IF NOT EXISTS 'ESCROW_PAYOUTS';
ALTER TYPE "SettingsNotificationCategory" ADD VALUE IF NOT EXISTS 'CAMPAIGNS_APPLICATIONS';
ALTER TYPE "SettingsNotificationCategory" ADD VALUE IF NOT EXISTS 'COLLABORATIONS';
ALTER TYPE "SettingsNotificationCategory" ADD VALUE IF NOT EXISTS 'BRAND_INTELLIGENCE';
ALTER TYPE "SettingsNotificationCategory" ADD VALUE IF NOT EXISTS 'TEAM_ACCOUNT_INTEGRATIONS';

ALTER TYPE "NotificationUrgencyLevel" ADD VALUE IF NOT EXISTS 'ACTION_REQUIRED';
ALTER TYPE "NotificationUrgencyLevel" ADD VALUE IF NOT EXISTS 'INFORMATIONAL';

CREATE TYPE "NotificationEmailPolicy" AS ENUM ('MANDATORY', 'OPTIONAL', 'NONE');
CREATE TYPE "NotificationInAppPolicy" AS ENUM ('REQUIRED', 'YES', 'NONE');
CREATE TYPE "NotificationEmailDeliveryStatus" AS ENUM (
  'NOT_REQUIRED', 'PENDING', 'PROCESSING', 'SENT',
  'FAILED_RETRYABLE', 'FAILED_TERMINAL'
);

CREATE TABLE "user_brand_notification_preferences" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category" "SettingsNotificationCategory" NOT NULL,
  "optional_email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_brand_notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_brand_notification_preferences_brand_profile_id_fkey"
    FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_brand_notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_brand_notification_preferences_brand_profile_id_user_id_category_key"
  ON "user_brand_notification_preferences"("brand_profile_id", "user_id", "category");
CREATE INDEX "user_brand_notification_preferences_user_id_brand_profile_id_idx"
  ON "user_brand_notification_preferences"("user_id", "brand_profile_id");

ALTER TABLE "notifications"
  ADD COLUMN "semantic_event_key" VARCHAR(200),
  ADD COLUMN "category" "SettingsNotificationCategory",
  ADD COLUMN "actionable" BOOLEAN,
  ADD COLUMN "email_policy" "NotificationEmailPolicy",
  ADD COLUMN "in_app_policy" "NotificationInAppPolicy";
CREATE UNIQUE INDEX "notifications_workspace_id_event_type_semantic_event_key_key"
  ON "notifications"("workspace_id", "event_type", "semantic_event_key");

ALTER TABLE "notification_jobs" ADD COLUMN "semantic_event_key" VARCHAR(200);
UPDATE "notification_jobs" SET "semantic_event_key" = 'legacy-job:' || "id" WHERE "semantic_event_key" IS NULL;
ALTER TABLE "notification_jobs" ALTER COLUMN "semantic_event_key" SET NOT NULL;
CREATE UNIQUE INDEX "notification_jobs_workspace_id_event_type_semantic_event_key_key"
  ON "notification_jobs"("workspace_id", "event_type", "semantic_event_key");

CREATE TABLE "notification_email_deliveries" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "recipient_id" TEXT,
  "target_email" TEXT NOT NULL,
  "status" "NotificationEmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "locked_by" VARCHAR(100),
  "last_error" TEXT,
  "provider_message_id" VARCHAR(200),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_email_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_email_deliveries_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_email_deliveries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_email_deliveries_recipient_id_fkey"
    FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_email_deliveries_recipient_id_key"
  ON "notification_email_deliveries"("recipient_id");
CREATE UNIQUE INDEX "notification_email_deliveries_notification_id_user_id_key"
  ON "notification_email_deliveries"("notification_id", "user_id");
CREATE INDEX "notification_email_deliveries_status_scheduled_at_idx"
  ON "notification_email_deliveries"("status", "scheduled_at");

-- Deliberately no historical delivery backfill. In particular, legacy
-- is_emailed=false rows must never become pending outbound email.
