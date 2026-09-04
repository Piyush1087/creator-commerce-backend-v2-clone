-- C-03 P1.1A: canonical Campaign / Asset / Brief persistence convergence.
-- Existing compatibility rows are preserved. No Application state is changed here.

BEGIN;

CREATE TYPE "UceBriefStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');
CREATE TYPE "UceBriefCreationSource" AS ENUM ('MANUAL', 'AI_RECOMMENDED');
CREATE TYPE "UceBriefType" AS ENUM ('CREATOR_LED', 'BRAND_LED');
CREATE TYPE "UceDeliverableFormat" AS ENUM ('REEL_VIDEO', 'STORY', 'PHOTOSHOOT', 'BANNER_CAROUSEL');
CREATE TYPE "UceBrandSupportType" AS ENUM ('PRODUCT', 'SERVICE', 'EXPERIENCE', 'ACCESS_SUBSCRIPTION', 'OTHER');

ALTER TABLE "uce_campaigns"
  ADD COLUMN "live_at" TIMESTAMP(3),
  ADD COLUMN "application_deadline" TIMESTAMP(3);

ALTER TABLE "uce_campaign_strategy"
  ADD COLUMN "platforms" "UceMediaPlatform"[] NOT NULL DEFAULT ARRAY[]::"UceMediaPlatform"[];

ALTER TABLE "uce_campaign_targeting"
  ADD COLUMN "visibility_scope" "UceVisibilityScope",
  ADD COLUMN "targeting_version" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "uce_campaign_targeting_version_check" CHECK ("targeting_version" >= 1);

ALTER TABLE "uce_campaign_commercials"
  ADD COLUMN "canonical_version" INTEGER,
  ADD COLUMN "commercial_offer" DECIMAL(12,2),
  ADD COLUMN "currency" CHAR(3),
  ADD COLUMN "receives_brand_support" BOOLEAN,
  ADD COLUMN "brand_support_type" "UceBrandSupportType",
  ADD COLUMN "brand_support_estimated_value" DECIMAL(12,2);

-- Exact, provenance-safe projections from an accepted v1.2 definition.
UPDATE "uce_campaign_strategy" AS strategy
SET "platforms" = ARRAY['INSTAGRAM']::"UceMediaPlatform"[]
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = strategy."campaign_id"
  AND campaign."canonical_definition" ->> 'version' = '1.2'
  AND campaign."canonical_definition" #> '{strategy,platforms}' = '["INSTAGRAM"]'::jsonb;

UPDATE "uce_campaign_targeting" AS targeting
SET "visibility_scope" = CASE campaign."canonical_definition" #>> '{strategy,campaign_visibility}'
  WHEN 'PUBLIC' THEN 'EVERYONE'::"UceVisibilityScope"
  WHEN 'ELIGIBLE_CREATORS_ONLY' THEN 'ELIGIBLE_ONLY'::"UceVisibilityScope"
  WHEN 'INVITE_ONLY' THEN 'INVITED_ONLY'::"UceVisibilityScope"
END
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = targeting."campaign_id"
  AND campaign."canonical_definition" ->> 'version' = '1.2'
  AND campaign."canonical_definition" #>> '{strategy,campaign_visibility}'
      IN ('PUBLIC', 'ELIGIBLE_CREATORS_ONLY', 'INVITE_ONLY');

-- A single existing value is unambiguous even without canonical-definition provenance.
UPDATE "uce_campaign_targeting"
SET "visibility_scope" = "visibility_scopes"[1]
WHERE "visibility_scope" IS NULL
  AND cardinality("visibility_scopes") = 1;

