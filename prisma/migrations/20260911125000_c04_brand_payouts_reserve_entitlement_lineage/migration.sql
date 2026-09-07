-- C04 exact reserve-entitlement lineage V3 proposal; NOT APPROVED; NOT APPLIED.
-- Exact base fc4d4b59e2a44d7ddced6bc5dde5119c501ec275 / 84 migrations.
BEGIN;
CREATE TYPE "CollaborationFundingLineageMode" AS ENUM ('LEGACY_UNRECONCILED','CANONICAL_PAYOUTS_V1');
CREATE TYPE "CollaborationFundingConfirmationDisposition" AS ENUM ('COMPLETED_SUFFICIENT');
CREATE TYPE "CollaborationFundingConfirmationApplicationState" AS ENUM ('LEGACY_APPLIED','APPLIED');

ALTER TABLE "collaboration_trusted_confirmations"
  ADD COLUMN "lineage_mode" "CollaborationFundingLineageMode" NOT NULL DEFAULT 'LEGACY_UNRECONCILED',
  ADD COLUMN "funding_confirmation_ref" VARCHAR(80),
  ADD COLUMN "reserve_instruction_id" TEXT,
  ADD COLUMN "reserve_request_id" TEXT,
  ADD COLUMN "reserve_instruction_version" INTEGER,
  ADD COLUMN "reserve_instruction_hash" CHAR(64),
  ADD COLUMN "commercial_agreement_id" TEXT,
  ADD COLUMN "agreement_version" INTEGER,
  ADD COLUMN "agreement_hash" CHAR(64),
  ADD COLUMN "payouts_approval_ref" VARCHAR(80),
  ADD COLUMN "reserve_execution_attempt_ref" VARCHAR(80),
  ADD COLUMN "escrow_lock_id" TEXT,
  ADD COLUMN "reserve_ledger_transaction_id" TEXT,
  ADD COLUMN "brand_profile_id" TEXT,
  ADD COLUMN "campaign_id" TEXT,
  ADD COLUMN "creator_profile_id" TEXT,
  ADD COLUMN "confirmed_amount" VARCHAR(15),
  ADD COLUMN "currency" VARCHAR(3),
  ADD COLUMN "disposition" "CollaborationFundingConfirmationDisposition",
  ADD COLUMN "observed_at" TIMESTAMP(3),
  ADD COLUMN "lineage_applied_at" TIMESTAMP(3),
  ADD COLUMN "application_state" "CollaborationFundingConfirmationApplicationState" NOT NULL DEFAULT 'LEGACY_APPLIED',
  ADD CONSTRAINT "c04_lineage_reserve_instruction_fk" FOREIGN KEY ("reserve_instruction_id") REFERENCES "collaboration_reserve_instructions"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_agreement_fk" FOREIGN KEY ("commercial_agreement_id") REFERENCES "collaboration_commercial_agreements"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_lock_fk" FOREIGN KEY ("escrow_lock_id") REFERENCES "collaboration_escrow_locks"("lock_id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_ledger_fk" FOREIGN KEY ("reserve_ledger_transaction_id") REFERENCES "escrow_transaction_ledger"("transaction_id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_brand_fk" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_campaign_fk" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_creator_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_lineage_mode_tuple_check" CHECK
    (("lineage_mode"='LEGACY_UNRECONCILED' AND "application_state"='LEGACY_APPLIED' AND "funding_confirmation_ref" IS NULL AND "reserve_instruction_id" IS NULL AND "reserve_request_id" IS NULL AND "reserve_instruction_version" IS NULL AND "reserve_instruction_hash" IS NULL AND "commercial_agreement_id" IS NULL AND "agreement_version" IS NULL AND "agreement_hash" IS NULL AND "payouts_approval_ref" IS NULL AND "reserve_execution_attempt_ref" IS NULL AND "escrow_lock_id" IS NULL AND "reserve_ledger_transaction_id" IS NULL AND "brand_profile_id" IS NULL AND "campaign_id" IS NULL AND "creator_profile_id" IS NULL AND "confirmed_amount" IS NULL AND "currency" IS NULL AND "disposition" IS NULL AND "observed_at" IS NULL AND "lineage_applied_at" IS NULL)
     OR ("lineage_mode"='CANONICAL_PAYOUTS_V1' AND "confirmation_type"='ESCROW_FUNDING' AND "application_state"='APPLIED' AND "funding_confirmation_ref" ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$' AND "confirmation_id" ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$' AND "reserve_instruction_id" IS NOT NULL AND "reserve_request_id" ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$' AND "reserve_instruction_version" IS NOT NULL AND "reserve_instruction_hash" ~ '^[0-9a-f]{64}$' AND "commercial_agreement_id" IS NOT NULL AND "agreement_version" IS NOT NULL AND "agreement_hash" ~ '^[0-9a-f]{64}$' AND "body_digest" ~ '^[0-9a-f]{64}$' AND "payouts_approval_ref" ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$' AND "reserve_execution_attempt_ref" ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$' AND "escrow_lock_id" IS NOT NULL AND "reserve_ledger_transaction_id" IS NOT NULL AND "brand_profile_id" IS NOT NULL AND "campaign_id" IS NOT NULL AND "creator_profile_id" IS NOT NULL AND "confirmed_amount" ~ '^(0|[1-9][0-9]{0,11})\.[0-9]{2}$' AND "confirmed_amount"::numeric>0 AND "confirmed_amount"::numeric<=999999999999.99 AND "currency"='INR' AND "disposition"='COMPLETED_SUFFICIENT' AND "observed_at" IS NOT NULL AND "lineage_applied_at" IS NOT NULL AND "lineage_applied_at">="observed_at"));

CREATE UNIQUE INDEX "c04_lineage_one_completed_per_reserve_key" ON "collaboration_trusted_confirmations"("reserve_instruction_id") WHERE "lineage_mode"='CANONICAL_PAYOUTS_V1' AND "disposition"='COMPLETED_SUFFICIENT';
CREATE UNIQUE INDEX "c04_lineage_approval_ref_key" ON "collaboration_trusted_confirmations"("payouts_approval_ref") WHERE "lineage_mode"='CANONICAL_PAYOUTS_V1';
CREATE UNIQUE INDEX "c04_lineage_execution_ref_key" ON "collaboration_trusted_confirmations"("reserve_execution_attempt_ref") WHERE "lineage_mode"='CANONICAL_PAYOUTS_V1';
ALTER TABLE "collaboration_trusted_confirmations" ADD CONSTRAINT "c04_lineage_ledger_key" UNIQUE ("reserve_ledger_transaction_id");
CREATE INDEX "c04_lineage_reserve_disposition_idx" ON "collaboration_trusted_confirmations"("reserve_instruction_id","disposition","applied_at");

ALTER TABLE "collaboration_financial_authority_instructions"
  ADD COLUMN "funding_lineage_mode" "CollaborationFundingLineageMode" NOT NULL DEFAULT 'LEGACY_UNRECONCILED',
  ADD COLUMN "funding_confirmation_id" TEXT,
  ADD COLUMN "reserve_instruction_id" TEXT,
  ADD CONSTRAINT "c04_entitlement_confirmation_fk" FOREIGN KEY ("funding_confirmation_id") REFERENCES "collaboration_trusted_confirmations"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_entitlement_reserve_fk" FOREIGN KEY ("reserve_instruction_id") REFERENCES "collaboration_reserve_instructions"("id") ON UPDATE RESTRICT ON DELETE RESTRICT,
  ADD CONSTRAINT "c04_entitlement_lineage_tuple_check" CHECK
    (("funding_lineage_mode"='LEGACY_UNRECONCILED' AND "funding_confirmation_id" IS NULL AND "reserve_instruction_id" IS NULL)
     OR ("funding_lineage_mode"='CANONICAL_PAYOUTS_V1' AND "kind"='CREATOR_ENTITLEMENT' AND "resolution_type"='NORMAL_SUCCESS' AND "effect_scope"='FULL' AND "creator_entitlement_effect">0 AND "brand_refund_effect"=0 AND "funding_confirmation_id" IS NOT NULL AND "reserve_instruction_id" IS NOT NULL));
ALTER TABLE "collaboration_financial_authority_instructions" ADD CONSTRAINT "c04_entitlement_confirmation_key" UNIQUE ("funding_confirmation_id");
CREATE INDEX "c04_entitlement_reserve_idx" ON "collaboration_financial_authority_instructions"("reserve_instruction_id","kind","instruction_version");

CREATE FUNCTION "c04_serialize_reserve_instruction"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior_id TEXT; prior_version INTEGER; current_count INTEGER;
BEGIN
  IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM "collaborations" c WHERE c."id"=NEW."collaboration_id" AND c."authority_version"='CANONICAL_V1') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('c04-reserve:'||NEW."collaboration_id",0));
    SELECT count(*),min(r."id"),min(r."instruction_version") INTO current_count,prior_id,prior_version
      FROM "collaboration_reserve_instructions" r
      WHERE r."collaboration_id"=NEW."collaboration_id" AND r."commercial_agreement_id"=NEW."commercial_agreement_id"
        AND NOT EXISTS(SELECT 1 FROM "collaboration_reserve_instructions" n WHERE n."supersedes_instruction_id"=r."id");
    IF current_count=0 THEN
      IF NEW."instruction_version"<>1 OR NEW."supersedes_instruction_id" IS NOT NULL THEN RAISE EXCEPTION 'C04_INVALID_INITIAL_RESERVE_VERSION'; END IF;
    ELSIF current_count<>1 OR NEW."supersedes_instruction_id" IS DISTINCT FROM prior_id OR NEW."instruction_version"<>prior_version+1
       OR EXISTS(SELECT 1 FROM "collaboration_trusted_confirmations" f WHERE f."reserve_instruction_id"=prior_id AND f."lineage_mode"='CANONICAL_PAYOUTS_V1' AND f."application_state"='APPLIED' AND f."disposition"='COMPLETED_SUFFICIENT') THEN
      RAISE EXCEPTION 'C04_ILLEGAL_RESERVE_SUPERSESSION';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "c04_reserve_instruction_serialize_insert" BEFORE INSERT ON "collaboration_reserve_instructions" FOR EACH ROW EXECUTE FUNCTION "c04_serialize_reserve_instruction"();

CREATE FUNCTION "c04_validate_funding_lineage"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r "collaboration_reserve_instructions"%ROWTYPE; a "collaboration_commercial_agreements"%ROWTYPE; c "collaborations"%ROWTYPE; l "collaboration_escrow_locks"%ROWTYPE; e "escrow_transaction_ledger"%ROWTYPE; v "brand_escrow_vaults"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD."lineage_mode"='CANONICAL_PAYOUTS_V1' THEN RAISE EXCEPTION 'C04_FUNDING_LINEAGE_APPEND_ONLY'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD."lineage_mode"='CANONICAL_PAYOUTS_V1' OR NEW."lineage_mode"='CANONICAL_PAYOUTS_V1' THEN RAISE EXCEPTION 'C04_FUNDING_LINEAGE_APPEND_ONLY'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT c FROM "collaborations" WHERE "id"=NEW."collaboration_id";
  IF c."authority_version"='CANONICAL_V1' AND NEW."confirmation_type"='ESCROW_FUNDING' AND NEW."lineage_mode"<>'CANONICAL_PAYOUTS_V1' THEN RAISE EXCEPTION 'C04_CANONICAL_CONFIRMATION_REQUIRES_LINEAGE'; END IF;
  IF NEW."lineage_mode"='CANONICAL_PAYOUTS_V1' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('c04-reserve:'||NEW."collaboration_id",0));
    NEW."body_digest":=lower(NEW."body_digest"); NEW."observed_at":=clock_timestamp(); NEW."application_state":='APPLIED'; NEW."lineage_applied_at":=clock_timestamp();
    SELECT * INTO STRICT r FROM "collaboration_reserve_instructions" WHERE "id"=NEW."reserve_instruction_id" FOR SHARE;
    SELECT * INTO STRICT a FROM "collaboration_commercial_agreements" WHERE "id"=r."commercial_agreement_id" FOR SHARE;
    SELECT * INTO STRICT l FROM "collaboration_escrow_locks" WHERE "lock_id"=NEW."escrow_lock_id" FOR SHARE;
    SELECT * INTO STRICT e FROM "escrow_transaction_ledger" WHERE "transaction_id"=NEW."reserve_ledger_transaction_id" FOR SHARE;
    SELECT * INTO STRICT v FROM "brand_escrow_vaults" WHERE "vault_id"=e."vault_id" FOR SHARE;
    IF NEW."collaboration_id"<>r."collaboration_id" OR r."status"<>'REQUESTED' OR EXISTS(SELECT 1 FROM "collaboration_reserve_instructions" n WHERE n."supersedes_instruction_id"=r."id")
       OR ROW(NEW."reserve_request_id",NEW."reserve_instruction_version",NEW."reserve_instruction_hash",NEW."commercial_agreement_id",NEW."agreement_version",NEW."agreement_hash",NEW."brand_profile_id",NEW."campaign_id",NEW."creator_profile_id",NEW."confirmed_amount"::numeric,NEW."currency") IS DISTINCT FROM ROW(r."request_id",r."instruction_version",r."instruction_hash",r."commercial_agreement_id",r."agreement_version",r."agreement_hash",r."brand_profile_id",r."campaign_id",r."creator_profile_id",r."reserve_amount",r."currency")
       OR ROW(c."brand_id",c."campaign_id",c."creator_profile_id") IS DISTINCT FROM ROW(r."brand_profile_id",r."campaign_id",r."creator_profile_id")
       OR ROW(a."collaboration_id",a."agreement_version",a."agreement_hash") IS DISTINCT FROM ROW(r."collaboration_id",r."agreement_version",r."agreement_hash")
       OR ROW(l."collaboration_id",l."brand_id",l."gross_creator_quote",l."platform_commission_fee",l."platform_commission_gst",l."total_escrow_locked_amount") IS DISTINCT FROM ROW(r."collaboration_id",r."brand_profile_id",r."creator_fee",r."platform_commission_amount",r."platform_commission_gst_amount",r."reserve_amount")
       OR l."expected_tds_percentage"<>0 OR l."calculated_tds_deduction"<>0 OR l."net_creator_payout_pool"<>r."creator_fee"
       OR ROW(e."brand_id",e."collaboration_id",e."transaction_type",e."amount",e."currency",e."transaction_status",e."gateway_processing_surcharge",e."gateway_surcharge_gst") IS DISTINCT FROM ROW(r."brand_profile_id",r."collaboration_id",'CONTRACT_LOCK_RESERVE'::"EscrowTransactionType",r."reserve_amount",r."currency",'CLEARED'::"EscrowTransactionStatus",0::numeric,0::numeric)
       OR ROW(v."brand_id",v."currency") IS DISTINCT FROM ROW(r."brand_profile_id",r."currency") THEN RAISE EXCEPTION 'C04_FUNDING_LINEAGE_MISMATCH'; END IF;
    IF NEW."disposition"='COMPLETED_SUFFICIENT' AND NEW."confirmed_amount"::numeric<>r."reserve_amount" THEN RAISE EXCEPTION 'C04_COMPLETED_CONFIRMATION_AMOUNT_MISMATCH'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "c04_funding_lineage_validate_insert" BEFORE INSERT ON "collaboration_trusted_confirmations" FOR EACH ROW EXECUTE FUNCTION "c04_validate_funding_lineage"();
CREATE TRIGGER "c04_funding_lineage_guard_update_delete" BEFORE UPDATE OR DELETE ON "collaboration_trusted_confirmations" FOR EACH ROW EXECUTE FUNCTION "c04_validate_funding_lineage"();

CREATE FUNCTION "c04_require_applied_projection"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."lineage_mode"='CANONICAL_PAYOUTS_V1' AND NOT EXISTS (
    SELECT 1
    FROM "collaboration_commercial_agreements" a
    JOIN "collaboration_events" ev ON ev."collaboration_id"=NEW."collaboration_id"
    WHERE a."id"=NEW."commercial_agreement_id"
      AND a."collaboration_id"=NEW."collaboration_id"
      AND a."funding_confirmation_ref"=NEW."funding_confirmation_ref"
      AND a."escrow_lock_ref"=NEW."escrow_lock_id"
      AND a."confirmed_secured_amount"=NEW."confirmed_amount"::numeric
      AND a."currency"=NEW."currency"
      AND a."securement_state"='COMPLETED'
      AND a."securement_completed_at" IS NOT NULL
      AND ev."event_type"='ESCROW_FUNDING_CONFIRMATION_RECORDED'
      AND ev."actor_class"='SYSTEM'
      AND ev."command_id"='trusted:escrow:'||NEW."confirmation_id"
      AND ev."payload"->>'fundingConfirmationRef'=NEW."funding_confirmation_ref"
      AND ev."payload"->>'escrowLockRef'=NEW."escrow_lock_id"
      AND (ev."payload"->>'confirmedAmount')::numeric=NEW."confirmed_amount"::numeric
      AND ev."payload"->>'currency'=NEW."currency"
  ) THEN RAISE EXCEPTION 'C04_APPLIED_CONFIRMATION_REQUIRES_EXACT_DOMAIN_PROJECTION'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER "c04_applied_projection_deferred_check"
AFTER INSERT OR UPDATE ON "collaboration_trusted_confirmations"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "c04_require_applied_projection"();

CREATE FUNCTION "c04_guard_reserve_authority"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE canonical boolean;
BEGIN
  SELECT c."authority_version"='CANONICAL_V1' INTO canonical
  FROM "collaborations" c WHERE c."id"=OLD."collaboration_id";
  IF canonical THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('c04-reserve:'||OLD."collaboration_id",0));
    RAISE EXCEPTION 'C04_CANONICAL_RESERVE_AUTHORITY_APPEND_ONLY';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER "c04_reserve_authority_update_delete_guard"
