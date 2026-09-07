CREATE TYPE "CreatorPayeeType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- Tax identifiers and provider KYC evidence are intentionally absent in MVP.
CREATE TABLE "creator_legal_profiles" (
  "legal_profile_id" TEXT NOT NULL,
  "creator_profile_id" TEXT NOT NULL,
  "payee_type" "CreatorPayeeType" NOT NULL,
  "legal_name" VARCHAR(255) NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "address_line_1" VARCHAR(255) NOT NULL,
  "address_line_2" VARCHAR(255),
  "city" VARCHAR(120) NOT NULL,
  "state_region" VARCHAR(120),
  "postal_code" VARCHAR(32) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "creator_legal_profiles_pkey" PRIMARY KEY ("legal_profile_id"),
  CONSTRAINT "creator_legal_profiles_country_code_check" CHECK ("country_code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "creator_legal_profiles_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "creator_legal_profiles_creator_profile_id_key"
ON "creator_legal_profiles"("creator_profile_id");

ALTER TABLE "creator_legal_profiles"
ADD CONSTRAINT "creator_legal_profiles_creator_profile_id_fkey"
FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