UPDATE "uce_campaign_commercials" AS commercials
SET "canonical_version" = 1,
    "commercial_offer" = (campaign."canonical_definition" #>> '{commercials,commercial_offer}')::DECIMAL(12,2),
    "currency" = campaign."canonical_definition" #>> '{derived,currency}',
    "receives_brand_support" = (campaign."canonical_definition" #>> '{commercials,receives_brand_support}')::BOOLEAN,
    "brand_support_type" = CASE
      WHEN campaign."canonical_definition" #>> '{commercials,brand_support_type}' IS NULL THEN NULL
      ELSE (campaign."canonical_definition" #>> '{commercials,brand_support_type}')::"UceBrandSupportType"
    END,
    "brand_support_estimated_value" = CASE
      WHEN campaign."canonical_definition" #>> '{commercials,brand_support_estimated_value}' IS NULL THEN NULL
      ELSE (campaign."canonical_definition" #>> '{commercials,brand_support_estimated_value}')::DECIMAL(12,2)
    END
FROM "uce_campaigns" AS campaign
WHERE campaign."id" = commercials."campaign_id"
  AND campaign."canonical_definition" ->> 'version' = '1.2'
  AND CASE
    WHEN jsonb_typeof(campaign."canonical_definition" #> '{commercials,commercial_offer}') = 'number'
    THEN (campaign."canonical_definition" #>> '{commercials,commercial_offer}')::NUMERIC
      BETWEEN 0 AND 9999999999.99
    ELSE FALSE
  END
  AND campaign."canonical_definition" #>> '{derived,currency}' IN ('INR', 'USD')
  AND CASE
    WHEN jsonb_typeof(campaign."canonical_definition" #> '{commercials,receives_brand_support}') = 'boolean'
    THEN CASE
      WHEN (campaign."canonical_definition" #>> '{commercials,receives_brand_support}')::BOOLEAN = FALSE
      THEN (
        campaign."canonical_definition" #>> '{commercials,brand_support_type}' IS NULL
        AND campaign."canonical_definition" #>> '{commercials,brand_support_estimated_value}' IS NULL
      )
      ELSE (
        campaign."canonical_definition" #>> '{commercials,brand_support_type}'
          IN ('PRODUCT', 'SERVICE', 'EXPERIENCE', 'ACCESS_SUBSCRIPTION', 'OTHER')
        AND (
          campaign."canonical_definition" #>> '{commercials,brand_support_estimated_value}' IS NULL
          OR CASE
            WHEN jsonb_typeof(campaign."canonical_definition" #> '{commercials,brand_support_estimated_value}') = 'number'
            THEN (campaign."canonical_definition" #>> '{commercials,brand_support_estimated_value}')::NUMERIC
              BETWEEN 0 AND 9999999999.99
            ELSE FALSE
          END
        )
      )
    END
    ELSE FALSE
  END;

ALTER TABLE "uce_campaign_commercials"
  ADD CONSTRAINT "uce_campaign_commercials_canonical_shape_check" CHECK (
    (
      "canonical_version" IS NULL
      AND "commercial_offer" IS NULL
      AND "currency" IS NULL
      AND "receives_brand_support" IS NULL
      AND "brand_support_type" IS NULL
      AND "brand_support_estimated_value" IS NULL
    ) OR (
      "canonical_version" = 1
      AND "commercial_offer" IS NOT NULL
      AND "commercial_offer" >= 0
      AND "currency" IN ('INR', 'USD')
      AND "receives_brand_support" IS NOT NULL
      AND (
        (
          "receives_brand_support" = FALSE
          AND "brand_support_type" IS NULL
          AND "brand_support_estimated_value" IS NULL
        ) OR (
          "receives_brand_support" = TRUE
          AND "brand_support_type" IS NOT NULL
          AND ("brand_support_estimated_value" IS NULL OR "brand_support_estimated_value" >= 0)
        )
      )
    )
  );

ALTER TABLE "campaign_briefs"
  ADD COLUMN "status" "UceBriefStatus",
  ADD COLUMN "creation_source" "UceBriefCreationSource",
  ADD COLUMN "creative_intent" TEXT,
  ADD COLUMN "creator_brief" TEXT,
  ADD COLUMN "brief_type" "UceBriefType",
  ADD COLUMN "platform" "UceMediaPlatform",
  ADD COLUMN "brief_level_guidance" JSONB,
  ADD COLUMN "reference_content" JSONB,
  ADD COLUMN "usage_rights" JSONB,
  ADD COLUMN "creator_requirements" TEXT,
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "paused_at" TIMESTAMP(3),
  ALTER COLUMN "title" DROP NOT NULL,
  ALTER COLUMN "creative_requirements" DROP NOT NULL,
  ALTER COLUMN "is_active" SET DEFAULT FALSE;

UPDATE "campaign_briefs"
SET "status" = CASE
      WHEN "is_active" THEN 'PUBLISHED'::"UceBriefStatus"
      ELSE 'PAUSED'::"UceBriefStatus"
    END,
    "creation_source" = 'MANUAL'::"UceBriefCreationSource";

ALTER TABLE "campaign_briefs"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "creation_source" SET DEFAULT 'MANUAL',
  ALTER COLUMN "creation_source" SET NOT NULL;

ALTER TABLE "campaign_brief_deliverables"
  ADD COLUMN "canonical_format" "UceDeliverableFormat",
  ADD COLUMN "display_order" INTEGER,
  ADD COLUMN "configuration" JSONB,
  ADD COLUMN "creative_guidance" JSONB,
  ADD COLUMN "amplify_target_deliverable_id" TEXT,
  ALTER COLUMN "format" DROP NOT NULL,
  ALTER COLUMN "quantity" DROP NOT NULL,
  ALTER COLUMN "creative_requirements" DROP NOT NULL,
  ALTER COLUMN "publishing_required" DROP NOT NULL;

ALTER TABLE "campaign_brief_deliverables"
  ADD CONSTRAINT "campaign_brief_deliverables_canonical_shape_check" CHECK (
    ("canonical_format" IS NULL AND "display_order" IS NULL)
    OR ("canonical_format" IS NOT NULL AND "display_order" IS NOT NULL AND "display_order" >= 0)
  ),
  ADD CONSTRAINT "campaign_brief_deliverables_non_self_amplify_check" CHECK (
    "amplify_target_deliverable_id" IS NULL
    OR "amplify_target_deliverable_id" <> "deliverable_id"
  );

CREATE UNIQUE INDEX "uce_campaigns_id_brand_profile_id_key"
  ON "uce_campaigns"("id", "brand_profile_id");
CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_campaign_asset_id_key"
  ON "uce_campaign_assets"("campaign_id", "campaign_asset_id");
CREATE UNIQUE INDEX "campaign_briefs_campaign_asset_id_brief_id_key"
  ON "campaign_briefs"("campaign_asset_id", "brief_id");
CREATE INDEX "campaign_briefs_campaign_asset_id_status_idx"
  ON "campaign_briefs"("campaign_asset_id", "status");
CREATE UNIQUE INDEX "campaign_brief_deliverables_brief_id_deliverable_id_key"
  ON "campaign_brief_deliverables"("brief_id", "deliverable_id");
CREATE INDEX "campaign_brief_deliverables_amplify_target_deliverable_id_idx"
  ON "campaign_brief_deliverables"("amplify_target_deliverable_id");

ALTER TABLE "campaign_brief_deliverables"
  ADD CONSTRAINT "campaign_brief_deliverables_amplify_target_fkey"
  FOREIGN KEY ("brief_id", "amplify_target_deliverable_id")
  REFERENCES "campaign_brief_deliverables"("brief_id", "deliverable_id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION "c03_guard_campaign_brief_identity_and_projection"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."brief_id" IS DISTINCT FROM OLD."brief_id" THEN
      RAISE EXCEPTION 'C03_CAMPAIGN_BRIEF_ID_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
    IF NEW."campaign_asset_id" IS DISTINCT FROM OLD."campaign_asset_id" THEN
      RAISE EXCEPTION 'C03_CAMPAIGN_BRIEF_PARENT_IMMUTABLE' USING ERRCODE = '23514';
    END IF;
  END IF;

  expected_active := NEW."status" = 'PUBLISHED'::"UceBriefStatus";
  IF TG_OP = 'UPDATE'
     AND NEW."status" IS NOT DISTINCT FROM OLD."status"
     AND NEW."is_active" IS DISTINCT FROM OLD."is_active" THEN
    RAISE EXCEPTION 'C03_CAMPAIGN_BRIEF_LEGACY_ACTIVE_IS_PROJECTION' USING ERRCODE = '23514';
  END IF;

  NEW."is_active" := expected_active;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_campaign_brief_identity_and_projection_guard"
BEFORE INSERT OR UPDATE ON "campaign_briefs"
FOR EACH ROW EXECUTE FUNCTION "c03_guard_campaign_brief_identity_and_projection"();

CREATE OR REPLACE FUNCTION "c03_guard_campaign_brief_deliverable_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."deliverable_id" IS DISTINCT FROM OLD."deliverable_id" THEN
    RAISE EXCEPTION 'C03_BRIEF_DELIVERABLE_ID_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW."brief_id" IS DISTINCT FROM OLD."brief_id" THEN
    RAISE EXCEPTION 'C03_BRIEF_DELIVERABLE_PARENT_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_campaign_brief_deliverable_identity_guard"
BEFORE UPDATE ON "campaign_brief_deliverables"
FOR EACH ROW EXECUTE FUNCTION "c03_guard_campaign_brief_deliverable_identity"();

COMMENT ON COLUMN "campaign_briefs"."creative_requirements" IS
  'C-03 compatibility-only; canonical creative intent and creator brief are separate fields.';
COMMENT ON COLUMN "campaign_briefs"."is_active" IS
  'C-03 compatibility projection derived from canonical Brief status.';
COMMENT ON COLUMN "campaign_brief_deliverables"."format" IS
  'C-03 compatibility-only format; canonical format is canonical_format.';

COMMIT;
