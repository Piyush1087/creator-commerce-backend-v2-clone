-- BS-03 keeps legacy PAN/TDS/currency columns for non-destructive compatibility,
-- while adding only the canonical billing identity and lifecycle fields.
CREATE TYPE "BillingProfileState" AS ENUM ('CONFIGURED', 'UPDATED');

ALTER TABLE "brand_billing_profiles"
  ADD COLUMN "legal_entity_type" VARCHAR(100),
  ADD COLUMN "billing_country_code" CHAR(2),
  ADD COLUMN "profile_state" "BillingProfileState" NOT NULL DEFAULT 'CONFIGURED',
  ADD COLUMN "configured_at" TIMESTAMP(3);
