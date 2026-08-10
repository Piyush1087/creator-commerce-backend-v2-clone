CREATE TYPE "CollaborationSettlementState" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'PROCESSING', 'SETTLED', 'BLOCKED');
CREATE TYPE "CollaborationSettlementLegState" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PROCESSING', 'CONFIRMED', 'BLOCKED');

CREATE TABLE "collaboration_settlements" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "state" "CollaborationSettlementState" NOT NULL DEFAULT 'NOT_ELIGIBLE',
  "creator_payout_state" "CollaborationSettlementLegState" NOT NULL DEFAULT 'NOT_REQUIRED',
  "brand_refund_state" "CollaborationSettlementLegState" NOT NULL DEFAULT 'NOT_REQUIRED',
  "creator_settlement_amount" DECIMAL(14,2),
  "brand_refund_amount" DECIMAL(14,2),
  "currency" VARCHAR(3),
  "payout_instruction_ref" TEXT,
  "refund_instruction_ref" TEXT,
  "payout_execution_ref" TEXT,
  "refund_execution_ref" TEXT,
  "payout_confirmation_ref" TEXT,
  "refund_confirmation_ref" TEXT,
  "authoritative_confirmation_ref" TEXT,
  "eligible_at" TIMESTAMP(3),
  "processing_at" TIMESTAMP(3),
  "settled_at" TIMESTAMP(3),
  "blocked_at" TIMESTAMP(3),
  "blocked_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaboration_settlements_collaboration_id_key" ON "collaboration_settlements"("collaboration_id");
CREATE INDEX "collaboration_settlements_state_idx" ON "collaboration_settlements"("state");
ALTER TABLE "collaboration_settlements" ADD CONSTRAINT "collaboration_settlements_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
