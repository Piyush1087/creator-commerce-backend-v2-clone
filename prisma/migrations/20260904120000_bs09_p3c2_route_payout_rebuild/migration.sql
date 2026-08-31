CREATE TYPE "CreatorPayoutOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'NEEDS_INFORMATION', 'UNDER_REVIEW', 'VERIFIED', 'RESTRICTED', 'UNKNOWN');
CREATE TYPE "CreatorPayoutBankStatus" AS ENUM ('BANK_NOT_CONFIGURED', 'BANK_VALIDATION_PENDING', 'BANK_VALIDATED', 'BANK_VALIDATION_FAILED', 'UNKNOWN');
CREATE TYPE "CreatorPayoutOperationalEligibility" AS ENUM ('NO_LINKED_ACCOUNT', 'ACCOUNT_CREATED', 'STAKEHOLDER_COMPLETE', 'ROUTE_CONFIGURATION_REQUESTED', 'NEEDS_CLARIFICATION', 'UNDER_REVIEW', 'BANK_CONFIGURATION_PENDING', 'BANK_VALIDATION_PENDING', 'ACTIVATED', 'COOLING_PERIOD', 'ELIGIBLE_FOR_TRANSFER', 'SUSPENDED_OR_RESTRICTED', 'UNKNOWN');
CREATE TYPE "CreatorPayoutObligationType" AS ENUM ('ADVANCE', 'BALANCE', 'FULL', 'RESOLUTION');
CREATE TYPE "CreatorPayoutObligationStatus" AS ENUM ('ELIGIBLE', 'EXECUTING', 'BLOCKED', 'SETTLED', 'PARTIALLY_REVERSED', 'REVERSED');
CREATE TYPE "RouteTransferState" AS ENUM ('CREATED', 'PENDING', 'PROCESSED', 'FAILED', 'REVERSED', 'PARTIALLY_REVERSED', 'UNKNOWN');
CREATE TYPE "RouteSettlementState" AS ENUM ('PENDING', 'HELD', 'RELEASE_ELIGIBLE', 'RELEASE_PROCESSING', 'RELEASED', 'SETTLED', 'BLOCKED', 'UNKNOWN');
CREATE TYPE "RouteReversalState" AS ENUM ('CREATED', 'PENDING', 'PROCESSED', 'FAILED', 'UNKNOWN');
ALTER TYPE "EscrowTransactionType" ADD VALUE 'CREATOR_PAYOUT_SETTLEMENT';
ALTER TYPE "EscrowTransactionType" ADD VALUE 'CREATOR_PAYOUT_REVERSAL';

CREATE TABLE "creator_payout_profiles" (
  "payout_profile_id" TEXT NOT NULL,
  "creator_profile_id" TEXT NOT NULL,
  "provider" VARCHAR(40) NOT NULL DEFAULT 'RAZORPAY_ROUTE',
  "external_reference_id" TEXT NOT NULL,
  "linked_account_id" TEXT,
  "stakeholder_id" TEXT,
  "product_configuration_id" TEXT,
  "onboarding_status" "CreatorPayoutOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "bank_status" "CreatorPayoutBankStatus" NOT NULL DEFAULT 'BANK_NOT_CONFIGURED',
  "operational_eligibility" "CreatorPayoutOperationalEligibility" NOT NULL DEFAULT 'NO_LINKED_ACCOUNT',
  "provider_account_status" VARCHAR(100),
  "provider_product_status" VARCHAR(100),
  "provider_bank_status" VARCHAR(100),
  "masked_bank_display" VARCHAR(64),
  "eligibility_invalidated_at" TIMESTAMP(3),
  "last_provider_reconciled_at" TIMESTAMP(3),
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creator_payout_profiles_pkey" PRIMARY KEY ("payout_profile_id")
);

