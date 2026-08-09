-- Align brand surface scan storage with product Prompt 1–2 outputs (social links, offers, SKU list metadata).

ALTER TABLE "brand_profiles" ADD COLUMN "social_links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "brand_profiles" ADD COLUMN "surface_offers" JSONB;

ALTER TABLE "offerings" ADD COLUMN "category_tag" TEXT;
ALTER TABLE "offerings" ADD COLUMN "starting_price_label" TEXT;
