ALTER TABLE "collaboration_commercial_agreements"
ADD COLUMN "pricing_tier_snapshot" VARCHAR(80),
ADD COLUMN "business_country_code_snapshot" VARCHAR(2),
ADD COLUMN "financial_policy_version_snapshot" VARCHAR(80),
ADD COLUMN "platform_commission_rate_snapshot" DECIMAL(7,4),
ADD COLUMN "platform_commission_amount" DECIMAL(14,2),
ADD COLUMN "platform_commission_gst_rate_snapshot" DECIMAL(7,4),
ADD COLUMN "platform_commission_gst_amount" DECIMAL(14,2),
ADD COLUMN "escrow_lock_ref" TEXT;

ALTER TABLE "collaboration_financial_resolutions"
ADD COLUMN "creator_gross_entitlement_amount" DECIMAL(14,2),
ADD COLUMN "creator_commercial_refund_amount" DECIMAL(14,2),
ADD COLUMN "platform_commission_retained_amount" DECIMAL(14,2),
ADD COLUMN "platform_commission_refund_amount" DECIMAL(14,2),
ADD COLUMN "platform_commission_gst_retained_amount" DECIMAL(14,2),
ADD COLUMN "platform_commission_gst_refund_amount" DECIMAL(14,2),
ADD COLUMN "brand_commercial_refund_entitlement_amount" DECIMAL(14,2);

CREATE INDEX "collaboration_commercial_agreements_pricing_tier_snapshot_business_country_code_snapshot_idx"
ON "collaboration_commercial_agreements"("pricing_tier_snapshot", "business_country_code_snapshot");
