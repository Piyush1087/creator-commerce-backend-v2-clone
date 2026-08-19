ALTER TABLE "collaboration_publishing_executions"
ADD COLUMN "compliance_verified_at" TIMESTAMP(3),
ADD COLUMN "blocked_reason" TEXT;

CREATE TABLE "collaboration_publishing_evidence" (
  "id" TEXT NOT NULL,
  "publishing_execution_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "evidence_ref" TEXT NOT NULL,
  "platform" VARCHAR(100),
  "creator_note" TEXT,
  "evidence_metadata" JSONB,
  "submitted_by_user_id" TEXT NOT NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "correction_reason" TEXT,
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "compliance_evidence_ref" TEXT,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_publishing_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_publishing_evidence_publishing_execution_id_sequence_key"
ON "collaboration_publishing_evidence"("publishing_execution_id", "sequence");

CREATE INDEX "collaboration_publishing_evidence_publishing_execution_id_submitted_at_idx"
ON "collaboration_publishing_evidence"("publishing_execution_id", "submitted_at");

ALTER TABLE "collaboration_publishing_evidence"
ADD CONSTRAINT "collaboration_publishing_evidence_publishing_execution_id_fkey"
FOREIGN KEY ("publishing_execution_id") REFERENCES "collaboration_publishing_executions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
