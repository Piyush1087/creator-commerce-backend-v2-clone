-- UCE Add Asset drawer + Add Brief wizard (change-doc alignment)

CREATE TYPE "uce_campaign_asset_type_enum" AS ENUM (
  'INDIVIDUAL_PRODUCT_SKU',
  'CURATED_COLLECTION_LINE',
  'CORE_BRAND_IDENTITY',
  'ACTIVE_SALE_PROMOTION'
);

CREATE TYPE "uce_brief_strategy_mode_enum" AS ENUM (
  'CREATOR_LED',
  'BRAND_LED'
);

-- Products → campaign assets
ALTER TABLE "uce_campaign_products"
  ADD COLUMN "asset_type" "uce_campaign_asset_type_enum" NOT NULL DEFAULT 'INDIVIDUAL_PRODUCT_SKU',
  ADD COLUMN "asset_payload" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "uce_campaign_products"
  ALTER COLUMN "sku_code" DROP NOT NULL;

CREATE INDEX "uce_campaign_products_campaign_id_asset_type_idx"
  ON "uce_campaign_products"("campaign_id", "asset_type");

-- Briefs → wizard payload + optional product link
ALTER TABLE "uce_campaign_briefs"
  ADD COLUMN "product_id" TEXT,
  ADD COLUMN "brief_type" "uce_brief_strategy_mode_enum",
  ADD COLUMN "purpose" TEXT,
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "target_influencer_archetype" TEXT,
  ADD COLUMN "mandatory_creator_requirements" TEXT,
  ADD COLUMN "deliverables_inventory" JSONB,
  ADD COLUMN "content_guidance_matrix" JSONB,
  ADD COLUMN "parent_planner_logistics_snapshot" JSONB;

ALTER TABLE "uce_campaign_briefs"
  ADD CONSTRAINT "uce_campaign_briefs_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "uce_campaign_products"("product_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "uce_campaign_briefs_product_id_idx"
  ON "uce_campaign_briefs"("product_id");
