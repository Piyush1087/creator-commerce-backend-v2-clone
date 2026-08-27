-- Product Intelligence V1 P1B-1: additive canonical Offering application state.
BEGIN;

CREATE TYPE "OfferingKind" AS ENUM ('PRODUCT', 'SERVICE', 'EXPERIENCE', 'BUNDLE');
CREATE TYPE "OfferingLifecycle" AS ENUM ('DRAFT_INCOMPLETE', 'ACTIVE', 'PAUSED_INACTIVE');
CREATE TYPE "CanonicalOfferingAuthority" AS ENUM ('LEGACY_UNVERIFIED', 'OBSERVED', 'BRAND_CONFIRMED', 'APPLICATION_CANONICAL');
CREATE TYPE "CanonicalOfferingOrigin" AS ENUM ('LEGACY_MIGRATION', 'SURFACE_SCAN', 'DEEP_SCAN', 'BRAND_EDIT', 'BRAND_UPLOAD', 'APPLICATION_WORKFLOW', 'CONTROLLED_PRICE_REFRESH');
CREATE TYPE "CanonicalOfferingProtectionState" AS ENUM ('UNPROTECTED', 'BRAND_CONFIRMED', 'APPLICATION_CONTROLLED');
CREATE TYPE "CanonicalOfferingItemLifecycle" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "OfferingGuidanceKind" AS ENUM ('SELLING_POINT', 'DO_NOT_SAY');
CREATE TYPE "OfferingPriceMode" AS ENUM ('EXACT', 'STARTING_AT', 'RANGE', 'NOT_PUBLICLY_LISTED');
CREATE TYPE "OfferingPriceFreshness" AS ENUM ('CURRENT', 'STALE', 'UNKNOWN');

ALTER TABLE "offerings"
  ADD COLUMN "canonical_kind" "OfferingKind",
  ADD COLUMN "canonical_lifecycle" "OfferingLifecycle",
  ADD COLUMN "canonical_subtype" VARCHAR(100);

CREATE UNIQUE INDEX "offerings_brand_profile_id_id_key" ON "offerings"("brand_profile_id", "id");
CREATE UNIQUE INDEX "brand_offers_brand_profile_id_id_key" ON "brand_offers"("brand_profile_id", "id");

CREATE TABLE "offering_field_states" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "offering_id" TEXT NOT NULL,
  "semantic_field_path" VARCHAR(160) NOT NULL,
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "provenance" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "protection_state" "CanonicalOfferingProtectionState" NOT NULL DEFAULT 'UNPROTECTED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_field_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offering_guidance_items" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "offering_id" TEXT NOT NULL,
  "kind" "OfferingGuidanceKind" NOT NULL,
  "text" TEXT NOT NULL,
  "presentation_order" INTEGER NOT NULL DEFAULT 0,
  "lifecycle" "CanonicalOfferingItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "provenance" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "protection_state" "CanonicalOfferingProtectionState" NOT NULL DEFAULT 'UNPROTECTED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_guidance_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offering_price_states" (
  "offering_id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "current_revision_id" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_price_states_pkey" PRIMARY KEY ("offering_id")
);

CREATE TABLE "offering_price_revisions" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "offering_id" TEXT NOT NULL,
  "mode" "OfferingPriceMode" NOT NULL,
  "current_min_amount" DECIMAL(18,2),
  "current_max_amount" DECIMAL(18,2),
  "regular_min_amount" DECIMAL(18,2),
  "regular_max_amount" DECIMAL(18,2),
  "currency" CHAR(3) NOT NULL,
  "freshness" "OfferingPriceFreshness" NOT NULL,
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "source_class" VARCHAR(100) NOT NULL,
  "source_ref" VARCHAR(255),
  "observed_at" TIMESTAMP(3),
  "freshness_evaluated_at" TIMESTAMP(3) NOT NULL,
  "provenance" JSONB,
  "predecessor_revision_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offering_price_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offering_media_states" (
  "offering_id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "primary_media_asset_id" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_media_states_pkey" PRIMARY KEY ("offering_id")
);

