CREATE TYPE "EscrowCreatorPayoutStatus" AS ENUM ('APPROVED', 'PROCESSING', 'PAID', 'FAILED');
CREATE TYPE "EscrowCreatorPayoutAttemptStatus" AS ENUM ('CREATED', 'PROCESSING', 'PAID', 'FAILED', 'REVERSED');

ALTER TABLE "creator_settlement_profiles"
ADD COLUMN "razorpay_contact_id" TEXT;

CREATE TABLE "escrow_creator_payouts" (
  "payout_id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "escrow_lock_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "creator_profile_id" TEXT NOT NULL,
  "tranche" "EscrowPayoutTranche" NOT NULL,
  "contracted_amount" DECIMAL(15,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "EscrowCreatorPayoutStatus" NOT NULL DEFAULT 'APPROVED',
  "approved_by_user_id" TEXT NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processing_at" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "current_provider" TEXT,
  "current_provider_payout_id" TEXT,
  "current_provider_status" TEXT,
  "diagnostic_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escrow_creator_payouts_pkey" PRIMARY KEY ("payout_id")
);

CREATE TABLE "escrow_creator_payout_attempts" (
  "attempt_id" TEXT NOT NULL,
  "payout_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_payout_id" TEXT,
  "provider_idempotency_key" TEXT NOT NULL,
  "provider_status" TEXT,
  "status" "EscrowCreatorPayoutAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "terminal_at" TIMESTAMP(3),
  "diagnostic_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escrow_creator_payout_attempts_pkey" PRIMARY KEY ("attempt_id")
);

CREATE UNIQUE INDEX "escrow_creator_payouts_collaboration_id_tranche_key" ON "escrow_creator_payouts"("collaboration_id", "tranche");
CREATE UNIQUE INDEX "escrow_creator_payouts_current_provider_payout_id_key" ON "escrow_creator_payouts"("current_provider_payout_id");
CREATE INDEX "escrow_creator_payouts_brand_id_status_created_at_idx" ON "escrow_creator_payouts"("brand_id", "status", "created_at");
CREATE INDEX "escrow_creator_payouts_escrow_lock_id_idx" ON "escrow_creator_payouts"("escrow_lock_id");
CREATE UNIQUE INDEX "escrow_creator_payout_attempts_provider_payout_id_key" ON "escrow_creator_payout_attempts"("provider_payout_id");
CREATE UNIQUE INDEX "escrow_creator_payout_attempts_provider_idempotency_key_key" ON "escrow_creator_payout_attempts"("provider_idempotency_key");
CREATE INDEX "escrow_creator_payout_attempts_payout_id_initiated_at_idx" ON "escrow_creator_payout_attempts"("payout_id", "initiated_at");
ALTER TABLE "escrow_creator_payout_attempts" ADD CONSTRAINT "escrow_creator_payout_attempts_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "escrow_creator_payouts"("payout_id") ON DELETE RESTRICT ON UPDATE CASCADE;
