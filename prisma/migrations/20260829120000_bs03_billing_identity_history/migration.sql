CREATE TABLE "brand_billing_profile_versions" (
  "version_id" TEXT NOT NULL,
  "brand_id" TEXT NOT NULL,
  "legal_entity_name" VARCHAR(255) NOT NULL,
  "legal_entity_type" VARCHAR(100),
  "billing_country_code" CHAR(2),
  "billing_address" TEXT NOT NULL,
  "gstin" VARCHAR(15),
  "effective_from" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_billing_profile_versions_pkey" PRIMARY KEY ("version_id")
);

CREATE INDEX "brand_billing_profile_versions_brand_id_effective_from_idx"
  ON "brand_billing_profile_versions"("brand_id", "effective_from");

ALTER TABLE "brand_billing_profile_versions"
  ADD CONSTRAINT "brand_billing_profile_versions_brand_id_fkey"
  FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill only the earliest trustworthy known current identity. This does not
-- claim any identity before configured_at/updated_at and preserves null new fields.
INSERT INTO "brand_billing_profile_versions" (
  "version_id", "brand_id", "legal_entity_name", "legal_entity_type",
  "billing_country_code", "billing_address", "gstin", "effective_from", "created_at"
)
SELECT
  (gen_random_uuid())::text, "brand_id", "registered_company_name", "legal_entity_type",
  "billing_country_code", "corporate_billing_address", "gstin",
  COALESCE("configured_at", "updated_at"), COALESCE("configured_at", "updated_at")
FROM "brand_billing_profiles";

ALTER TABLE "brand_billing_invoices"
  ADD COLUMN "billing_profile_version_id" TEXT,
  ADD COLUMN "billing_legal_entity_name" VARCHAR(255),
  ADD COLUMN "billing_legal_entity_type" VARCHAR(100),
  ADD COLUMN "billing_country_code" CHAR(2),
  ADD COLUMN "billing_address" TEXT,
  ADD COLUMN "billing_gstin" VARCHAR(15);

CREATE INDEX "brand_billing_invoices_billing_profile_version_id_idx"
  ON "brand_billing_invoices"("billing_profile_version_id");

ALTER TABLE "brand_billing_invoices"
  ADD CONSTRAINT "brand_billing_invoices_billing_profile_version_id_fkey"
  FOREIGN KEY ("billing_profile_version_id") REFERENCES "brand_billing_profile_versions"("version_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
