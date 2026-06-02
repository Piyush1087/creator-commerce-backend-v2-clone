-- CreateEnum
CREATE TYPE "UceCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');
CREATE TYPE "UceTimelineStructure" AS ENUM ('FIXED_DATES', 'DYNAMIC_MILESTONES');
CREATE TYPE "UceCampaignObjective" AS ENUM ('BRAND_AWARENESS', 'TRAFFIC_CLICKS', 'SALES_CONVERSIONS');
CREATE TYPE "UceCompensationType" AS ENUM ('FIXED_FEE', 'NEGOTIABLE');
CREATE TYPE "UcePayoutTerms" AS ENUM ('IMMEDIATE', 'NET_7', 'NET_15', 'NET_30');
CREATE TYPE "UceCollabStatus" AS ENUM ('PROSPECT_CURATED', 'PROSPECT_INVITED', 'APPLICANT_PENDING', 'APPLICANT_SHORTLISTED', 'APPLICANT_REJECTED', 'ACTIVE_WORKFLOW', 'TERMINATED_CANCELED', 'ARCHIVED_COMPLETE');
CREATE TYPE "UceMilestoneStage" AS ENUM ('STAGE_1_NEGOTIATION', 'STAGE_2_SECUREMENT', 'STAGE_3_LOGISTICS', 'STAGE_4_CONTENT_REVIEW', 'STAGE_5_PUBLISHING', 'STAGE_6_FEEDBACK_SYNC');
CREATE TYPE "UcePipelineHealthStatus" AS ENUM ('ON_TRACK', 'APPROACHING_DEADLINE', 'ACTION_OVERDUE', 'SYSTEM_HOLD');
CREATE TYPE "UceNegotiationSubState" AS ENUM ('BRAND_COUNTER', 'CREATOR_COUNTER', 'FINAL_OFFER_PENDING');
CREATE TYPE "UceSecurementSubState" AS ENUM ('AWAITING_FUNDING', 'AWAITING_SIGNATURE');
CREATE TYPE "UceLogisticsSubState" AS ENUM ('AWAITING_DISPATCH', 'IN_TRANSIT', 'DELIVERY_EXCEPTION');
CREATE TYPE "UceReviewSubState" AS ENUM ('INITIAL_DRAFT_SUBMITTED', 'REVISION_ROUND_ACTIVE', 'CONTENT_HALTED_LOCK');
CREATE TYPE "UcePublishingSubState" AS ENUM ('AWAITING_LIVE_POST', 'COMPLIANCE_CHECK_ACTIVE');
CREATE TYPE "UceMediaPlatform" AS ENUM ('INSTAGRAM', 'TIKTOK', 'YOUTUBE');

-- CreateTable
CREATE TABLE "uce_campaigns" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "current_status" "UceCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uce_campaign_performance_aggregates" (
    "campaign_id" TEXT NOT NULL,
    "total_spend_to_date" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_impressions_count" BIGINT NOT NULL DEFAULT 0,
    "total_clicks_count" BIGINT NOT NULL DEFAULT 0,
    "total_conversions_count" INTEGER NOT NULL DEFAULT 0,
    "total_prospects_count" INTEGER NOT NULL DEFAULT 0,
    "total_applicants_count" INTEGER NOT NULL DEFAULT 0,
    "total_active_collabs_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_performance_aggregates_pkey" PRIMARY KEY ("campaign_id")
);

CREATE TABLE "uce_campaign_strategy" (
    "campaign_id" TEXT NOT NULL,
    "timeline_type" "UceTimelineStructure" NOT NULL,
    "fixed_start_date" TIMESTAMP(3),
    "fixed_end_date" TIMESTAMP(3),
    "dynamic_days_limit" INTEGER,
    "core_objective" "UceCampaignObjective" NOT NULL,
    "platform_deliverables" JSONB NOT NULL,

    CONSTRAINT "uce_campaign_strategy_pkey" PRIMARY KEY ("campaign_id")
);

CREATE TABLE "uce_campaign_targeting" (
    "campaign_id" TEXT NOT NULL,
    "industry_vertical" TEXT NOT NULL,
    "creator_archetypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "follower_tiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience_age_min" INTEGER NOT NULL DEFAULT 18,
    "audience_age_max" INTEGER NOT NULL DEFAULT 65,
    "audience_gender" TEXT NOT NULL DEFAULT 'ALL',
    "target_locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disqualifying_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "uce_campaign_targeting_pkey" PRIMARY KEY ("campaign_id")
);

