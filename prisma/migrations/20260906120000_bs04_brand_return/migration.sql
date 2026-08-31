CREATE TYPE "EscrowFundingLotSourceType" AS ENUM ('GATEWAY', 'VIRTUAL_ACCOUNT', 'BANK_TRANSFER', 'LEGACY_SOURCE_UNKNOWN');
CREATE TYPE "EscrowFundingProvenanceStatus" AS ENUM ('LEGACY_SOURCE_UNKNOWN', 'SOURCE_UNRESOLVED', 'PROVEN_SOURCE');
CREATE TYPE "BrandReturnStatus" AS ENUM ('RETURN_REQUESTED', 'ALLOCATING_SOURCES', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'ACTION_REQUIRED', 'FAILED');
CREATE TYPE "BrandReturnAllocationState" AS ENUM ('READY', 'PROCESSING', 'SUCCEEDED', 'FAILED_TERMINAL', 'ACTION_REQUIRED', 'RELEASED');
CREATE TYPE "BrandReturnActionRequiredReason" AS ENUM ('SOURCE_PROVENANCE_REQUIRED', 'PROVIDER_SETUP_REQUIRED', 'PROVIDER_OUTCOME_AMBIGUOUS', 'SOURCE_NO_LONGER_REFUNDABLE', 'PROVIDER_RECONCILIATION_REQUIRED', 'UNSUPPORTED_SOURCE', 'UNSUPPORTED_CURRENCY');

ALTER TABLE "brand_escrow_vaults"
  ADD COLUMN "active_return_commitment" DECIMAL(15,4) NOT NULL DEFAULT 0;

ALTER TABLE "escrow_funding_loads"
  ADD COLUMN "credited_principal" DECIMAL(15,4),
  ADD COLUMN "captured_amount" DECIMAL(15,4),
  ADD COLUMN "payment_currency" VARCHAR(3),
  ADD COLUMN "payment_captured" BOOLEAN,
  ADD COLUMN "provenance_status" "EscrowFundingProvenanceStatus" NOT NULL DEFAULT 'SOURCE_UNRESOLVED';

CREATE TABLE "escrow_funding_lots" (
  "funding_lot_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "funding_load_id" TEXT,
  "source_type" "EscrowFundingLotSourceType" NOT NULL,
  "provenance_status" "EscrowFundingProvenanceStatus" NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "requested_principal" DECIMAL(15,4) NOT NULL,
  "credited_principal" DECIMAL(15,4) NOT NULL,
  "captured_amount" DECIMAL(15,4),
  "provider_refundable_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "provider_order_id" TEXT,
  "provider_payment_id" TEXT,
  "provider_payment_captured" BOOLEAN,
  "available_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "locked_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "return_committed_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "consumed_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "externally_returned_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "economic_at" TIMESTAMP(3) NOT NULL,
  "credited_at" TIMESTAMP(3),
  "provenance_diagnostic" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "escrow_funding_lots_pkey" PRIMARY KEY ("funding_lot_id"),
  CONSTRAINT "escrow_funding_lots_non_negative" CHECK (
    "requested_principal" >= 0 AND
    "credited_principal" >= 0 AND
    ("captured_amount" IS NULL OR "captured_amount" >= 0) AND
    "provider_refundable_amount" >= 0 AND
    "available_amount" >= 0 AND
    "locked_amount" >= 0 AND
    "return_committed_amount" >= 0 AND
    "consumed_amount" >= 0 AND
    "externally_returned_amount" >= 0
  ),
  CONSTRAINT "escrow_funding_lots_bucket_reconciliation" CHECK (
    "credited_principal" =
      "available_amount" +
      "locked_amount" +
      "return_committed_amount" +
      "consumed_amount" +
      "externally_returned_amount"
  ),
  CONSTRAINT "escrow_funding_lots_refundable_cap" CHECK (
    "externally_returned_amount" + "return_committed_amount" <= "provider_refundable_amount"
    OR "provenance_status" <> 'PROVEN_SOURCE'
  )
);

CREATE TABLE "collaboration_funding_lot_allocations" (
  "collaboration_lot_allocation_id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "funding_lot_id" TEXT NOT NULL,
  "reserved_amount" DECIMAL(15,4) NOT NULL,
  "locked_amount" DECIMAL(15,4) NOT NULL,
  "consumed_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "released_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_funding_lot_allocations_pkey" PRIMARY KEY ("collaboration_lot_allocation_id"),
  CONSTRAINT "collaboration_funding_lot_allocations_positive" CHECK ("reserved_amount" > 0),
  CONSTRAINT "collaboration_funding_lot_allocations_non_negative" CHECK ("locked_amount" >= 0 AND "consumed_amount" >= 0 AND "released_amount" >= 0),
  CONSTRAINT "collaboration_funding_lot_allocations_reconciliation" CHECK ("reserved_amount" = "locked_amount" + "consumed_amount" + "released_amount")
);

