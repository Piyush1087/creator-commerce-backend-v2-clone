CREATE TYPE "CollaborationResolutionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'RESOLVED');
CREATE TYPE "CollaborationFinancialOutcome" AS ENUM ('NORMAL_SUCCESS', 'NEGOTIATION_EXIT', 'PRE_SECUREMENT_EXIT', 'BRAND_PROTECTED_POST_SECUREMENT_EXIT', 'FULFILLMENT_HARD_STOP', 'PRODUCTION_HARD_STOP', 'CREATOR_NON_PERFORMANCE', 'CREATOR_PUBLISHING_NON_PERFORMANCE', 'ADMIN_RESOLUTION', 'OTHER_POLICY_RESOLUTION');

ALTER TABLE "collaborations"
ADD COLUMN "ended_from_stage" "CollaborationStage",
ADD COLUMN "ended_reason_code" TEXT,
ADD COLUMN "ended_reason_text" TEXT,
ADD COLUMN "ended_by_actor_class" "CollaborationActorClass",
ADD COLUMN "ended_by_user_id" TEXT,
ADD COLUMN "ended_at" TIMESTAMP(3),
ADD COLUMN "completed_at" TIMESTAMP(3);

ALTER TABLE "collaboration_commercial_agreements"
ADD COLUMN "funding_instruction_ref" TEXT,
ADD COLUMN "funding_confirmation_ref" TEXT,
ADD COLUMN "manual_payment_evidence_ref" TEXT,
ADD COLUMN "manual_creator_confirmed_at" TIMESTAMP(3),
ADD COLUMN "payment_dispute_ref" TEXT,
ADD COLUMN "securement_completed_at" TIMESTAMP(3);

ALTER TABLE "collaboration_events"
ADD COLUMN "event_type" TEXT NOT NULL DEFAULT 'LEGACY_EVENT',
ADD COLUMN "actor_class" "CollaborationActorClass" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN "actor_user_id" TEXT,
ADD COLUMN "correlation_id" TEXT;

ALTER TABLE "collaboration_events" ALTER COLUMN "event_type" DROP DEFAULT;
ALTER TABLE "collaboration_events" ALTER COLUMN "actor_class" DROP DEFAULT;

CREATE TABLE "collaboration_financial_resolutions" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "status" "CollaborationResolutionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "outcome" "CollaborationFinancialOutcome",
  "creator_entitlement_amount" DECIMAL(14,2),
  "brand_refund_entitlement_amount" DECIMAL(14,2),
  "currency" VARCHAR(3),
  "reason_code" TEXT,
  "reason_text" TEXT,
  "resolution_evidence" JSONB,
  "residual_obligations" JSONB,
  "decided_by_actor_class" "CollaborationActorClass",
  "decided_by_user_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "collaboration_financial_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_financial_resolutions_collaboration_id_key" ON "collaboration_financial_resolutions"("collaboration_id");
CREATE INDEX "collaboration_financial_resolutions_status_idx" ON "collaboration_financial_resolutions"("status");
CREATE INDEX "collaboration_financial_resolutions_outcome_idx" ON "collaboration_financial_resolutions"("outcome");
CREATE UNIQUE INDEX "collaboration_events_collaboration_id_aggregate_version_key" ON "collaboration_events"("collaboration_id", "aggregate_version");
CREATE INDEX "collaboration_events_event_type_occurred_at_idx" ON "collaboration_events"("event_type", "occurred_at");

ALTER TABLE "collaboration_financial_resolutions"
ADD CONSTRAINT "collaboration_financial_resolutions_collaboration_id_fkey"
FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
