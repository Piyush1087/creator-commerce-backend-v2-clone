CREATE TABLE "collaboration_refund_instructions" (
  "refund_instruction_record_id" TEXT NOT NULL,
  "refund_instruction_id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "amount" DECIMAL(15,4) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "financial_resolution_reference" TEXT NOT NULL,
  "instruction_issued_at" TIMESTAMP(3) NOT NULL,
  "triggering_user_id" TEXT,
  "ledger_transaction_id" TEXT NOT NULL,
  "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_refund_instructions_pkey" PRIMARY KEY ("refund_instruction_record_id"),
  CONSTRAINT "collaboration_refund_instructions_positive_amount" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "collaboration_refund_instructions_refund_instruction_id_key"
  ON "collaboration_refund_instructions"("refund_instruction_id");
CREATE UNIQUE INDEX "collaboration_refund_instructions_ledger_transaction_id_key"
  ON "collaboration_refund_instructions"("ledger_transaction_id");
CREATE INDEX "collaboration_refund_instructions_collaboration_id_executed_at_idx"
  ON "collaboration_refund_instructions"("collaboration_id", "executed_at");
CREATE INDEX "collaboration_refund_instructions_brand_id_executed_at_idx"
  ON "collaboration_refund_instructions"("brand_id", "executed_at");

ALTER TABLE "collaboration_refund_instructions"
  ADD CONSTRAINT "collaboration_refund_instructions_collaboration_id_fkey"
  FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_refund_instructions"
  ADD CONSTRAINT "collaboration_refund_instructions_vault_id_fkey"
  FOREIGN KEY ("vault_id") REFERENCES "brand_escrow_vaults"("vault_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_refund_instructions"
  ADD CONSTRAINT "collaboration_refund_instructions_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_refund_instructions"
  ADD CONSTRAINT "collaboration_refund_instructions_ledger_transaction_id_fkey"
  FOREIGN KEY ("ledger_transaction_id") REFERENCES "escrow_transaction_ledger"("transaction_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