CREATE TABLE "offering_media_assets" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "offering_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  "alt_text" TEXT,
  "presentation_order" INTEGER NOT NULL DEFAULT 0,
  "lifecycle" "CanonicalOfferingItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "provenance" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offering_bundle_members" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "bundle_offering_id" TEXT NOT NULL,
  "product_offering_id" TEXT NOT NULL,
  "presentation_order" INTEGER NOT NULL DEFAULT 0,
  "lifecycle" "CanonicalOfferingItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "provenance" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_bundle_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offering_location_availability" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "offering_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "lifecycle" "CanonicalOfferingItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "provenance" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offering_location_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brand_offer_offerings" (
  "id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "brand_offer_id" TEXT NOT NULL,
  "offering_id" TEXT NOT NULL,
  "lifecycle" "CanonicalOfferingItemLifecycle" NOT NULL DEFAULT 'ACTIVE',
  "authority" "CanonicalOfferingAuthority" NOT NULL,
  "origin" "CanonicalOfferingOrigin" NOT NULL,
  "provenance" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_offer_offerings_pkey" PRIMARY KEY ("id")
);

-- Conservative deterministic Offering reconciliation only.
UPDATE "offerings" SET "canonical_kind" = CASE "type"
  WHEN 'PRODUCT' THEN 'PRODUCT'::"OfferingKind"
  WHEN 'SERVICE' THEN 'SERVICE'::"OfferingKind"
  WHEN 'EXPERIENCE' THEN 'EXPERIENCE'::"OfferingKind"
  WHEN 'COLLECTION' THEN 'BUNDLE'::"OfferingKind"
  WHEN 'TREATMENT' THEN 'SERVICE'::"OfferingKind"
  ELSE NULL
END;
UPDATE "offerings" SET "canonical_subtype" = 'TREATMENT' WHERE "type" = 'TREATMENT';
UPDATE "offerings" SET "canonical_lifecycle" = 'ACTIVE' WHERE "is_active" = true;

