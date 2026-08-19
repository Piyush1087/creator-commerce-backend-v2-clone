ALTER TABLE "collaboration_fulfillments"
ADD COLUMN "shipment_tracking_ref" TEXT,
ADD COLUMN "courier_name" TEXT,
ADD COLUMN "access_evidence_ref" TEXT,
ADD COLUMN "redemption_code" TEXT,
ADD COLUMN "service_evidence_ref" TEXT,
ADD COLUMN "generic_fulfillment_evidence" JSONB,
ADD COLUMN "brand_fulfilled_at" TIMESTAMP(3),
ADD COLUMN "creator_confirmed_at" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "hard_stopped_at" TIMESTAMP(3);

CREATE TABLE "collaboration_fulfillment_issues" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "issue_code" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "evidence_ref" TEXT,
  "reported_by_user_id" TEXT,
  "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remediation_evidence_ref" TEXT,
  "remediation_at" TIMESTAMP(3),
  CONSTRAINT "collaboration_fulfillment_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_fulfillment_issues_fulfillment_id_sequence_key"
ON "collaboration_fulfillment_issues"("fulfillment_id", "sequence");

CREATE INDEX "collaboration_fulfillment_issues_fulfillment_id_reported_at_idx"
ON "collaboration_fulfillment_issues"("fulfillment_id", "reported_at");

ALTER TABLE "collaboration_fulfillment_issues"
ADD CONSTRAINT "collaboration_fulfillment_issues_fulfillment_id_fkey"
FOREIGN KEY ("fulfillment_id") REFERENCES "collaboration_fulfillments"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
