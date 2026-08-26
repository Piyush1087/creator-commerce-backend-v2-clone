BEGIN;

-- CreateEnum
CREATE TYPE "CanonicalVisualAuthority" AS ENUM ('BRAND_CONFIRMED', 'APPLICATION_CANONICAL');

-- CreateEnum
CREATE TYPE "CanonicalVisualOrigin" AS ENUM ('BRAND_UPLOAD', 'BRAND_SELECTION', 'BRAND_EDIT', 'ONBOARDING_CONFIRMATION', 'APPLICATION_WORKFLOW', 'VERIFIED_MIGRATION');

-- CreateEnum
CREATE TYPE "CanonicalVisualLifecycle" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CanonicalVisualAssetRole" AS ENUM ('LOGO', 'ALTERNATE_MARK', 'REFERENCE_IMAGE');

-- CreateEnum
CREATE TYPE "CanonicalLocationLifecycle" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CanonicalLocationAuthority" AS ENUM ('LEGACY_UNVERIFIED', 'OBSERVED', 'BRAND_CONFIRMED', 'APPLICATION_CANONICAL');

-- CreateEnum
CREATE TYPE "LocationObservationFreshness" AS ENUM ('CURRENT', 'POSSIBLY_STALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "LocationReconciliationState" AS ENUM ('UNVERIFIED', 'MATCHED', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "LocationAliasKind" AS ENUM ('EXTERNAL', 'POSTAL');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "authority" "CanonicalLocationAuthority" NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
ADD COLUMN     "last_observation" JSONB,
ADD COLUMN     "last_observed_at" TIMESTAMP(3),
ADD COLUMN     "lifecycle" "CanonicalLocationLifecycle" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "observation_freshness" "LocationObservationFreshness" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "reconciliation_state" "LocationReconciliationState" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "brand_visual_states" (
    "brand_profile_id" TEXT NOT NULL,
    "primary_logo_asset_id" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_visual_states_pkey" PRIMARY KEY ("brand_profile_id")
);

-- CreateTable
CREATE TABLE "brand_visual_assets" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "role" "CanonicalVisualAssetRole" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "authority" "CanonicalVisualAuthority" NOT NULL,
    "origin" "CanonicalVisualOrigin" NOT NULL,
    "lifecycle" "CanonicalVisualLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "provenance" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_visual_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_visual_colors" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "usage" TEXT,
    "authority" "CanonicalVisualAuthority" NOT NULL,
    "origin" "CanonicalVisualOrigin" NOT NULL,
    "lifecycle" "CanonicalVisualLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "provenance" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_visual_colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_visual_typography" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "label" TEXT,
    "usage" TEXT,
    "authority" "CanonicalVisualAuthority" NOT NULL,
    "origin" "CanonicalVisualOrigin" NOT NULL,
    "lifecycle" "CanonicalVisualLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "provenance" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_visual_typography_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_location_aliases" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "kind" "LocationAliasKind" NOT NULL,
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_location_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_location_observations" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "observed" JSONB NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_location_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_visual_assets_brand_profile_id_lifecycle_role_idx" ON "brand_visual_assets"("brand_profile_id", "lifecycle", "role");

-- CreateIndex
CREATE UNIQUE INDEX "brand_visual_assets_brand_profile_id_id_key" ON "brand_visual_assets"("brand_profile_id", "id");

-- CreateIndex
CREATE INDEX "brand_visual_colors_brand_profile_id_lifecycle_idx" ON "brand_visual_colors"("brand_profile_id", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "brand_visual_colors_brand_profile_id_id_key" ON "brand_visual_colors"("brand_profile_id", "id");

-- CreateIndex
CREATE INDEX "brand_visual_typography_brand_profile_id_lifecycle_idx" ON "brand_visual_typography"("brand_profile_id", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "brand_visual_typography_brand_profile_id_id_key" ON "brand_visual_typography"("brand_profile_id", "id");

-- CreateIndex
CREATE INDEX "brand_location_aliases_brand_profile_id_kind_key_idx" ON "brand_location_aliases"("brand_profile_id", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "brand_location_aliases_brand_profile_id_kind_key_location_i_key" ON "brand_location_aliases"("brand_profile_id", "kind", "key", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "brand_location_observations_brand_profile_id_fingerprint_key" ON "brand_location_observations"("brand_profile_id", "fingerprint");

-- CreateIndex
CREATE INDEX "locations_brand_profile_id_lifecycle_idx" ON "locations"("brand_profile_id", "lifecycle");

-- CreateIndex
CREATE UNIQUE INDEX "locations_brand_profile_id_id_key" ON "locations"("brand_profile_id", "id");

-- AddForeignKey
ALTER TABLE "brand_visual_states" ADD CONSTRAINT "brand_visual_states_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_visual_states" ADD CONSTRAINT "brand_visual_states_brand_profile_id_primary_logo_asset_id_fkey" FOREIGN KEY ("brand_profile_id", "primary_logo_asset_id") REFERENCES "brand_visual_assets"("brand_profile_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "brand_visual_assets" ADD CONSTRAINT "brand_visual_assets_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_visual_states"("brand_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_visual_colors" ADD CONSTRAINT "brand_visual_colors_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_visual_states"("brand_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_visual_typography" ADD CONSTRAINT "brand_visual_typography_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_visual_states"("brand_profile_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_location_aliases" ADD CONSTRAINT "brand_location_aliases_brand_profile_id_location_id_fkey" FOREIGN KEY ("brand_profile_id", "location_id") REFERENCES "locations"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_location_observations" ADD CONSTRAINT "brand_location_observations_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conservative existing-row metadata only: never approval, deduplication, or ID replacement.
UPDATE locations SET last_observed_at = COALESCE(updated_at, created_at),
  provenance = '{"origin":"LEGACY_UNVERIFIED"}'::jsonb;

INSERT INTO brand_location_aliases (id, brand_profile_id, location_id, kind, key)
SELECT 'legacy-postal:' || id, brand_profile_id, id, 'POSTAL',
  'postal-v1:' || encode(sha256(convert_to(
  lower(btrim(regexp_replace(address, '\s+', ' ', 'g'))) || chr(31) ||
  lower(btrim(regexp_replace(city, '\s+', ' ', 'g'))) || chr(31) ||
  lower(btrim(regexp_replace(zip, '\s+', ' ', 'g'))), 'UTF8')), 'hex')
FROM locations WHERE btrim(regexp_replace(address, '\s+', ' ', 'g')) <> ''
 AND btrim(regexp_replace(city, '\s+', ' ', 'g')) <> ''
 AND btrim(regexp_replace(zip, '\s+', ' ', 'g')) <> '';

UPDATE locations SET reconciliation_state = 'AMBIGUOUS'
WHERE id IN (
 SELECT a.location_id FROM brand_location_aliases a JOIN (
  SELECT brand_profile_id, kind, key FROM brand_location_aliases
  GROUP BY brand_profile_id, kind, key HAVING count(*) > 1
 ) duplicates USING (brand_profile_id, kind, key)
);

ALTER TABLE brand_visual_states ADD CONSTRAINT visual_state_revision_positive CHECK (revision > 0);
ALTER TABLE brand_visual_assets ADD CONSTRAINT visual_asset_revision_positive CHECK (revision > 0);
ALTER TABLE brand_visual_colors ADD CONSTRAINT visual_color_valid CHECK (value ~ '^#[0-9A-F]{6}$' AND revision > 0);
ALTER TABLE brand_visual_typography ADD CONSTRAINT visual_typography_valid CHECK (length(btrim(family)) > 0 AND revision > 0);
ALTER TABLE locations ADD CONSTRAINT location_revision_positive CHECK (revision > 0);

CREATE FUNCTION brand_canonical_immutable_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.brand_profile_id IS DISTINCT FROM OLD.brand_profile_id THEN
  RAISE EXCEPTION 'CANONICAL_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER location_immutable_identity BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION brand_canonical_immutable_identity();
CREATE TRIGGER visual_asset_immutable_identity BEFORE UPDATE ON brand_visual_assets FOR EACH ROW EXECUTE FUNCTION brand_canonical_immutable_identity();
CREATE TRIGGER visual_color_immutable_identity BEFORE UPDATE ON brand_visual_colors FOR EACH ROW EXECUTE FUNCTION brand_canonical_immutable_identity();
CREATE TRIGGER visual_typography_immutable_identity BEFORE UPDATE ON brand_visual_typography FOR EACH ROW EXECUTE FUNCTION brand_canonical_immutable_identity();

CREATE FUNCTION brand_canonical_primary_logo_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.brand_profile_id IS DISTINCT FROM OLD.brand_profile_id THEN
  RAISE EXCEPTION 'CANONICAL_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
 END IF;
 IF NEW.primary_logo_asset_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM brand_visual_assets WHERE id = NEW.primary_logo_asset_id
    AND brand_profile_id = NEW.brand_profile_id AND role = 'LOGO' AND lifecycle = 'ACTIVE'
 ) THEN RAISE EXCEPTION 'PRIMARY_LOGO_MUST_BE_ACTIVE_SAME_BRAND_LOGO' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_primary_logo_guard BEFORE INSERT OR UPDATE ON brand_visual_states
 FOR EACH ROW EXECUTE FUNCTION brand_canonical_primary_logo_guard();

CREATE FUNCTION brand_canonical_current_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.role <> 'LOGO' OR NEW.lifecycle <> 'ACTIVE') AND EXISTS (
  SELECT 1 FROM brand_visual_states WHERE brand_profile_id = OLD.brand_profile_id AND primary_logo_asset_id = OLD.id
 ) THEN RAISE EXCEPTION 'DESELECT_PRIMARY_BEFORE_DEACTIVATION' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_current_asset_guard BEFORE UPDATE ON brand_visual_assets
 FOR EACH ROW EXECUTE FUNCTION brand_canonical_current_asset_guard();

-- Compatibility remains one-way. Legacy scan/Preview/Identity writers cannot displace an approved logo.
CREATE FUNCTION brand_canonical_logo_compatibility_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approved_url text;
BEGIN
 SELECT a.url INTO approved_url FROM brand_visual_states s JOIN brand_visual_assets a
 ON a.brand_profile_id = s.brand_profile_id AND a.id = s.primary_logo_asset_id
 WHERE s.brand_profile_id = NEW.id AND a.lifecycle = 'ACTIVE';
 IF FOUND THEN NEW.logo_url := approved_url; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_logo_compatibility_guard BEFORE UPDATE OF logo_url ON brand_profiles
 FOR EACH ROW EXECUTE FUNCTION brand_canonical_logo_compatibility_guard();

CREATE FUNCTION brand_canonical_asset_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE brand_profiles SET logo_url = NEW.url
 WHERE id = NEW.brand_profile_id AND EXISTS (
  SELECT 1 FROM brand_visual_states WHERE brand_profile_id = NEW.brand_profile_id AND primary_logo_asset_id = NEW.id
 );
 RETURN NEW;
END $$;
CREATE TRIGGER canonical_asset_mirror AFTER UPDATE OF url ON brand_visual_assets
 FOR EACH ROW EXECUTE FUNCTION brand_canonical_asset_mirror();

COMMIT;