CREATE TABLE "creator_payout_obligations" (
  "obligation_id" TEXT NOT NULL,
  "settlement_instruction_id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "creator_profile_id" TEXT NOT NULL,
  "payout_profile_id" TEXT NOT NULL,
  "obligation_type" "CreatorPayoutObligationType" NOT NULL,
  "entitlement_amount" DECIMAL(15,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "CreatorPayoutObligationStatus" NOT NULL DEFAULT 'ELIGIBLE',
  "instruction_issued_at" TIMESTAMP(3) NOT NULL,
  "payment_due_at" TIMESTAMP(3),
  "blocked_reason" VARCHAR(100),
  "settled_at" TIMESTAMP(3),
  "terminal_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creator_payout_obligations_pkey" PRIMARY KEY ("obligation_id"),
  CONSTRAINT "creator_payout_obligations_positive_amount" CHECK ("entitlement_amount" > 0)
);

CREATE TABLE "route_transfer_attempts" (
  "transfer_attempt_id" TEXT NOT NULL,
  "obligation_id" TEXT NOT NULL,
  "attempt_sequence" INTEGER NOT NULL,
  "profile_state_version" INTEGER NOT NULL,
  "provider" VARCHAR(40) NOT NULL DEFAULT 'RAZORPAY_ROUTE',
  "idempotency_key" TEXT NOT NULL,
  "transfer_id" TEXT,
  "amount" DECIMAL(15,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "state" "RouteTransferState" NOT NULL DEFAULT 'CREATED',
  "settlement_state" "RouteSettlementState" NOT NULL DEFAULT 'PENDING',
  "on_hold" BOOLEAN NOT NULL DEFAULT false,
  "on_hold_until" TIMESTAMP(3),
  "provider_state" VARCHAR(100),
  "settlement_id" TEXT,
  "diagnostic_payload" JSONB,
  "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "provider_accepted_at" TIMESTAMP(3),
  "processed_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "settled_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "route_transfer_attempts_pkey" PRIMARY KEY ("transfer_attempt_id"),
  CONSTRAINT "route_transfer_attempts_positive_amount" CHECK ("amount" > 0)
);

CREATE TABLE "route_transfer_reversals" (
  "route_reversal_record_id" TEXT NOT NULL,
  "transfer_attempt_id" TEXT NOT NULL,
  "reversal_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "amount" DECIMAL(15,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "state" "RouteReversalState" NOT NULL DEFAULT 'CREATED',
  "provider_state" VARCHAR(100),
  "diagnostic_payload" JSONB,
  "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "route_transfer_reversals_pkey" PRIMARY KEY ("route_reversal_record_id"),
  CONSTRAINT "route_transfer_reversals_positive_amount" CHECK ("amount" > 0)
);

CREATE TABLE "route_webhook_receipts" (
  "webhook_receipt_id" TEXT NOT NULL,
  "event_identity" TEXT NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "provider_object_id" TEXT,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "route_webhook_receipts_pkey" PRIMARY KEY ("webhook_receipt_id")
);

CREATE UNIQUE INDEX "creator_payout_profiles_creator_profile_id_key" ON "creator_payout_profiles"("creator_profile_id");
CREATE UNIQUE INDEX "creator_payout_profiles_external_reference_id_key" ON "creator_payout_profiles"("external_reference_id");
CREATE UNIQUE INDEX "creator_payout_profiles_linked_account_id_key" ON "creator_payout_profiles"("linked_account_id");
CREATE UNIQUE INDEX "creator_payout_profiles_stakeholder_id_key" ON "creator_payout_profiles"("stakeholder_id");
CREATE UNIQUE INDEX "creator_payout_profiles_product_configuration_id_key" ON "creator_payout_profiles"("product_configuration_id");
CREATE INDEX "creator_payout_profiles_operational_eligibility_updated_at_idx" ON "creator_payout_profiles"("operational_eligibility", "updated_at");
CREATE UNIQUE INDEX "creator_payout_obligations_settlement_instruction_id_key" ON "creator_payout_obligations"("settlement_instruction_id");
CREATE INDEX "creator_payout_obligations_brand_id_status_created_at_idx" ON "creator_payout_obligations"("brand_id", "status", "created_at");
CREATE INDEX "creator_payout_obligations_collaboration_id_status_idx" ON "creator_payout_obligations"("collaboration_id", "status");
CREATE INDEX "creator_payout_obligations_creator_profile_id_status_idx" ON "creator_payout_obligations"("creator_profile_id", "status");
CREATE UNIQUE INDEX "route_transfer_attempts_idempotency_key_key" ON "route_transfer_attempts"("idempotency_key");
CREATE UNIQUE INDEX "route_transfer_attempts_transfer_id_key" ON "route_transfer_attempts"("transfer_id");
CREATE UNIQUE INDEX "route_transfer_attempts_settlement_id_key" ON "route_transfer_attempts"("settlement_id");
CREATE UNIQUE INDEX "route_transfer_attempts_obligation_id_attempt_sequence_key" ON "route_transfer_attempts"("obligation_id", "attempt_sequence");
CREATE INDEX "route_transfer_attempts_obligation_id_state_created_at_idx" ON "route_transfer_attempts"("obligation_id", "state", "created_at");
CREATE UNIQUE INDEX "route_transfer_reversals_reversal_id_key" ON "route_transfer_reversals"("reversal_id");
CREATE UNIQUE INDEX "route_transfer_reversals_idempotency_key_key" ON "route_transfer_reversals"("idempotency_key");
CREATE INDEX "route_transfer_reversals_transfer_attempt_id_state_created_at_idx" ON "route_transfer_reversals"("transfer_attempt_id", "state", "created_at");
CREATE UNIQUE INDEX "route_webhook_receipts_event_identity_key" ON "route_webhook_receipts"("event_identity");
CREATE INDEX "route_webhook_receipts_provider_object_id_processed_at_idx" ON "route_webhook_receipts"("provider_object_id", "processed_at");

ALTER TABLE "creator_payout_profiles" ADD CONSTRAINT "creator_payout_profiles_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_payout_obligations" ADD CONSTRAINT "creator_payout_obligations_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_obligations" ADD CONSTRAINT "creator_payout_obligations_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "brand_escrow_vaults"("vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_obligations" ADD CONSTRAINT "creator_payout_obligations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_obligations" ADD CONSTRAINT "creator_payout_obligations_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_obligations" ADD CONSTRAINT "creator_payout_obligations_payout_profile_id_fkey" FOREIGN KEY ("payout_profile_id") REFERENCES "creator_payout_profiles"("payout_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "route_transfer_attempts" ADD CONSTRAINT "route_transfer_attempts_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "creator_payout_obligations"("obligation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "route_transfer_reversals" ADD CONSTRAINT "route_transfer_reversals_transfer_attempt_id_fkey" FOREIGN KEY ("transfer_attempt_id") REFERENCES "route_transfer_attempts"("transfer_attempt_id") ON DELETE RESTRICT ON UPDATE CASCADE;