CREATE TABLE "uce_campaign_commercials" (
    "campaign_id" TEXT NOT NULL,
    "compensation_type" "UceCompensationType" NOT NULL,
    "fixed_fee_amount" DECIMAL(12,2) DEFAULT 0,
    "negotiable_min_fee" DECIMAL(12,2) DEFAULT 0,
    "negotiable_max_fee" DECIMAL(12,2) DEFAULT 0,
    "total_campaign_budget_pool" DECIMAL(14,2) NOT NULL,
    "advance_payment_percentage" INTEGER NOT NULL DEFAULT 30,
    "final_balance_terms" "UcePayoutTerms" NOT NULL DEFAULT 'NET_30',

    CONSTRAINT "uce_campaign_commercials_pkey" PRIMARY KEY ("campaign_id")
);

CREATE TABLE "uce_campaign_products" (
    "product_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "sku_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "inventory_count" INTEGER NOT NULL DEFAULT 0,
    "cost_per_unit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_products_pkey" PRIMARY KEY ("product_id")
);

CREATE TABLE "uce_campaign_briefs" (
    "brief_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "internal_title" TEXT NOT NULL,
    "creative_guidelines" TEXT NOT NULL,
    "required_platforms" "UceMediaPlatform"[],
    "deliverable_format_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_briefs_pkey" PRIMARY KEY ("brief_id")
);

CREATE TABLE "uce_campaign_collaborations" (
    "collaboration_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "product_id" TEXT,
    "instagram_handle" TEXT NOT NULL,
    "creator_email" TEXT NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vetting_remark" TEXT,
    "rejection_reason" TEXT,
    "collab_status" "UceCollabStatus" NOT NULL DEFAULT 'PROSPECT_CURATED',
    "current_milestone" "UceMilestoneStage" NOT NULL DEFAULT 'STAGE_1_NEGOTIATION',
    "pipeline_health" "UcePipelineHealthStatus" NOT NULL DEFAULT 'ON_TRACK',
    "negotiation_state" "UceNegotiationSubState",
    "securement_state" "UceSecurementSubState",
    "logistics_state" "UceLogisticsSubState",
    "review_state" "UceReviewSubState",
    "publishing_state" "UcePublishingSubState",
    "negotiation_round_count" INTEGER NOT NULL DEFAULT 0,
    "fulfillment_issue_count" INTEGER NOT NULL DEFAULT 0,
    "revision_round_count" INTEGER NOT NULL DEFAULT 0,
    "total_quote" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advance_30_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_70_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "logistics_carrier" TEXT,
    "logistics_tracking_number" TEXT,
    "content_draft_url" TEXT,
    "live_published_url" TEXT,
    "compliance_verified" BOOLEAN NOT NULL DEFAULT false,
    "auto_approval_deadline_72h" TIMESTAMP(3),
    "current_milestone_deadline" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_collaborations_pkey" PRIMARY KEY ("collaboration_id")
);

CREATE TABLE "uce_collaboration_audit_logs" (
    "log_id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "stage_context" "UceMilestoneStage" NOT NULL,
    "system_event_tag" TEXT NOT NULL,
    "log_message_payload" TEXT NOT NULL,
    "actor_identifier" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_collaboration_audit_logs_pkey" PRIMARY KEY ("log_id")
);

