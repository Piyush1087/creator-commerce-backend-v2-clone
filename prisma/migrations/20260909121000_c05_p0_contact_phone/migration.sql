-- Preserve the legacy display phone while adding canonical structured fields.
-- No historical value is inferred or backfilled by this additive migration.
ALTER TABLE "creator_shipping_addresses"
ADD COLUMN "phone_country_calling_code" VARCHAR(8),
ADD COLUMN "phone_national_number" VARCHAR(32),
ADD COLUMN "phone_e164" VARCHAR(20);
