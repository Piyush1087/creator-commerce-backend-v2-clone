ALTER TABLE "collaboration_deliverable_executions"
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "auto_approved_at" TIMESTAMP(3),
ADD COLUMN "hard_stopped_at" TIMESTAMP(3);

ALTER TABLE "collaboration_publishing_executions"
ADD COLUMN "authorized_at" TIMESTAMP(3),
ADD COLUMN "authorized_by_user_id" TEXT;

CREATE TABLE "collaboration_submission_versions" (
  "id" TEXT NOT NULL,
  "deliverable_execution_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "asset_ref" TEXT NOT NULL,
  "creator_note" TEXT,
  "submission_metadata" JSONB,
  "submitted_by_user_id" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "review_deadline_at" TIMESTAMP(3) NOT NULL,
  "review_state" "CollaborationSubmissionReviewState" NOT NULL DEFAULT 'UNDER_REVIEW',
  "brand_feedback" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "superseded_at" TIMESTAMP(3),
  "auto_approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_submission_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_submission_versions_deliverable_execution_id_version_number_key"
ON "collaboration_submission_versions"("deliverable_execution_id", "version_number");

CREATE INDEX "collaboration_submission_versions_review_state_review_deadline_at_idx"
ON "collaboration_submission_versions"("review_state", "review_deadline_at");

CREATE INDEX "collaboration_submission_versions_deliverable_execution_id_submitted_at_idx"
ON "collaboration_submission_versions"("deliverable_execution_id", "submitted_at");

ALTER TABLE "collaboration_submission_versions"
ADD CONSTRAINT "collaboration_submission_versions_deliverable_execution_id_fkey"
FOREIGN KEY ("deliverable_execution_id") REFERENCES "collaboration_deliverable_executions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