CREATE TABLE "uce_campaign_reporting_snapshots" (
    "snapshot_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "primary_objective" "UceCampaignObjective" NOT NULL,
    "total_spend_allocated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_earned_media_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_verified_impressions" BIGINT NOT NULL DEFAULT 0,
    "total_verified_reach" BIGINT NOT NULL DEFAULT 0,
    "calculated_cpm_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "calculated_cpe_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_tracked_link_clicks" BIGINT NOT NULL DEFAULT 0,
    "aggregated_ctr_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "calculated_cpc_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "attributed_sales_revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "attributed_conversion_count" INTEGER NOT NULL DEFAULT 0,
    "aggregated_conversion_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "calculated_cac_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "last_api_sync_timestamp" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_reporting_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

CREATE TABLE "uce_campaign_reporting_timeseries_hourly" (
    "log_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "recorded_hour" TIMESTAMP(3) NOT NULL,
    "hourly_likes_count" INTEGER NOT NULL DEFAULT 0,
    "hourly_comments_count" INTEGER NOT NULL DEFAULT 0,
    "hourly_saves_count" INTEGER NOT NULL DEFAULT 0,
    "hourly_shares_count" INTEGER NOT NULL DEFAULT 0,
    "hourly_impressions_delta" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_reporting_timeseries_hourly_pkey" PRIMARY KEY ("log_id")
);

CREATE TABLE "uce_campaign_reporting_asset_gallery" (
    "asset_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "instagram_handle" TEXT NOT NULL,
    "platform" "UceMediaPlatform" NOT NULL,
    "media_thumbnail_url" TEXT NOT NULL,
    "high_res_source_download_url" TEXT NOT NULL,
    "engagement_rate_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "saves_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "story_sticker_clicks_count" INTEGER NOT NULL DEFAULT 0,
    "spark_ad_authorization_code" TEXT,
    "is_whitelisting_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_reporting_asset_gallery_pkey" PRIMARY KEY ("asset_id")
);

-- CreateIndex
CREATE INDEX "uce_campaigns_brand_profile_id_current_status_idx" ON "uce_campaigns"("brand_profile_id", "current_status");
CREATE UNIQUE INDEX "uce_campaign_products_campaign_id_sku_code_key" ON "uce_campaign_products"("campaign_id", "sku_code");
CREATE INDEX "uce_campaign_products_campaign_id_idx" ON "uce_campaign_products"("campaign_id");
CREATE INDEX "uce_campaign_briefs_campaign_id_idx" ON "uce_campaign_briefs"("campaign_id");
CREATE UNIQUE INDEX "uce_campaign_collaborations_campaign_id_instagram_handle_key" ON "uce_campaign_collaborations"("campaign_id", "instagram_handle");
CREATE INDEX "uce_campaign_collaborations_campaign_id_collab_status_curre_idx" ON "uce_campaign_collaborations"("campaign_id", "collab_status", "current_milestone");
CREATE INDEX "uce_campaign_collaborations_pipeline_health_current_milesto_idx" ON "uce_campaign_collaborations"("pipeline_health", "current_milestone_deadline");
CREATE INDEX "uce_collaboration_audit_logs_collaboration_id_logged_at_idx" ON "uce_collaboration_audit_logs"("collaboration_id", "logged_at");
CREATE INDEX "uce_campaign_reporting_snapshots_campaign_id_updated_at_idx" ON "uce_campaign_reporting_snapshots"("campaign_id", "updated_at");
CREATE UNIQUE INDEX "uce_campaign_reporting_timeseries_hourly_campaign_id_record_key" ON "uce_campaign_reporting_timeseries_hourly"("campaign_id", "recorded_hour");
CREATE INDEX "uce_campaign_reporting_asset_gallery_campaign_id_engagement_idx" ON "uce_campaign_reporting_asset_gallery"("campaign_id", "engagement_rate_percentage");

-- AddForeignKey
ALTER TABLE "uce_campaigns" ADD CONSTRAINT "uce_campaigns_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_performance_aggregates" ADD CONSTRAINT "uce_campaign_performance_aggregates_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_strategy" ADD CONSTRAINT "uce_campaign_strategy_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_targeting" ADD CONSTRAINT "uce_campaign_targeting_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_commercials" ADD CONSTRAINT "uce_campaign_commercials_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_products" ADD CONSTRAINT "uce_campaign_products_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_briefs" ADD CONSTRAINT "uce_campaign_briefs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_collaborations" ADD CONSTRAINT "uce_campaign_collaborations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_collaborations" ADD CONSTRAINT "uce_campaign_collaborations_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "uce_campaign_briefs"("brief_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_collaborations" ADD CONSTRAINT "uce_campaign_collaborations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "uce_campaign_products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "uce_collaboration_audit_logs" ADD CONSTRAINT "uce_collaboration_audit_logs_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_reporting_snapshots" ADD CONSTRAINT "uce_campaign_reporting_snapshots_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_reporting_timeseries_hourly" ADD CONSTRAINT "uce_campaign_reporting_timeseries_hourly_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_reporting_asset_gallery" ADD CONSTRAINT "uce_campaign_reporting_asset_gallery_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uce_campaign_reporting_asset_gallery" ADD CONSTRAINT "uce_campaign_reporting_asset_gallery_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id") ON DELETE CASCADE ON UPDATE CASCADE;
