ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'LOAD';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'LOAD_FEE';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'RESERVE';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'RELEASE';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'CREATOR_PAYOUT';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'PLATFORM_COMMISSION';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'GST';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'COLLAB_REFUND';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'BRAND_RETURN';
ALTER TYPE "EscrowTransactionType" ADD VALUE IF NOT EXISTS 'REVERSAL_CORRECTION';
ALTER TYPE "EscrowTransactionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "EscrowTransactionStatus" ADD VALUE IF NOT EXISTS 'CREDITED';

CREATE TYPE "EscrowFundingSourceType" AS ENUM ('GATEWAY', 'VIRTUAL_ACCOUNT', 'BANK_TRANSFER');
CREATE TYPE "EscrowFundingState" AS ENUM ('LOAD_INITIATED', 'PENDING', 'CREDITED', 'FAILED');

ALTER TABLE "brand_escrow_vaults"
  ALTER COLUMN "razorpay_virtual_account_id" DROP NOT NULL,
  ALTER COLUMN "virtual_account_number" DROP NOT NULL,
  ALTER COLUMN "ifsc_code" DROP NOT NULL,
  ALTER COLUMN "bank_name" DROP DEFAULT,
  ALTER COLUMN "bank_name" DROP NOT NULL,
  ADD COLUMN "virtual_account_enabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "brand_escrow_vaults"
SET "virtual_account_enabled" = true
WHERE "razorpay_virtual_account_id" IS NOT NULL;

CREATE TABLE "escrow_funding_loads" (
  "funding_load_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "source_type" "EscrowFundingSourceType" NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "principal_amount" DECIMAL(15,4) NOT NULL,
  "processing_fee" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "processing_fee_tax" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "state" "EscrowFundingState" NOT NULL DEFAULT 'LOAD_INITIATED',
  "idempotency_key" TEXT,
  "provider_order_id" TEXT,
  "provider_payment_id" TEXT,
  "provider_credit_id" TEXT,
  "source_reference" TEXT,
  "initiated_at" TIMESTAMP(3),
  "credited_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escrow_funding_loads_pkey" PRIMARY KEY ("funding_load_id"),
  CONSTRAINT "escrow_funding_loads_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "brand_escrow_vaults"("vault_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "escrow_funding_loads_idempotency_key_key" ON "escrow_funding_loads"("idempotency_key");
CREATE UNIQUE INDEX "escrow_funding_loads_provider_order_id_key" ON "escrow_funding_loads"("provider_order_id");
CREATE UNIQUE INDEX "escrow_funding_loads_provider_payment_id_key" ON "escrow_funding_loads"("provider_payment_id");
CREATE UNIQUE INDEX "escrow_funding_loads_provider_credit_id_key" ON "escrow_funding_loads"("provider_credit_id");
CREATE INDEX "escrow_funding_loads_vault_id_state_idx" ON "escrow_funding_loads"("vault_id", "state");
CREATE INDEX "escrow_funding_loads_brand_id_created_at_idx" ON "escrow_funding_loads"("brand_id", "created_at");
