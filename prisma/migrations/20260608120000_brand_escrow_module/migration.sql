-- CreateEnum
CREATE TYPE "EscrowTransactionType" AS ENUM ('VBA_TOPUP_WIRE', 'GATEWAY_TOPUP_CARD', 'CONTRACT_LOCK_RESERVE', 'TRANCHE_ADVANCE_RELEASE', 'TRANCHE_FINAL_RELEASE', 'PLATFORM_FEE_CAPTURE', 'TDS_BUFFER_REVERSAL', 'FAILED_COLLAB_REFUND');

-- CreateEnum
CREATE TYPE "EscrowTransactionStatus" AS ENUM ('PROCESSING_GATEWAY', 'CLEARED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "EscrowPayoutTranche" AS ENUM ('ADVANCE_30', 'FINAL_70', 'PLATFORM_COMMISSION');

-- CreateEnum
CREATE TYPE "IdempotencyExecutionState" AS ENUM ('IN_FLIGHT', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "brand_escrow_vaults" (
    "vault_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "razorpay_virtual_account_id" TEXT NOT NULL,
    "virtual_account_number" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL DEFAULT 'RBL Bank (Razorpay Escrow Partner Node)',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "total_pooled_balance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "locked_campaign_funds" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "available_balance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "tds_buffer_balance" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_escrow_vaults_pkey" PRIMARY KEY ("vault_id")
);

-- CreateTable
CREATE TABLE "collaboration_escrow_locks" (
    "lock_id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "gross_creator_quote" DECIMAL(15,4) NOT NULL,
    "platform_commission_fee" DECIMAL(15,4) NOT NULL,
    "platform_commission_gst" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "total_escrow_locked_amount" DECIMAL(15,4) NOT NULL,
    "expected_tds_percentage" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "calculated_tds_deduction" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "net_creator_payout_pool" DECIMAL(15,4) NOT NULL,
    "advance_tranche_disbursed" BOOLEAN NOT NULL DEFAULT false,
    "final_tranche_disbursed" BOOLEAN NOT NULL DEFAULT false,
    "lock_released_via_refund" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_escrow_locks_pkey" PRIMARY KEY ("lock_id")
);

-- CreateTable
CREATE TABLE "escrow_transaction_ledger" (
    "transaction_id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "collaboration_id" TEXT,
    "transaction_type" "EscrowTransactionType" NOT NULL,
    "payout_tranche_target" "EscrowPayoutTranche",
    "amount" DECIMAL(15,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "gateway_processing_surcharge" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "gateway_surcharge_gst" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "idempotency_key" TEXT NOT NULL,
    "gateway_reference_id" TEXT,
    "transaction_status" "EscrowTransactionStatus" NOT NULL DEFAULT 'PROCESSING_GATEWAY',
    "error_diagnostic_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_transaction_ledger_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "creator_settlement_profiles" (
    "settlement_profile_id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "bank_account_number" TEXT NOT NULL,
    "ifsc_code" TEXT NOT NULL,
    "pan_number" VARCHAR(10),
    "is_pan_verified" BOOLEAN NOT NULL DEFAULT false,
    "razorpay_fund_account_id" TEXT,
    "is_settlement_route_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_settlement_profiles_pkey" PRIMARY KEY ("settlement_profile_id")
);

-- CreateTable
CREATE TABLE "idempotency_registry" (
    "idempotency_key" TEXT NOT NULL,
    "request_path" TEXT NOT NULL,
    "execution_state" "IdempotencyExecutionState" NOT NULL DEFAULT 'IN_FLIGHT',
    "cached_response" JSONB,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_registry_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "brand_escrow_vaults_brand_id_key" ON "brand_escrow_vaults"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_escrow_vaults_razorpay_virtual_account_id_key" ON "brand_escrow_vaults"("razorpay_virtual_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_escrow_vaults_virtual_account_number_key" ON "brand_escrow_vaults"("virtual_account_number");

-- CreateIndex
CREATE INDEX "brand_escrow_vaults_brand_id_idx" ON "brand_escrow_vaults"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_escrow_locks_collaboration_id_key" ON "collaboration_escrow_locks"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_escrow_locks_collaboration_id_idx" ON "collaboration_escrow_locks"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_escrow_locks_brand_id_idx" ON "collaboration_escrow_locks"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transaction_ledger_idempotency_key_key" ON "escrow_transaction_ledger"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "escrow_transaction_ledger_gateway_reference_id_key" ON "escrow_transaction_ledger"("gateway_reference_id");

-- CreateIndex
CREATE INDEX "escrow_transaction_ledger_vault_id_idx" ON "escrow_transaction_ledger"("vault_id");

-- CreateIndex
CREATE INDEX "escrow_transaction_ledger_brand_id_collaboration_id_transacti_idx" ON "escrow_transaction_ledger"("brand_id", "collaboration_id", "transaction_type");

-- CreateIndex
CREATE INDEX "escrow_transaction_ledger_collaboration_id_idx" ON "escrow_transaction_ledger"("collaboration_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_settlement_profiles_creator_profile_id_key" ON "creator_settlement_profiles"("creator_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_settlement_profiles_razorpay_fund_account_id_key" ON "creator_settlement_profiles"("razorpay_fund_account_id");

-- CreateIndex
CREATE INDEX "creator_settlement_profiles_creator_profile_id_idx" ON "creator_settlement_profiles"("creator_profile_id");

-- AddForeignKey
ALTER TABLE "brand_escrow_vaults" ADD CONSTRAINT "brand_escrow_vaults_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_escrow_locks" ADD CONSTRAINT "collaboration_escrow_locks_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_transaction_ledger" ADD CONSTRAINT "escrow_transaction_ledger_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "brand_escrow_vaults"("vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_settlement_profiles" ADD CONSTRAINT "creator_settlement_profiles_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Balance integrity guardrail (product docs)
ALTER TABLE "brand_escrow_vaults" ADD CONSTRAINT "check_escrow_ledger_integrity"
  CHECK ("available_balance" = ("total_pooled_balance" - "locked_campaign_funds"));

ALTER TABLE "brand_escrow_vaults" ADD CONSTRAINT "check_escrow_non_negative_balances"
  CHECK (
    "total_pooled_balance" >= 0
    AND "locked_campaign_funds" >= 0
    AND "available_balance" >= 0
    AND "tds_buffer_balance" >= 0
  );

ALTER TABLE "collaboration_escrow_locks" ADD CONSTRAINT "check_lock_math_totals"
  CHECK ("total_escrow_locked_amount" = ("gross_creator_quote" + "platform_commission_fee" + "platform_commission_gst"));

ALTER TABLE "collaboration_escrow_locks" ADD CONSTRAINT "check_net_creator_disbursal_split"
  CHECK ("net_creator_payout_pool" = ("gross_creator_quote" - "calculated_tds_deduction"));