BEFORE UPDATE OR DELETE ON "collaboration_reserve_instructions"
FOR EACH ROW EXECUTE FUNCTION "c04_guard_reserve_authority"();

CREATE FUNCTION "c04_validate_entitlement_lineage"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE f "collaboration_trusted_confirmations"%ROWTYPE; r "collaboration_reserve_instructions"%ROWTYPE;
BEGIN
  IF (TG_OP='DELETE' AND OLD."funding_lineage_mode"='CANONICAL_PAYOUTS_V1')
     OR (TG_OP='UPDATE' AND (OLD."funding_lineage_mode"='CANONICAL_PAYOUTS_V1' OR NEW."funding_lineage_mode"='CANONICAL_PAYOUTS_V1'))
  THEN RAISE EXCEPTION 'C04_ENTITLEMENT_AUTHORITY_APPEND_ONLY'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='INSERT' AND NEW."kind"='CREATOR_ENTITLEMENT' AND NEW."resolution_type"='NORMAL_SUCCESS' AND NEW."funding_lineage_mode"<>'CANONICAL_PAYOUTS_V1' THEN RAISE EXCEPTION 'C04_NORMAL_ENTITLEMENT_REQUIRES_PROTECTED_FUNDING'; END IF;
  IF NEW."funding_lineage_mode"='CANONICAL_PAYOUTS_V1' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('c04-reserve:'||NEW."collaboration_id",0));
    SELECT * INTO STRICT f FROM "collaboration_trusted_confirmations" WHERE "id"=NEW."funding_confirmation_id";
    SELECT * INTO STRICT r FROM "collaboration_reserve_instructions" WHERE "id"=NEW."reserve_instruction_id";
    IF f."lineage_mode"<>'CANONICAL_PAYOUTS_V1' OR f."application_state"<>'APPLIED' OR f."disposition"<>'COMPLETED_SUFFICIENT' OR f."reserve_instruction_id"<>r."id"
       OR EXISTS(SELECT 1 FROM "collaboration_reserve_instructions" n WHERE n."supersedes_instruction_id"=r."id")
       OR ROW(NEW."collaboration_id",NEW."commercial_agreement_id",NEW."agreement_version",NEW."agreement_hash",NEW."amount",NEW."currency",NEW."creator_entitlement_effect",NEW."brand_refund_effect") IS DISTINCT FROM ROW(r."collaboration_id",r."commercial_agreement_id",r."agreement_version",r."agreement_hash",r."creator_fee",r."currency",r."creator_fee",0::numeric) THEN RAISE EXCEPTION 'C04_ENTITLEMENT_PROTECTED_FUNDING_MISMATCH'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "c04_entitlement_lineage_validate_guard" BEFORE INSERT OR UPDATE OR DELETE ON "collaboration_financial_authority_instructions" FOR EACH ROW EXECUTE FUNCTION "c04_validate_entitlement_lineage"();

COMMIT;
