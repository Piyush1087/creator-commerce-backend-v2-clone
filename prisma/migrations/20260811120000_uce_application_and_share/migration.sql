-- Application ownership + Share tracking (Phase 3 docs)

CREATE TYPE "UceApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED');
CREATE TYPE "UceApplicationSource" AS ENUM ('DIRECT', 'OUTREACH', 'SHARE');
CREATE TYPE "UceCampaignCreatorSource" AS ENUM ('META_MARKETPLACE', 'MANUAL');
CREATE TYPE "UceCampaignCreatorIngestionMethod" AS ENUM ('MARKETPLACE_RECOMMENDATION', 'MANUAL_SINGLE', 'MANUAL_CSV');
CREATE TYPE "UceCampaignCreatorReviewState" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'REJECTED');
CREATE TYPE "UceCampaignShareChannel" AS ENUM ('COPY_LINK', 'WHATSAPP', 'INSTAGRAM', 'NATIVE_SHARE');
CREATE TYPE "UceCampaignShareTrackingEventType" AS ENUM ('LINK_CLICKED');

CREATE TABLE "uce_campaign_creators" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creator_profile_id" TEXT,
    "platform" "UceMediaPlatform" NOT NULL DEFAULT 'INSTAGRAM',
    "social_handle" TEXT NOT NULL,
    "normalized_social_handle" TEXT NOT NULL,
    "email" TEXT,
    "source" "UceCampaignCreatorSource" NOT NULL DEFAULT 'MANUAL',
    "ingestion_method" "UceCampaignCreatorIngestionMethod" NOT NULL DEFAULT 'MANUAL_SINGLE',
    "review_state" "UceCampaignCreatorReviewState" NOT NULL DEFAULT 'PENDING_REVIEW',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "uce_campaign_creators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_applications" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "campaign_asset_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "status" "UceApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "UceApplicationSource" NOT NULL DEFAULT 'DIRECT',
    "superseded_by_application_id" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "uce_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_application_snapshots" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "campaign_context" JSONB NOT NULL,
    "campaign_asset_context" JSONB NOT NULL,
    "brief_context" JSONB NOT NULL,
    "commercial_context" JSONB NOT NULL,
    "creator_identity" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uce_application_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_campaign_shares" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "channel" "UceCampaignShareChannel" NOT NULL,
    "tracking_token" TEXT NOT NULL,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uce_campaign_shares_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_campaign_share_tracking_events" (
    "id" TEXT NOT NULL,
    "share_id" TEXT NOT NULL,
    "type" "UceCampaignShareTrackingEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uce_campaign_share_tracking_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uce_campaign_creators_campaign_id_platform_normalized_social_handle_key" ON "uce_campaign_creators"("campaign_id", "platform", "normalized_social_handle");
CREATE INDEX "uce_campaign_creators_campaign_id_review_state_idx" ON "uce_campaign_creators"("campaign_id", "review_state");

CREATE UNIQUE INDEX "uce_applications_request_id_key" ON "uce_applications"("request_id");
CREATE INDEX "uce_applications_campaign_id_status_idx" ON "uce_applications"("campaign_id", "status");
CREATE INDEX "uce_applications_campaign_creator_id_status_idx" ON "uce_applications"("campaign_creator_id", "status");
CREATE INDEX "uce_applications_brief_id_status_idx" ON "uce_applications"("brief_id", "status");

CREATE UNIQUE INDEX "uce_application_snapshots_application_id_key" ON "uce_application_snapshots"("application_id");

CREATE UNIQUE INDEX "uce_campaign_shares_request_id_key" ON "uce_campaign_shares"("request_id");
CREATE UNIQUE INDEX "uce_campaign_shares_tracking_token_key" ON "uce_campaign_shares"("tracking_token");
CREATE INDEX "uce_campaign_shares_campaign_id_initiated_at_idx" ON "uce_campaign_shares"("campaign_id", "initiated_at");

CREATE INDEX "uce_campaign_share_tracking_events_share_id_occurred_at_idx" ON "uce_campaign_share_tracking_events"("share_id", "occurred_at");

ALTER TABLE "uce_campaign_creators" ADD CONSTRAINT "uce_campaign_creators_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_creators" ADD CONSTRAINT "uce_campaign_creators_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_campaign_creator_id_fkey" FOREIGN KEY ("campaign_creator_id") REFERENCES "uce_campaign_creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_campaign_asset_id_fkey" FOREIGN KEY ("campaign_asset_id") REFERENCES "uce_campaign_products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "uce_campaign_briefs"("brief_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_superseded_by_application_id_fkey" FOREIGN KEY ("superseded_by_application_id") REFERENCES "uce_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "uce_application_snapshots" ADD CONSTRAINT "uce_application_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "uce_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "uce_campaign_shares" ADD CONSTRAINT "uce_campaign_shares_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "uce_campaign_share_tracking_events" ADD CONSTRAINT "uce_campaign_share_tracking_events_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "uce_campaign_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
