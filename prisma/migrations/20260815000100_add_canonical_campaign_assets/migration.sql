CREATE TYPE "UceCampaignAssetKind" AS ENUM ('BRAND', 'OFFERING', 'OFFER');
CREATE TYPE "UceCampaignAssetStatus" AS ENUM ('ACTIVE', 'PAUSED');

CREATE TABLE "uce_campaign_assets" (
  "campaign_asset_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "kind" "UceCampaignAssetKind" NOT NULL,
  "status" "UceCampaignAssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "brand_profile_id" TEXT,
  "offering_id" TEXT,
  "brand_offer_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "uce_campaign_assets_pkey" PRIMARY KEY ("campaign_asset_id"),
  CONSTRAINT "uce_campaign_assets_exactly_one_reference" CHECK (
    ("kind" = 'BRAND' AND "brand_profile_id" IS NOT NULL AND "offering_id" IS NULL AND "brand_offer_id" IS NULL) OR
    ("kind" = 'OFFERING' AND "brand_profile_id" IS NULL AND "offering_id" IS NOT NULL AND "brand_offer_id" IS NULL) OR
    ("kind" = 'OFFER' AND "brand_profile_id" IS NULL AND "offering_id" IS NULL AND "brand_offer_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_brand_profile_id_key" ON "uce_campaign_assets"("campaign_id", "brand_profile_id");
CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_offering_id_key" ON "uce_campaign_assets"("campaign_id", "offering_id");
CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_brand_offer_id_key" ON "uce_campaign_assets"("campaign_id", "brand_offer_id");
CREATE INDEX "uce_campaign_assets_campaign_id_status_idx" ON "uce_campaign_assets"("campaign_id", "status");

ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_brand_offer_id_fkey" FOREIGN KEY ("brand_offer_id") REFERENCES "brand_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
