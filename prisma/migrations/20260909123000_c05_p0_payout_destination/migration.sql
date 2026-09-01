CREATE TYPE "CreatorPayoutDestinationType" AS ENUM ('BANK_ACCOUNT', 'UPI', 'PAYPAL');
CREATE TYPE "CreatorPayoutDestinationState" AS ENUM ('CONFIGURED_UNVERIFIED', 'NEEDS_ATTENTION', 'DISABLED');

CREATE TABLE "creator_payout_destinations" (
  "destination_id" TEXT NOT NULL,
  "creator_profile_id" TEXT NOT NULL,
  "payee_type" "CreatorPayeeType" NOT NULL,
  "beneficiary_name" VARCHAR(255) NOT NULL,
  "destination_type" "CreatorPayoutDestinationType" NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "currency_code" CHAR(3) NOT NULL,
  "secret_payload_encrypted" TEXT NOT NULL,
  "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
  "masked_display" VARCHAR(160) NOT NULL,
  "is_primary" BOOLEAN NOT NULL DEFAULT true,
  "state" "CreatorPayoutDestinationState" NOT NULL DEFAULT 'CONFIGURED_UNVERIFIED',
  "reason_code" VARCHAR(100),
  "version" INTEGER NOT NULL DEFAULT 1,
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creator_payout_destinations_pkey" PRIMARY KEY ("destination_id"),
  CONSTRAINT "creator_payout_destinations_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "creator_payout_destinations_currency_code_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "creator_payout_destinations_key_version_check" CHECK ("encryption_key_version" >= 1),
  CONSTRAINT "creator_payout_destinations_version_check" CHECK ("version" >= 1),
  CONSTRAINT "creator_payout_destinations_disabled_state_check" CHECK (
    ("state" = 'DISABLED' AND "disabled_at" IS NOT NULL)
    OR ("state" <> 'DISABLED' AND "disabled_at" IS NULL)
  )
);

CREATE TABLE "creator_payout_destination_provider_mappings" (
  "mapping_id" TEXT NOT NULL,
  "destination_id" TEXT NOT NULL,
  "destination_version" INTEGER NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "provider_reference" VARCHAR(255),
  "provider_status" VARCHAR(100),
  "last_reconciled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creator_payout_destination_provider_mappings_pkey" PRIMARY KEY ("mapping_id"),
  CONSTRAINT "creator_payout_provider_mapping_version_check" CHECK ("destination_version" >= 1)
);

CREATE INDEX "creator_payout_destinations_profile_state_idx"
ON "creator_payout_destinations"("creator_profile_id", "state");

CREATE UNIQUE INDEX "creator_payout_destinations_active_primary_key"
ON "creator_payout_destinations"("creator_profile_id")
WHERE "is_primary" = true AND "state" <> 'DISABLED';

CREATE UNIQUE INDEX "creator_payout_provider_mapping_version_key"
ON "creator_payout_destination_provider_mappings"("destination_id", "destination_version", "provider");

CREATE INDEX "creator_payout_provider_reference_idx"
ON "creator_payout_destination_provider_mappings"("provider", "provider_reference");

ALTER TABLE "creator_payout_destinations"
ADD CONSTRAINT "creator_payout_destinations_creator_profile_id_fkey"
FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "creator_payout_destination_provider_mappings"
ADD CONSTRAINT "creator_payout_destination_provider_mappings_destination_id_fkey"
FOREIGN KEY ("destination_id") REFERENCES "creator_payout_destinations"("destination_id")
ON DELETE CASCADE ON UPDATE CASCADE;
