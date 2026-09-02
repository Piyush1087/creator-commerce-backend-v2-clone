-- BS-05 P1C1: immutable dispatch-time recipients and fenced worker claims.

ALTER TABLE "notification_jobs"
  ADD COLUMN "claim_token" VARCHAR(100),
  ADD COLUMN "snapshot_finalized_at" TIMESTAMP(3),
  ADD COLUMN "materialized_at" TIMESTAMP(3);

ALTER TABLE "notification_email_deliveries"
  ADD COLUMN "claim_token" VARCHAR(100),
  ADD COLUMN "provider_send_started_at" TIMESTAMP(3);

CREATE TABLE "notification_job_recipients" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "target_email" TEXT NOT NULL,
  "recipient_name" TEXT,
  "inbox_obligation" BOOLEAN NOT NULL,
  "email_status" "NotificationEmailDeliveryStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_job_recipients_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_job_recipients_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "notification_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_job_recipients_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "notification_job_recipients_job_id_user_id_key"
  ON "notification_job_recipients"("job_id", "user_id");
CREATE INDEX "notification_job_recipients_job_id_idx"
  ON "notification_job_recipients"("job_id");

-- Existing P1 jobs predate immutable snapshots. They remain historical and are
-- not converted into outbound work by this correction.
UPDATE "notification_jobs"
SET "snapshot_finalized_at" = COALESCE("completed_at", "created_at")
WHERE "status" IN ('COMPLETED', 'FAILED');
