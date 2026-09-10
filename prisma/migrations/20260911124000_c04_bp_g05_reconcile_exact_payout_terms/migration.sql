-- Reconcile only rows whose immutable canonical Campaign evidence proves the exact term.
UPDATE "uce_campaign_commercials" AS commercials
SET "final_balance_terms" = 'NET_45'::"UcePayoutTerms"
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}' = 'NET_45';

UPDATE "uce_campaign_commercials" AS commercials
SET "final_balance_terms" = 'NET_60'::"UcePayoutTerms"
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND commercials."final_balance_terms" = 'NET_30'::"UcePayoutTerms"
  AND campaign."canonical_definition" #>> '{commercials,payout_terms}' = 'NET_60';

ALTER TABLE "collaboration_commercial_agreements"
  ADD COLUMN "agreement_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "agreement_hash" CHAR(64),
  ADD COLUMN "campaign_payment_term_snapshot" "UcePayoutTerms";

CREATE TABLE "collaboration_reserve_instructions" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "commercial_agreement_id" TEXT NOT NULL,
  "agreement_version" INTEGER NOT NULL,
  "agreement_hash" CHAR(64) NOT NULL,
  "instruction_version" INTEGER NOT NULL,
  "instruction_hash" CHAR(64) NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "creator_profile_id" TEXT NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "creator_fee" DECIMAL(14,2) NOT NULL,
  "platform_commission_amount" DECIMAL(14,2) NOT NULL,
  "platform_commission_gst_amount" DECIMAL(14,2) NOT NULL,
  "reserve_amount" DECIMAL(14,2) NOT NULL,
  "requested_by_user_id" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(40) NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "supersedes_instruction_id" TEXT,
  CONSTRAINT "collaboration_reserve_instructions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collaboration_reserve_instructions_request_id_key" ON "collaboration_reserve_instructions"("request_id");
CREATE UNIQUE INDEX "c04_reserve_collab_version_key" ON "collaboration_reserve_instructions"("collaboration_id", "instruction_version");
CREATE UNIQUE INDEX "c04_reserve_collab_idempotency_key" ON "collaboration_reserve_instructions"("collaboration_id", "idempotency_key");
CREATE INDEX "c04_reserve_agreement_idx" ON "collaboration_reserve_instructions"("commercial_agreement_id");

CREATE TABLE "collaboration_financial_authority_instructions" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "commercial_agreement_id" TEXT NOT NULL,
  "agreement_version" INTEGER NOT NULL,
  "agreement_hash" CHAR(64) NOT NULL,
  "kind" VARCHAR(48) NOT NULL,
  "instruction_version" INTEGER NOT NULL,
  "instruction_hash" CHAR(64) NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "creator_entitlement_effect" DECIMAL(14,2) NOT NULL,
  "brand_refund_effect" DECIMAL(14,2) NOT NULL,
  "settlement_eligible_at" TIMESTAMP(3),
  "resolution_type" VARCHAR(64),
  "effect_scope" VARCHAR(16) NOT NULL,
  "source_entitlement_ref" TEXT,
  "source_financial_ref" TEXT,
  "supersedes_instruction_id" TEXT,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaboration_financial_authority_instructions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "c04_financial_collab_kind_version_key" ON "collaboration_financial_authority_instructions"("collaboration_id", "kind", "instruction_version");
CREATE INDEX "c04_financial_agreement_idx" ON "collaboration_financial_authority_instructions"("commercial_agreement_id");
CREATE INDEX "c04_financial_settlement_eligible_idx" ON "collaboration_financial_authority_instructions"("collaboration_id", "settlement_eligible_at");

ALTER TABLE "collaboration_reserve_instructions" ADD CONSTRAINT "collaboration_reserve_instructions_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_reserve_instructions" ADD CONSTRAINT "collaboration_reserve_instructions_commercial_agreement_id_fkey" FOREIGN KEY ("commercial_agreement_id") REFERENCES "collaboration_commercial_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_reserve_instructions" ADD CONSTRAINT "collaboration_reserve_instructions_supersedes_instruction__fkey" FOREIGN KEY ("supersedes_instruction_id") REFERENCES "collaboration_reserve_instructions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_financial_authority_instructions" ADD CONSTRAINT "collaboration_financial_authority_instructions_collaborati_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_financial_authority_instructions" ADD CONSTRAINT "collaboration_financial_authority_instructions_commercial__fkey" FOREIGN KEY ("commercial_agreement_id") REFERENCES "collaboration_commercial_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaboration_financial_authority_instructions" ADD CONSTRAINT "collaboration_financial_authority_instructions_supersedes__fkey" FOREIGN KEY ("supersedes_instruction_id") REFERENCES "collaboration_financial_authority_instructions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- These authority records are append-only. Status changes/supersession publish a new version.
CREATE FUNCTION "c04_reject_financial_authority_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'C-04 financial authority records are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "c04_reserve_instruction_immutable" BEFORE UPDATE OR DELETE ON "collaboration_reserve_instructions" FOR EACH ROW EXECUTE FUNCTION "c04_reject_financial_authority_mutation"();
CREATE TRIGGER "c04_financial_authority_immutable" BEFORE UPDATE OR DELETE ON "collaboration_financial_authority_instructions" FOR EACH ROW EXECUTE FUNCTION "c04_reject_financial_authority_mutation"();