CREATE TABLE "brand_return_requests" (
  "brand_return_request_id" TEXT NOT NULL,
  "request_identity" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "requested_amount" DECIMAL(15,4) NOT NULL,
  "committed_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "successful_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "unresolved_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "released_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL,
  "status" "BrandReturnStatus" NOT NULL DEFAULT 'RETURN_REQUESTED',
  "action_required_reason" "BrandReturnActionRequiredReason",
  "requested_by_user_id" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processing_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_return_requests_pkey" PRIMARY KEY ("brand_return_request_id"),
  CONSTRAINT "brand_return_requests_positive" CHECK ("requested_amount" > 0),
  CONSTRAINT "brand_return_requests_non_negative" CHECK ("committed_amount" >= 0 AND "successful_amount" >= 0 AND "unresolved_amount" >= 0 AND "released_amount" >= 0),
  CONSTRAINT "brand_return_requests_reconciliation" CHECK ("requested_amount" = "successful_amount" + "unresolved_amount" + "released_amount")
);

CREATE TABLE "brand_return_allocations" (
  "brand_return_allocation_id" TEXT NOT NULL,
  "brand_return_request_id" TEXT NOT NULL,
  "funding_lot_id" TEXT NOT NULL,
  "semantic_identity" TEXT NOT NULL,
  "provider_payment_id" TEXT NOT NULL,
  "amount" DECIMAL(15,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "state" "BrandReturnAllocationState" NOT NULL DEFAULT 'READY',
  "action_required_reason" "BrandReturnActionRequiredReason",
  "provider_refund_id" TEXT,
  "provider_state" VARCHAR(100),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "diagnostic_payload" JSONB,
  "last_attempt_at" TIMESTAMP(3),
  "succeeded_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_return_allocations_pkey" PRIMARY KEY ("brand_return_allocation_id"),
  CONSTRAINT "brand_return_allocations_positive" CHECK ("amount" > 0),
  CONSTRAINT "brand_return_allocations_attempts" CHECK ("attempt_count" >= 0)
);

CREATE TABLE "creator_payout_funding_allocations" (
  "creator_payout_funding_allocation_id" TEXT NOT NULL,
  "obligation_id" TEXT NOT NULL,
  "collaboration_lot_allocation_id" TEXT NOT NULL,
  "funding_lot_id" TEXT NOT NULL,
  "allocated_amount" DECIMAL(15,4) NOT NULL,
  "consumed_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "reversed_amount" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creator_payout_funding_allocations_pkey" PRIMARY KEY ("creator_payout_funding_allocation_id"),
  CONSTRAINT "creator_payout_funding_allocations_positive" CHECK ("allocated_amount" > 0),
  CONSTRAINT "creator_payout_funding_allocations_reconciliation" CHECK ("consumed_amount" >= 0 AND "reversed_amount" >= 0 AND "consumed_amount" + "reversed_amount" <= "allocated_amount")
);

CREATE TABLE "brand_return_webhook_receipts" (
  "brand_return_webhook_receipt_id" TEXT NOT NULL,
  "event_identity" TEXT NOT NULL,
  "event_type" VARCHAR(120) NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "provider_refund_id" TEXT,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_return_webhook_receipts_pkey" PRIMARY KEY ("brand_return_webhook_receipt_id")
);

CREATE UNIQUE INDEX "escrow_funding_lots_funding_load_id_key" ON "escrow_funding_lots"("funding_load_id");
CREATE UNIQUE INDEX "escrow_funding_lots_provider_payment_id_key" ON "escrow_funding_lots"("provider_payment_id");
CREATE INDEX "escrow_funding_lots_vault_economic_idx" ON "escrow_funding_lots"("vault_id", "economic_at", "funding_lot_id");
CREATE INDEX "escrow_funding_lots_brand_provenance_currency_idx" ON "escrow_funding_lots"("brand_id", "provenance_status", "currency");
CREATE UNIQUE INDEX "collaboration_funding_lot_allocations_collaboration_lot_key" ON "collaboration_funding_lot_allocations"("collaboration_id", "funding_lot_id");
CREATE INDEX "collaboration_funding_lot_allocations_lot_created_idx" ON "collaboration_funding_lot_allocations"("funding_lot_id", "created_at");
CREATE UNIQUE INDEX "brand_return_requests_request_identity_key" ON "brand_return_requests"("request_identity");
CREATE INDEX "brand_return_requests_brand_created_idx" ON "brand_return_requests"("brand_id", "created_at");
CREATE INDEX "brand_return_requests_vault_status_created_idx" ON "brand_return_requests"("vault_id", "status", "created_at");
CREATE UNIQUE INDEX "brand_return_allocations_semantic_identity_key" ON "brand_return_allocations"("semantic_identity");
CREATE UNIQUE INDEX "brand_return_allocations_provider_refund_id_key" ON "brand_return_allocations"("provider_refund_id");
CREATE UNIQUE INDEX "brand_return_allocations_request_lot_key" ON "brand_return_allocations"("brand_return_request_id", "funding_lot_id");
CREATE INDEX "brand_return_allocations_request_state_created_idx" ON "brand_return_allocations"("brand_return_request_id", "state", "created_at");
CREATE INDEX "brand_return_allocations_lot_state_created_idx" ON "brand_return_allocations"("funding_lot_id", "state", "created_at");
CREATE UNIQUE INDEX "creator_payout_funding_allocations_obligation_lot_key" ON "creator_payout_funding_allocations"("obligation_id", "funding_lot_id");
CREATE INDEX "creator_payout_funding_allocations_collaboration_created_idx" ON "creator_payout_funding_allocations"("collaboration_lot_allocation_id", "created_at");
CREATE UNIQUE INDEX "brand_return_webhook_receipts_event_identity_key" ON "brand_return_webhook_receipts"("event_identity");
CREATE INDEX "brand_return_webhook_receipts_refund_processed_idx" ON "brand_return_webhook_receipts"("provider_refund_id", "processed_at");

ALTER TABLE "escrow_funding_lots" ADD CONSTRAINT "escrow_funding_lots_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "brand_escrow_vaults"("vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_funding_lots" ADD CONSTRAINT "escrow_funding_lots_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "escrow_funding_lots" ADD CONSTRAINT "escrow_funding_lots_funding_load_id_fkey" FOREIGN KEY ("funding_load_id") REFERENCES "escrow_funding_loads"("funding_load_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_funding_lot_allocations" ADD CONSTRAINT "collaboration_funding_lot_allocations_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_funding_lot_allocations" ADD CONSTRAINT "collaboration_funding_lot_allocations_funding_lot_id_fkey" FOREIGN KEY ("funding_lot_id") REFERENCES "escrow_funding_lots"("funding_lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brand_return_requests" ADD CONSTRAINT "brand_return_requests_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "brand_escrow_vaults"("vault_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brand_return_requests" ADD CONSTRAINT "brand_return_requests_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brand_return_allocations" ADD CONSTRAINT "brand_return_allocations_request_id_fkey" FOREIGN KEY ("brand_return_request_id") REFERENCES "brand_return_requests"("brand_return_request_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brand_return_allocations" ADD CONSTRAINT "brand_return_allocations_funding_lot_id_fkey" FOREIGN KEY ("funding_lot_id") REFERENCES "escrow_funding_lots"("funding_lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_funding_allocations" ADD CONSTRAINT "creator_payout_funding_allocations_obligation_id_fkey" FOREIGN KEY ("obligation_id") REFERENCES "creator_payout_obligations"("obligation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_funding_allocations" ADD CONSTRAINT "creator_payout_funding_allocations_collaboration_allocation_id_fkey" FOREIGN KEY ("collaboration_lot_allocation_id") REFERENCES "collaboration_funding_lot_allocations"("collaboration_lot_allocation_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "creator_payout_funding_allocations" ADD CONSTRAINT "creator_payout_funding_allocations_funding_lot_id_fkey" FOREIGN KEY ("funding_lot_id") REFERENCES "escrow_funding_lots"("funding_lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "escrow_funding_lots" (
  "funding_lot_id", "vault_id", "brand_id", "source_type", "provenance_status",
  "currency", "requested_principal", "credited_principal", "provider_refundable_amount",
  "available_amount", "locked_amount", "return_committed_amount", "consumed_amount",
  "externally_returned_amount", "economic_at", "credited_at", "provenance_diagnostic", "updated_at"
)
SELECT
  'legacy-opening:' || "vault_id",
  "vault_id",
  "brand_id",
  'LEGACY_SOURCE_UNKNOWN',
  'LEGACY_SOURCE_UNKNOWN',
  "currency",
  "total_pooled_balance",
  "total_pooled_balance",
  0,
  "available_balance",
  "locked_campaign_funds",
  0,
  0,
  0,
  TIMESTAMP '1970-01-01 00:00:00',
  NULL,
  jsonb_build_object('classification', 'LEGACY_SOURCE_UNKNOWN', 'migration', '20260906120000_bs04_brand_return'),
  CURRENT_TIMESTAMP
FROM "brand_escrow_vaults"
WHERE "total_pooled_balance" > 0;

ALTER TABLE "brand_escrow_vaults" DROP CONSTRAINT "check_escrow_ledger_integrity";
ALTER TABLE "brand_escrow_vaults" DROP CONSTRAINT "check_escrow_non_negative_balances";
ALTER TABLE "brand_escrow_vaults" ADD CONSTRAINT "check_escrow_ledger_integrity" CHECK (
  "total_pooled_balance" = "available_balance" + "locked_campaign_funds" + "active_return_commitment"
);
ALTER TABLE "brand_escrow_vaults" ADD CONSTRAINT "check_escrow_non_negative_balances" CHECK (
  "total_pooled_balance" >= 0 AND
  "locked_campaign_funds" >= 0 AND
  "available_balance" >= 0 AND
  "active_return_commitment" >= 0 AND
  "tds_buffer_balance" >= 0
);