INSERT INTO "offering_field_states" (
  "id", "brand_profile_id", "offering_id", "semantic_field_path", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-field-' || md5("id" || ':' || path), "brand_profile_id", "id", path,
  'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION', '{"migration":"P1B-1"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings"
CROSS JOIN LATERAL unnest(ARRAY['name','url']) AS path;

INSERT INTO "offering_field_states" (
  "id", "brand_profile_id", "offering_id", "semantic_field_path", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-field-' || md5("id" || ':description'), "brand_profile_id", "id", 'description',
  'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION', '{"migration":"P1B-1"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings" WHERE "description" IS NOT NULL;

INSERT INTO "offering_field_states" (
  "id", "brand_profile_id", "offering_id", "semantic_field_path", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-field-' || md5("id" || ':canonicalKind'), "brand_profile_id", "id", 'canonicalKind',
  'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION', '{"migration":"P1B-1"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings" WHERE "canonical_kind" IS NOT NULL;

INSERT INTO "offering_field_states" (
  "id", "brand_profile_id", "offering_id", "semantic_field_path", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-field-' || md5("id" || ':canonicalSubtype'), "brand_profile_id", "id", 'canonicalSubtype',
  'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION', '{"migration":"P1B-1"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings" WHERE "canonical_subtype" IS NOT NULL;

INSERT INTO "offering_guidance_items" (
  "id", "brand_profile_id", "offering_id", "kind", "text", "presentation_order", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-guidance-' || md5(o."id" || ':selling:' || x.ordinality::text), o."brand_profile_id", o."id",
  'SELLING_POINT', x.item, (x.ordinality - 1)::integer, 'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION',
  '{"migration":"P1B-1"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings" o CROSS JOIN LATERAL unnest(o."selling_points") WITH ORDINALITY AS x(item, ordinality)
WHERE btrim(x.item) <> '';

INSERT INTO "offering_guidance_items" (
  "id", "brand_profile_id", "offering_id", "kind", "text", "presentation_order", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-guidance-' || md5(o."id" || ':dns:' || x.ordinality::text), o."brand_profile_id", o."id",
  'DO_NOT_SAY', x.item, (x.ordinality - 1)::integer, 'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION',
  '{"migration":"P1B-1"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings" o CROSS JOIN LATERAL unnest(o."do_not_say") WITH ORDINALITY AS x(item, ordinality)
WHERE btrim(x.item) <> '';

INSERT INTO "offering_media_states" ("offering_id", "brand_profile_id", "updated_at")
SELECT "id", "brand_profile_id", CURRENT_TIMESTAMP FROM "offerings" WHERE "image_url" IS NOT NULL;

INSERT INTO "offering_media_assets" (
  "id", "brand_profile_id", "offering_id", "url", "authority", "origin", "provenance", "updated_at"
)
SELECT 'p1b1-media-' || md5("id" || ':primary'), "brand_profile_id", "id", "image_url",
  'LEGACY_UNVERIFIED', 'LEGACY_MIGRATION', '{"migration":"P1B-1","legacyField":"imageUrl"}'::jsonb, CURRENT_TIMESTAMP
FROM "offerings" WHERE "image_url" IS NOT NULL;

UPDATE "offering_media_states" s SET "primary_media_asset_id" = 'p1b1-media-' || md5(s."offering_id" || ':primary');

-- Fail the migration rather than accept a partial or over-eager reconciliation.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "offerings"
    WHERE ("type" = 'PRODUCT' AND "canonical_kind" IS DISTINCT FROM 'PRODUCT')
       OR ("type" = 'SERVICE' AND "canonical_kind" IS DISTINCT FROM 'SERVICE')
       OR ("type" = 'EXPERIENCE' AND "canonical_kind" IS DISTINCT FROM 'EXPERIENCE')
       OR ("type" = 'COLLECTION' AND "canonical_kind" IS DISTINCT FROM 'BUNDLE')
       OR ("type" = 'TREATMENT' AND ("canonical_kind" IS DISTINCT FROM 'SERVICE' OR "canonical_subtype" IS DISTINCT FROM 'TREATMENT'))
       OR ("type" = 'MODULE' AND ("canonical_kind" IS NOT NULL OR "canonical_subtype" IS NOT NULL))
       OR ("is_active" = true AND "canonical_lifecycle" IS DISTINCT FROM 'ACTIVE')
       OR ("is_active" = false AND "canonical_lifecycle" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'CANONICAL_OFFERING_BACKFILL_VALIDATION_FAILED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "offering_field_states" WHERE "authority" <> 'LEGACY_UNVERIFIED'
  ) OR EXISTS (
    SELECT 1 FROM "offering_guidance_items" WHERE "authority" <> 'LEGACY_UNVERIFIED'
  ) OR EXISTS (
    SELECT 1 FROM "offering_media_assets" WHERE "authority" <> 'LEGACY_UNVERIFIED'
  ) THEN
    RAISE EXCEPTION 'CANONICAL_OFFERING_LEGACY_AUTHORITY_VALIDATION_FAILED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "offering_media_states" s
    LEFT JOIN "offering_media_assets" a
      ON a."brand_profile_id" = s."brand_profile_id"
     AND a."offering_id" = s."offering_id"
     AND a."id" = s."primary_media_asset_id"
    WHERE s."primary_media_asset_id" IS NULL OR a."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'CANONICAL_OFFERING_MEDIA_BACKFILL_VALIDATION_FAILED';
  END IF;
  IF EXISTS (SELECT 1 FROM "offering_price_states")
     OR EXISTS (SELECT 1 FROM "offering_price_revisions")
     OR EXISTS (SELECT 1 FROM "offering_location_availability")
     OR EXISTS (SELECT 1 FROM "brand_offer_offerings") THEN
    RAISE EXCEPTION 'AMBIGUOUS_CANONICAL_OFFERING_STATE_WAS_BACKFILLED';
  END IF;
END $$;

CREATE INDEX "offering_field_states_brand_profile_id_offering_id_authorit_idx" ON "offering_field_states"("brand_profile_id", "offering_id", "authority");
CREATE UNIQUE INDEX "offering_field_states_brand_profile_id_offering_id_semantic_key" ON "offering_field_states"("brand_profile_id", "offering_id", "semantic_field_path");
CREATE INDEX "offering_guidance_items_brand_profile_id_offering_id_kind_l_idx" ON "offering_guidance_items"("brand_profile_id", "offering_id", "kind", "lifecycle", "presentation_order");
CREATE UNIQUE INDEX "offering_guidance_items_brand_profile_id_offering_id_id_key" ON "offering_guidance_items"("brand_profile_id", "offering_id", "id");
CREATE UNIQUE INDEX "offering_price_states_brand_profile_id_offering_id_key" ON "offering_price_states"("brand_profile_id", "offering_id");
CREATE INDEX "offering_price_revisions_brand_profile_id_offering_id_creat_idx" ON "offering_price_revisions"("brand_profile_id", "offering_id", "created_at");
CREATE UNIQUE INDEX "offering_price_revisions_brand_profile_id_offering_id_id_key" ON "offering_price_revisions"("brand_profile_id", "offering_id", "id");
CREATE UNIQUE INDEX "offering_media_states_brand_profile_id_offering_id_key" ON "offering_media_states"("brand_profile_id", "offering_id");
CREATE INDEX "offering_media_assets_brand_profile_id_offering_id_lifecycl_idx" ON "offering_media_assets"("brand_profile_id", "offering_id", "lifecycle", "presentation_order");
CREATE UNIQUE INDEX "offering_media_assets_brand_profile_id_offering_id_id_key" ON "offering_media_assets"("brand_profile_id", "offering_id", "id");
CREATE INDEX "offering_bundle_members_brand_profile_id_product_offering_i_idx" ON "offering_bundle_members"("brand_profile_id", "product_offering_id", "lifecycle");
CREATE UNIQUE INDEX "offering_bundle_members_brand_profile_id_bundle_offering_id_key" ON "offering_bundle_members"("brand_profile_id", "bundle_offering_id", "product_offering_id");
CREATE INDEX "offering_location_availability_brand_profile_id_location_id_idx" ON "offering_location_availability"("brand_profile_id", "location_id", "lifecycle");
CREATE UNIQUE INDEX "offering_location_availability_brand_profile_id_offering_id_key" ON "offering_location_availability"("brand_profile_id", "offering_id", "location_id");
CREATE INDEX "brand_offer_offerings_brand_profile_id_offering_id_lifecycl_idx" ON "brand_offer_offerings"("brand_profile_id", "offering_id", "lifecycle");
CREATE UNIQUE INDEX "brand_offer_offerings_brand_profile_id_brand_offer_id_offer_key" ON "brand_offer_offerings"("brand_profile_id", "brand_offer_id", "offering_id");

ALTER TABLE "offering_field_states" ADD CONSTRAINT "offering_field_states_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_guidance_items" ADD CONSTRAINT "offering_guidance_items_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_price_states" ADD CONSTRAINT "offering_price_states_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_price_states" ADD CONSTRAINT "offering_price_states_brand_profile_id_offering_id_current_fkey" FOREIGN KEY ("brand_profile_id", "offering_id", "current_revision_id") REFERENCES "offering_price_revisions"("brand_profile_id", "offering_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "offering_price_revisions" ADD CONSTRAINT "offering_price_revisions_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offering_price_states"("brand_profile_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_price_revisions" ADD CONSTRAINT "offering_price_revisions_brand_profile_id_offering_id_pred_fkey" FOREIGN KEY ("brand_profile_id", "offering_id", "predecessor_revision_id") REFERENCES "offering_price_revisions"("brand_profile_id", "offering_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_media_states" ADD CONSTRAINT "offering_media_states_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_media_states" ADD CONSTRAINT "offering_media_states_brand_profile_id_offering_id_primary_fkey" FOREIGN KEY ("brand_profile_id", "offering_id", "primary_media_asset_id") REFERENCES "offering_media_assets"("brand_profile_id", "offering_id", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "offering_media_assets" ADD CONSTRAINT "offering_media_assets_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offering_media_states"("brand_profile_id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_bundle_members" ADD CONSTRAINT "offering_bundle_members_brand_profile_id_bundle_offering_i_fkey" FOREIGN KEY ("brand_profile_id", "bundle_offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_bundle_members" ADD CONSTRAINT "offering_bundle_members_brand_profile_id_product_offering__fkey" FOREIGN KEY ("brand_profile_id", "product_offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_location_availability" ADD CONSTRAINT "offering_location_availability_brand_profile_id_offering_i_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offering_location_availability" ADD CONSTRAINT "offering_location_availability_brand_profile_id_location_i_fkey" FOREIGN KEY ("brand_profile_id", "location_id") REFERENCES "locations"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brand_offer_offerings" ADD CONSTRAINT "brand_offer_offerings_brand_profile_id_brand_offer_id_fkey" FOREIGN KEY ("brand_profile_id", "brand_offer_id") REFERENCES "brand_offers"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "brand_offer_offerings" ADD CONSTRAINT "brand_offer_offerings_brand_profile_id_offering_id_fkey" FOREIGN KEY ("brand_profile_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "offering_field_states" ADD CONSTRAINT "offering_field_state_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "offering_guidance_items" ADD CONSTRAINT "offering_guidance_valid" CHECK ("revision" > 0 AND "presentation_order" >= 0 AND length(btrim("text")) > 0);
ALTER TABLE "offering_price_states" ADD CONSTRAINT "offering_price_state_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "offering_price_revisions" ADD CONSTRAINT "offering_price_revision_shape" CHECK (
  "currency" ~ '^[A-Z]{3}$' AND
  (("mode" = 'EXACT' AND "current_min_amount" IS NOT NULL AND ("current_max_amount" IS NULL OR "current_max_amount" = "current_min_amount")) OR
   ("mode" = 'STARTING_AT' AND "current_min_amount" IS NOT NULL AND "current_max_amount" IS NULL) OR
   ("mode" = 'RANGE' AND "current_min_amount" IS NOT NULL AND "current_max_amount" IS NOT NULL AND "current_min_amount" <= "current_max_amount") OR
   ("mode" = 'NOT_PUBLICLY_LISTED' AND "current_min_amount" IS NULL AND "current_max_amount" IS NULL)) AND
  (("regular_min_amount" IS NULL AND "regular_max_amount" IS NULL) OR
   ("regular_min_amount" IS NOT NULL AND ("regular_max_amount" IS NULL OR "regular_min_amount" <= "regular_max_amount")))
);
ALTER TABLE "offering_media_states" ADD CONSTRAINT "offering_media_state_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "offering_media_assets" ADD CONSTRAINT "offering_media_asset_valid" CHECK ("revision" > 0 AND "presentation_order" >= 0 AND length(btrim("url")) > 0);
ALTER TABLE "offering_bundle_members" ADD CONSTRAINT "offering_bundle_member_valid" CHECK ("revision" > 0 AND "presentation_order" >= 0 AND "bundle_offering_id" <> "product_offering_id");
ALTER TABLE "offering_location_availability" ADD CONSTRAINT "offering_location_availability_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "brand_offer_offerings" ADD CONSTRAINT "brand_offer_offering_revision_positive" CHECK ("revision" > 0);

CREATE FUNCTION canonical_offering_lifecycle_compatibility() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."canonical_lifecycle" IS NOT NULL THEN
    NEW."is_active" := NEW."canonical_lifecycle" = 'ACTIVE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER canonical_offering_lifecycle_compatibility
  BEFORE INSERT OR UPDATE OF "canonical_lifecycle" ON "offerings"
  FOR EACH ROW EXECUTE FUNCTION canonical_offering_lifecycle_compatibility();

CREATE FUNCTION canonical_offering_protection_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."protection_state" = 'BRAND_CONFIRMED' AND
     (NEW."authority" <> 'BRAND_CONFIRMED' OR NEW."protection_state" <> 'BRAND_CONFIRMED') THEN
    RAISE EXCEPTION 'BRAND_CONFIRMED_OFFERING_STATE_CANNOT_BE_DOWNGRADED' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'offering_guidance_items' AND OLD."protection_state" = 'BRAND_CONFIRMED' AND
     (NEW."text" IS DISTINCT FROM OLD."text" OR NEW."lifecycle" IS DISTINCT FROM OLD."lifecycle") AND
     NEW."origin" <> 'BRAND_EDIT' THEN
    RAISE EXCEPTION 'BRAND_CONFIRMED_GUIDANCE_REQUIRES_BRAND_EDIT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offering_field_protection_guard BEFORE UPDATE ON "offering_field_states" FOR EACH ROW EXECUTE FUNCTION canonical_offering_protection_guard();
CREATE TRIGGER offering_guidance_protection_guard BEFORE UPDATE ON "offering_guidance_items" FOR EACH ROW EXECUTE FUNCTION canonical_offering_protection_guard();

CREATE FUNCTION offering_price_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'OFFERING_PRICE_REVISION_IMMUTABLE' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER offering_price_revision_immutable BEFORE UPDATE OR DELETE ON "offering_price_revisions" FOR EACH ROW EXECUTE FUNCTION offering_price_revision_immutable();

CREATE FUNCTION offering_media_cap_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active_count integer;
BEGIN
  IF NEW."lifecycle" = 'ACTIVE' THEN
    SELECT count(*) INTO active_count FROM "offering_media_assets"
      WHERE "brand_profile_id" = NEW."brand_profile_id" AND "offering_id" = NEW."offering_id"
        AND "lifecycle" = 'ACTIVE' AND "id" <> NEW."id";
    IF active_count >= 7 THEN
      RAISE EXCEPTION 'OFFERING_MEDIA_ACTIVE_CAP_EXCEEDED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offering_media_cap_guard BEFORE INSERT OR UPDATE OF "brand_profile_id", "offering_id", "lifecycle" ON "offering_media_assets" FOR EACH ROW EXECUTE FUNCTION offering_media_cap_guard();

CREATE FUNCTION offering_primary_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."primary_media_asset_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "offering_media_assets" a WHERE a."id" = NEW."primary_media_asset_id"
      AND a."brand_profile_id" = NEW."brand_profile_id" AND a."offering_id" = NEW."offering_id" AND a."lifecycle" = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'PRIMARY_MEDIA_MUST_BE_ACTIVE_SAME_BRAND_OFFERING' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offering_primary_media_guard BEFORE INSERT OR UPDATE ON "offering_media_states" FOR EACH ROW EXECUTE FUNCTION offering_primary_media_guard();

CREATE FUNCTION offering_primary_media_deactivation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."lifecycle" <> 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "offering_media_states" s WHERE s."brand_profile_id" = OLD."brand_profile_id"
      AND s."offering_id" = OLD."offering_id" AND s."primary_media_asset_id" = OLD."id"
  ) THEN RAISE EXCEPTION 'DESELECT_PRIMARY_MEDIA_BEFORE_DEACTIVATION' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offering_primary_media_deactivation_guard BEFORE UPDATE OF "lifecycle" ON "offering_media_assets" FOR EACH ROW EXECUTE FUNCTION offering_primary_media_deactivation_guard();

CREATE FUNCTION offering_primary_media_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE primary_url text;
BEGIN
  IF NEW."primary_media_asset_id" IS NULL THEN
    UPDATE "offerings" SET "image_url" = NULL WHERE "id" = NEW."offering_id" AND "brand_profile_id" = NEW."brand_profile_id";
  ELSE
    SELECT "url" INTO primary_url FROM "offering_media_assets" WHERE "id" = NEW."primary_media_asset_id";
    UPDATE "offerings" SET "image_url" = primary_url WHERE "id" = NEW."offering_id" AND "brand_profile_id" = NEW."brand_profile_id";
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offering_primary_media_mirror AFTER INSERT OR UPDATE OF "primary_media_asset_id" ON "offering_media_states" FOR EACH ROW EXECUTE FUNCTION offering_primary_media_mirror();

CREATE FUNCTION offering_primary_media_url_mirror() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "offerings" SET "image_url" = NEW."url"
  WHERE "id" = NEW."offering_id" AND "brand_profile_id" = NEW."brand_profile_id" AND EXISTS (
    SELECT 1 FROM "offering_media_states" s WHERE s."offering_id" = NEW."offering_id"
      AND s."brand_profile_id" = NEW."brand_profile_id" AND s."primary_media_asset_id" = NEW."id"
  );
  RETURN NEW;
END $$;
CREATE TRIGGER offering_primary_media_url_mirror AFTER UPDATE OF "url" ON "offering_media_assets" FOR EACH ROW EXECUTE FUNCTION offering_primary_media_url_mirror();

CREATE FUNCTION offering_bundle_kind_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "offerings" WHERE "brand_profile_id" = NEW."brand_profile_id" AND "id" = NEW."bundle_offering_id" AND "canonical_kind" = 'BUNDLE') THEN
    RAISE EXCEPTION 'BUNDLE_MEMBERSHIP_PARENT_MUST_BE_BUNDLE' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "offerings" WHERE "brand_profile_id" = NEW."brand_profile_id" AND "id" = NEW."product_offering_id" AND "canonical_kind" = 'PRODUCT') THEN
    RAISE EXCEPTION 'BUNDLE_MEMBERSHIP_CHILD_MUST_BE_PRODUCT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER offering_bundle_kind_guard BEFORE INSERT OR UPDATE ON "offering_bundle_members" FOR EACH ROW EXECUTE FUNCTION offering_bundle_kind_guard();

COMMIT;
