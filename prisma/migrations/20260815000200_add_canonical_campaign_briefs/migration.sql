CREATE TABLE "campaign_briefs" (
  "brief_id" TEXT NOT NULL,
  "campaign_asset_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "creative_requirements" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_briefs_pkey" PRIMARY KEY ("brief_id")
);

CREATE TABLE "campaign_brief_deliverables" (
  "deliverable_id" TEXT NOT NULL,
  "brief_id" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "creative_requirements" TEXT NOT NULL,
  "publishing_required" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campaign_brief_deliverables_pkey" PRIMARY KEY ("deliverable_id"),
  CONSTRAINT "campaign_brief_deliverables_positive_quantity" CHECK ("quantity" > 0)
);

CREATE INDEX "campaign_briefs_campaign_asset_id_is_active_idx" ON "campaign_briefs"("campaign_asset_id", "is_active");
CREATE INDEX "campaign_brief_deliverables_brief_id_idx" ON "campaign_brief_deliverables"("brief_id");

ALTER TABLE "campaign_briefs" ADD CONSTRAINT "campaign_briefs_campaign_asset_id_fkey" FOREIGN KEY ("campaign_asset_id") REFERENCES "uce_campaign_assets"("campaign_asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaign_brief_deliverables" ADD CONSTRAINT "campaign_brief_deliverables_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "campaign_briefs"("brief_id") ON DELETE CASCADE ON UPDATE CASCADE;
