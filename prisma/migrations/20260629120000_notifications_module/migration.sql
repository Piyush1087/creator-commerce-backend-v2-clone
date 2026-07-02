-- Notifications module (Phase 1): event log, per-user delivery state, Postgres job queue.
-- IDs are TEXT to match legacy brand_profiles / users (not UUID).

CREATE TYPE "NotificationUrgencyLevel" AS ENUM ('CRITICAL', 'MEDIUM', 'LOW');
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "trigger_user_id" TEXT,
    "event_type" VARCHAR(100) NOT NULL,
    "urgency_level" "NotificationUrgencyLevel" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notifications_trigger_user_id_fkey" FOREIGN KEY ("trigger_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_emailed" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "notification_recipients_notification_id_user_id_key"
    ON "notification_recipients"("notification_id", "user_id");

CREATE INDEX "notification_recipients_user_id_is_read_idx"
    ON "notification_recipients"("user_id", "is_read");

CREATE INDEX "notifications_workspace_id_idx" ON "notifications"("workspace_id");

CREATE INDEX "notifications_workspace_id_event_type_created_at_idx"
    ON "notifications"("workspace_id", "event_type", "created_at");

CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "urgency_level" "NotificationUrgencyLevel" NOT NULL,
    "trigger_user_id" TEXT,
    "payload" JSONB NOT NULL,
    "actor_name" VARCHAR(200),
    "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" VARCHAR(100),
    "last_error" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_jobs_status_scheduled_at_idx"
    ON "notification_jobs"("status", "scheduled_at");
