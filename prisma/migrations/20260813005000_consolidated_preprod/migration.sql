-- Phase F4 consolidated pre-production migration artifact.
-- Baseline schema commit: b8360dfd0cd9ea5d326ec5890e2139c9b9975281
-- Target consolidated runtime/schema commit: 7e346185b009f618bbfc02c3c8cbae143c10e1fe
-- Generated from Prisma schema-to-schema diff and safety-audited before database use.
-- DEV/PRE-PRODUCTION ONLY. Production requires independent data/backfill review.

-- CreateEnum
CREATE TYPE "UceCampaignCreationSource" AS ENUM ('MANUAL', 'AI_RECOMMENDED');

-- CreateEnum
CREATE TYPE "UcePublishingSchedule" AS ENUM ('EVERGREEN', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "UceAudienceGender" AS ENUM ('ALL', 'FEMALE', 'MALE');

-- CreateEnum
CREATE TYPE "UceBrandSupportType" AS ENUM ('PRODUCT', 'SERVICE', 'EXPERIENCE', 'ACCESS_SUBSCRIPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "UceCampaignAssetKind" AS ENUM ('BRAND', 'OFFERING', 'OFFER');

-- CreateEnum
CREATE TYPE "UceCampaignAssetStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "UceBriefStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');

-- CreateEnum
CREATE TYPE "UceBriefCreationSource" AS ENUM ('MANUAL', 'AI_RECOMMENDED');

-- CreateEnum
CREATE TYPE "UceBriefType" AS ENUM ('CREATOR_LED', 'BRAND_LED');

-- CreateEnum
CREATE TYPE "UceDeliverableFormat" AS ENUM ('REEL_VIDEO', 'STORY', 'PHOTOSHOOT', 'BANNER_CAROUSEL');

-- CreateEnum
CREATE TYPE "UceRecommendationScoreBand" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "UceCreatorRecommendationRunType" AS ENUM ('INITIAL', 'REPLENISHMENT');

-- CreateEnum
CREATE TYPE "UceCreatorRecommendationRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "UceCampaignCreatorImportStatus" AS ENUM ('PENDING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "UceApplicantIntelligenceStatus" AS ENUM ('PROCESSING', 'READY', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "UceOutreachChannel" AS ENUM ('PRIORITY_DM', 'EMAIL');

-- CreateEnum
CREATE TYPE "UceOutreachAttemptStatus" AS ENUM ('COMPOSE_INITIATED', 'ACCEPTED', 'SCHEDULED', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UceOutreachTrackingEventType" AS ENUM ('LINK_CLICKED');

-- CreateEnum
CREATE TYPE "UceReportAvailability" AS ENUM ('AVAILABLE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "CollaborationLifecycle" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "CollaborationStage" AS ENUM ('NEGOTIATION', 'SECUREMENT', 'FULFILLMENT', 'PRODUCTION', 'PUBLISHING_SETTLEMENT');

-- CreateEnum
CREATE TYPE "CollaborationStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "CollaborationActorClass" AS ENUM ('BRAND', 'CREATOR', 'SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "CollaborationNegotiationState" AS ENUM ('NOT_REQUIRED', 'AWAITING_BRAND_DECISION', 'AWAITING_CREATOR_DECISION', 'LOCKED', 'FAILED');

-- CreateEnum
CREATE TYPE "CollaborationPaymentRail" AS ENUM ('PLATFORM_ESCROW', 'MANUAL');

-- CreateEnum
CREATE TYPE "CollaborationSecurementState" AS ENUM ('NOT_REQUIRED', 'AWAITING_ESCROW_FUNDING', 'PROCESSING_FUNDING', 'AWAITING_PAYOUT_DETAILS', 'AWAITING_BRAND_PAYMENT', 'AWAITING_CREATOR_CONFIRMATION', 'PAYMENT_DISPUTED', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CollaborationFulfillmentState" AS ENUM ('NOT_STARTED', 'AWAITING_BRAND_FULFILLMENT', 'AWAITING_CREATOR_CONFIRMATION', 'REMEDIATION_REQUIRED', 'COMPLETED', 'SKIPPED', 'HARD_STOP', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CollaborationDeliverableState" AS ENUM ('AWAITING_SUBMISSION', 'UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'AUTO_APPROVED', 'HARD_STOP');

-- CreateEnum
CREATE TYPE "CollaborationSubmissionReviewState" AS ENUM ('UNDER_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'AUTO_APPROVED', 'FINAL_REJECTED');

-- CreateEnum
CREATE TYPE "CollaborationPublishingState" AS ENUM ('PUBLISHING_NOT_REQUIRED', 'AWAITING_PUBLISHING', 'EVIDENCE_SUBMITTED', 'CORRECTION_REQUIRED', 'COMPLIANCE_VERIFIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CollaborationPublicationAuthorizationState" AS ENUM ('NOT_REQUIRED', 'NOT_AUTHORIZED', 'AUTHORIZED');

-- CreateEnum
CREATE TYPE "CollaborationSettlementState" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'PROCESSING', 'SETTLED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CollaborationResolutionStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CollaborationFinancialOutcome" AS ENUM ('NORMAL_SUCCESS', 'NEGOTIATION_EXIT', 'PRE_SECUREMENT_EXIT', 'BRAND_PROTECTED_POST_SECUREMENT_EXIT', 'FULFILLMENT_HARD_STOP', 'PRODUCTION_HARD_STOP', 'CREATOR_NON_PERFORMANCE', 'CREATOR_PUBLISHING_NON_PERFORMANCE', 'ADMIN_RESOLUTION', 'OTHER_POLICY_RESOLUTION');

-- CreateEnum
CREATE TYPE "CollaborationFeedbackAuthorRole" AS ENUM ('BRAND', 'CREATOR');

-- CreateEnum
CREATE TYPE "CollaborationFeedbackVisibility" AS ENUM ('HIDDEN', 'REVEALED');

-- CreateEnum
CREATE TYPE "CollaborationEventKind" AS ENUM ('DOMAIN', 'AUDIT', 'INTEGRATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UcePayoutTerms" ADD VALUE 'NET_45';
ALTER TYPE "UcePayoutTerms" ADD VALUE 'NET_60';

-- AlterTable
ALTER TABLE "brand_profiles" ADD COLUMN     "business_geography" JSONB,
ADD COLUMN     "facebook_handle" TEXT,
ADD COLUMN     "linkedin_handle" TEXT,
ADD COLUMN     "markets_served" JSONB,
ADD COLUMN     "primary_language" TEXT,
ADD COLUMN     "website_currency" TEXT;

-- AlterTable
ALTER TABLE "uce_campaigns" ADD COLUMN     "ai_recommendation_id" TEXT,
ADD COLUMN     "ai_recommendation_version" TEXT,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "creation_source" "UceCampaignCreationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "live_at" TIMESTAMP(3),
ADD COLUMN     "published_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "uce_applications" ADD COLUMN     "canonical_brief_id" TEXT,
ADD COLUMN     "canonical_campaign_asset_id" TEXT;

-- AlterTable
ALTER TABLE "uce_campaign_strategy" ADD COLUMN     "canonical_objective" "CampaignObjective",
ADD COLUMN     "platforms" "UceMediaPlatform"[] DEFAULT ARRAY['INSTAGRAM']::"UceMediaPlatform"[],
ADD COLUMN     "primary_kpi_id" TEXT,
ADD COLUMN     "publish_from" TIMESTAMP(3),
ADD COLUMN     "publish_until" TIMESTAMP(3),
ADD COLUMN     "publishing_schedule" "UcePublishingSchedule" NOT NULL DEFAULT 'EVERGREEN',
ADD COLUMN     "supporting_kpi_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visibility_scope" "UceVisibilityScope" NOT NULL DEFAULT 'EVERYONE';

-- AlterTable
ALTER TABLE "uce_campaign_targeting" ADD COLUMN     "audience_affinity_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "audience_geographies" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "maximum_followers" INTEGER,
ADD COLUMN     "minimum_followers" INTEGER NOT NULL DEFAULT 0;

-- Preserve legacy audience_gender values while moving String -> enum.
-- Unexpected legacy values intentionally fail rather than being silently coerced.
ALTER TABLE "uce_campaign_targeting"
ALTER COLUMN "audience_gender" DROP DEFAULT,
ALTER COLUMN "audience_gender" TYPE "UceAudienceGender"
USING ("audience_gender"::"UceAudienceGender"),
ALTER COLUMN "audience_gender" SET DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "uce_campaign_commercials" ADD COLUMN     "brand_support_estimated_value" DECIMAL(12,2),
ADD COLUMN     "brand_support_type" "UceBrandSupportType",
ADD COLUMN     "commercial_offer" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "receives_brand_support" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "total_campaign_budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
ALTER COLUMN "advance_payment_percentage" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "collaborations" ADD COLUMN     "aggregate_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "campaign_asset_id" TEXT,
ADD COLUMN     "campaign_creator_id" TEXT,
ADD COLUMN     "canonical_brief_id" TEXT,
ADD COLUMN     "canonical_current_stage" "CollaborationStage" NOT NULL DEFAULT 'NEGOTIATION',
ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "current_stage_status" "CollaborationStageStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "ended_at" TIMESTAMP(3),
ADD COLUMN     "ended_by_actor_class" "CollaborationActorClass",
ADD COLUMN     "ended_by_user_id" TEXT,
ADD COLUMN     "ended_from_stage" "CollaborationStage",
ADD COLUMN     "ended_reason_code" TEXT,
ADD COLUMN     "ended_reason_text" TEXT,
ADD COLUMN     "lifecycle" "CollaborationLifecycle" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "source_application_id" TEXT;

-- CreateTable
CREATE TABLE "uce_campaign_assets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "kind" "UceCampaignAssetKind" NOT NULL,
    "status" "UceCampaignAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "brand_profile_id" TEXT,
    "offering_id" TEXT,
    "brand_offer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uce_campaign_assets_exactly_one_reference_check" CHECK (
      ("kind" = 'BRAND' AND "brand_profile_id" IS NOT NULL AND "offering_id" IS NULL AND "brand_offer_id" IS NULL) OR
      ("kind" = 'OFFERING' AND "brand_profile_id" IS NULL AND "offering_id" IS NOT NULL AND "brand_offer_id" IS NULL) OR
      ("kind" = 'OFFER' AND "brand_profile_id" IS NULL AND "offering_id" IS NULL AND "brand_offer_id" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "uce_briefs" (
    "id" TEXT NOT NULL,
    "campaign_asset_id" TEXT NOT NULL,
    "status" "UceBriefStatus" NOT NULL DEFAULT 'DRAFT',
    "creation_source" "UceBriefCreationSource" NOT NULL DEFAULT 'MANUAL',
    "brief_name" TEXT,
    "creative_intent" TEXT,
    "creator_brief" TEXT,
    "brief_type" "UceBriefType",
    "platform" "UceMediaPlatform",
    "brief_level_guidance" JSONB,
    "reference_content" JSONB,
    "usage_rights" JSONB,
    "creator_requirements" TEXT,
    "published_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_brief_deliverables" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "format" "UceDeliverableFormat" NOT NULL,
    "display_order" INTEGER NOT NULL,
    "configuration" JSONB,
    "creative_guidance" JSONB,
    "amplify_target_deliverable_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_brief_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_campaign_recommendation_contexts" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "context_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_recommendation_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_creator_recommendation_runs" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "recommendation_context_id" TEXT NOT NULL,
    "type" "UceCreatorRecommendationRunType" NOT NULL,
    "status" "UceCreatorRecommendationRunStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_creator_recommendation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_campaign_creator_recommendations" (
    "id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "recommendation_run_id" TEXT NOT NULL,
    "recommendation_context_id" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "score_band" "UceRecommendationScoreBand" NOT NULL,
    "rank" INTEGER NOT NULL,
    "explanation" TEXT,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_creator_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_campaign_creator_imports" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "status" "UceCampaignCreatorImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_creator_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_outreach" (
    "id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "channel" "UceOutreachChannel" NOT NULL,
    "composer_version" TEXT,
    "composed_subject" TEXT,
    "final_subject" TEXT,
    "composed_body" TEXT NOT NULL,
    "final_body" TEXT NOT NULL,
    "tracking_token" TEXT NOT NULL,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_outreach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_outreach_attempts" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "outreach_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "UceOutreachAttemptStatus" NOT NULL,
    "destination_ref" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failure_code" TEXT,
    "cancellation_code" TEXT,
    "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_outreach_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_outreach_tracking_events" (
    "id" TEXT NOT NULL,
    "outreach_id" TEXT NOT NULL,
    "type" "UceOutreachTrackingEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_outreach_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_applicant_intelligence" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" "UceApplicantIntelligenceStatus" NOT NULL DEFAULT 'PROCESSING',
    "score" DECIMAL(5,2),
    "strengths" JSONB,
    "weaknesses" JSONB,
    "breakdown" JSONB,
    "intelligence_artifact_id" TEXT,
    "intelligence_version" TEXT,
    "evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_applicant_intelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_campaign_reports" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "latest_calculation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_campaign_report_calculations" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "objective" "CampaignObjective" NOT NULL,
    "primary_kpi_id" TEXT NOT NULL,
    "supporting_kpi_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reporting_version" TEXT NOT NULL,
    "report_context_hash" TEXT,
    "availability" "UceReportAvailability" NOT NULL,
    "data_from" TIMESTAMP(3) NOT NULL,
    "data_through" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,
    "insights" JSONB,
    "provenance" JSONB,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "calculated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uce_campaign_report_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_execution_snapshots" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "campaign_context" JSONB NOT NULL,
    "campaign_asset_context" JSONB NOT NULL,
    "brief_context" JSONB NOT NULL,
    "application_context" JSONB,
    "creator_context" JSONB,
    "brand_context" JSONB,
    "usage_rights" JSONB,
    "creator_requirements" TEXT,
    "receives_brand_support" BOOLEAN NOT NULL DEFAULT false,
    "brand_support_type" "UceBrandSupportType",
    "brand_support_estimated_value" DECIMAL(12,2),
    "campaign_commercial_context" JSONB,
    "advance_percentage_snapshot" INTEGER NOT NULL,
    "commercial_currency" VARCHAR(3) NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_execution_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_commercial_agreements" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "negotiation_state" "CollaborationNegotiationState" NOT NULL,
    "application_proposed_fee" DECIMAL(14,2),
    "brand_counter_fee" DECIMAL(14,2),
    "agreed_creator_fee" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL,
    "advance_percentage_snapshot" INTEGER NOT NULL,
    "advance_amount" DECIMAL(14,2),
    "balance_amount" DECIMAL(14,2),
    "non_cash_consideration" JSONB,
    "pricing_tier_snapshot" VARCHAR(80),
    "business_country_code_snapshot" VARCHAR(2),
    "financial_policy_version_snapshot" VARCHAR(80),
    "platform_commission_rate_snapshot" DECIMAL(7,4),
    "platform_commission_amount" DECIMAL(14,2),
    "platform_commission_gst_rate_snapshot" DECIMAL(7,4),
    "platform_commission_gst_amount" DECIMAL(14,2),
    "payment_rail" "CollaborationPaymentRail" NOT NULL DEFAULT 'PLATFORM_ESCROW',
    "securement_state" "CollaborationSecurementState",
    "required_secured_amount" DECIMAL(14,2),
    "confirmed_secured_amount" DECIMAL(14,2),
    "escrow_lock_ref" TEXT,
    "funding_instruction_ref" TEXT,
    "funding_confirmation_ref" TEXT,
    "manual_payment_evidence_ref" TEXT,
    "manual_creator_confirmed_at" TIMESTAMP(3),
    "payment_dispute_ref" TEXT,
    "terms_locked_at" TIMESTAMP(3),
    "securement_completed_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_commercial_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_fulfillments" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "state" "CollaborationFulfillmentState" NOT NULL DEFAULT 'NOT_STARTED',
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "shipment_tracking_ref" TEXT,
    "courier_name" TEXT,
    "access_evidence_ref" TEXT,
    "redemption_code" TEXT,
    "service_evidence_ref" TEXT,
    "generic_fulfillment_evidence" JSONB,
    "brand_fulfilled_at" TIMESTAMP(3),
    "creator_confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "hard_stopped_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_fulfillment_issues" (
    "id" TEXT NOT NULL,
    "fulfillment_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "issue_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_ref" TEXT,
    "reported_by_user_id" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remediation_evidence_ref" TEXT,
    "remediation_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_fulfillment_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_deliverable_executions" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "source_brief_deliverable_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "definition_snapshot" JSONB NOT NULL,
    "state" "CollaborationDeliverableState" NOT NULL DEFAULT 'AWAITING_SUBMISSION',
    "revision_request_count" INTEGER NOT NULL DEFAULT 0,
    "publishing_required" BOOLEAN NOT NULL,
    "approved_at" TIMESTAMP(3),
    "auto_approved_at" TIMESTAMP(3),
    "hard_stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_deliverable_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_submission_versions" (
    "id" TEXT NOT NULL,
    "deliverable_execution_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "asset_ref" TEXT NOT NULL,
    "submission_metadata" JSONB,
    "review_state" "CollaborationSubmissionReviewState" NOT NULL DEFAULT 'UNDER_REVIEW',
    "brand_feedback" TEXT,
    "review_deadline_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "auto_approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_submission_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_publishing_executions" (
    "id" TEXT NOT NULL,
    "deliverable_execution_id" TEXT NOT NULL,
    "state" "CollaborationPublishingState" NOT NULL DEFAULT 'PUBLISHING_NOT_REQUIRED',
    "authorization_state" "CollaborationPublicationAuthorizationState" NOT NULL DEFAULT 'NOT_REQUIRED',
    "authorized_at" TIMESTAMP(3),
    "authorized_by_user_id" TEXT,
    "publication_evidence_ref" TEXT,
    "publication_metadata" JSONB,
    "evidence_submitted_at" TIMESTAMP(3),
    "compliance_evidence_ref" TEXT,
    "correction_reason" TEXT,
    "compliance_verified_at" TIMESTAMP(3),
    "blocked_reason" TEXT,

    CONSTRAINT "collaboration_publishing_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_financial_resolutions" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "status" "CollaborationResolutionStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "outcome" "CollaborationFinancialOutcome",
    "creator_entitlement_amount" DECIMAL(14,2),
    "brand_refund_entitlement_amount" DECIMAL(14,2),
    "creator_gross_entitlement_amount" DECIMAL(14,2),
    "creator_commercial_refund_amount" DECIMAL(14,2),
    "platform_commission_retained_amount" DECIMAL(14,2),
    "platform_commission_refund_amount" DECIMAL(14,2),
    "platform_commission_gst_retained_amount" DECIMAL(14,2),
    "platform_commission_gst_refund_amount" DECIMAL(14,2),
    "brand_commercial_refund_entitlement_amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "reason_code" TEXT,
    "reason_text" TEXT,
    "resolution_evidence" JSONB,
    "residual_obligations" JSONB,
    "decided_by_actor_class" "CollaborationActorClass",
    "decided_by_user_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_financial_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_settlements" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "state" "CollaborationSettlementState" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "creator_settlement_amount" DECIMAL(14,2),
    "brand_refund_amount" DECIMAL(14,2),
    "currency" VARCHAR(3),
    "payout_instruction_ref" TEXT,
    "payout_execution_ref" TEXT,
    "refund_execution_ref" TEXT,
    "authoritative_confirmation_ref" TEXT,
    "eligible_at" TIMESTAMP(3),
    "processing_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "blocked_at" TIMESTAMP(3),
    "blocked_reason" TEXT,

    CONSTRAINT "collaboration_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_feedback_windows" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "visibility" "CollaborationFeedbackVisibility" NOT NULL DEFAULT 'HIDDEN',
    "revealed_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_feedback_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_feedback" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "author_role" "CollaborationFeedbackAuthorRole" NOT NULL,
    "author_user_id" TEXT,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_events" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "kind" "CollaborationEventKind" NOT NULL DEFAULT 'DOMAIN',
    "event_type" TEXT NOT NULL,
    "actor_class" "CollaborationActorClass" NOT NULL,
    "actor_user_id" TEXT,
    "command_id" TEXT,
    "correlation_id" TEXT,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uce_campaign_assets_campaign_id_status_idx" ON "uce_campaign_assets"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_brand_profile_id_key" ON "uce_campaign_assets"("campaign_id", "brand_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_offering_id_key" ON "uce_campaign_assets"("campaign_id", "offering_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_assets_campaign_id_brand_offer_id_key" ON "uce_campaign_assets"("campaign_id", "brand_offer_id");

-- CreateIndex
CREATE INDEX "uce_briefs_campaign_asset_id_status_idx" ON "uce_briefs"("campaign_asset_id", "status");

-- CreateIndex
CREATE INDEX "uce_briefs_creation_source_idx" ON "uce_briefs"("creation_source");

-- CreateIndex
CREATE INDEX "uce_brief_deliverables_brief_id_display_order_idx" ON "uce_brief_deliverables"("brief_id", "display_order");

-- CreateIndex
CREATE INDEX "uce_brief_deliverables_amplify_target_deliverable_id_idx" ON "uce_brief_deliverables"("amplify_target_deliverable_id");

-- CreateIndex
CREATE INDEX "uce_campaign_recommendation_contexts_campaign_id_idx" ON "uce_campaign_recommendation_contexts"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_recommendation_contexts_campaign_id_version_key" ON "uce_campaign_recommendation_contexts"("campaign_id", "version");

-- CreateIndex
CREATE INDEX "uce_creator_recommendation_runs_campaign_id_status_idx" ON "uce_creator_recommendation_runs"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "uce_creator_recommendation_runs_recommendation_context_id_idx" ON "uce_creator_recommendation_runs"("recommendation_context_id");

-- CreateIndex
CREATE INDEX "uce_campaign_creator_recommendations_recommendation_run_id__idx" ON "uce_campaign_creator_recommendations"("recommendation_run_id", "rank");

-- CreateIndex
CREATE INDEX "uce_campaign_creator_recommendations_recommendation_context_idx" ON "uce_campaign_creator_recommendations"("recommendation_context_id");

-- CreateIndex
CREATE INDEX "uce_campaign_creator_recommendations_campaign_creator_id_ev_idx" ON "uce_campaign_creator_recommendations"("campaign_creator_id", "evaluated_at");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_creator_recommendations_campaign_creator_id_re_key" ON "uce_campaign_creator_recommendations"("campaign_creator_id", "recommendation_run_id");

-- CreateIndex
CREATE INDEX "uce_campaign_creator_imports_campaign_id_status_idx" ON "uce_campaign_creator_imports"("campaign_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uce_outreach_campaign_creator_id_key" ON "uce_outreach"("campaign_creator_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_outreach_tracking_token_key" ON "uce_outreach"("tracking_token");

-- CreateIndex
CREATE INDEX "uce_outreach_channel_initiated_at_idx" ON "uce_outreach"("channel", "initiated_at");

-- CreateIndex
CREATE UNIQUE INDEX "uce_outreach_attempts_request_id_key" ON "uce_outreach_attempts"("request_id");

-- CreateIndex
CREATE INDEX "uce_outreach_attempts_status_scheduled_for_idx" ON "uce_outreach_attempts"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "uce_outreach_attempts_outreach_id_sequence_key" ON "uce_outreach_attempts"("outreach_id", "sequence");

-- CreateIndex
CREATE INDEX "uce_outreach_tracking_events_outreach_id_occurred_at_idx" ON "uce_outreach_tracking_events"("outreach_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "uce_applicant_intelligence_application_id_key" ON "uce_applicant_intelligence"("application_id");

-- CreateIndex
CREATE INDEX "uce_applicant_intelligence_status_idx" ON "uce_applicant_intelligence"("status");

-- CreateIndex
CREATE INDEX "uce_applicant_intelligence_score_idx" ON "uce_applicant_intelligence"("score");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_reports_campaign_id_key" ON "uce_campaign_reports"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_reports_latest_calculation_id_key" ON "uce_campaign_reports"("latest_calculation_id");

-- CreateIndex
CREATE INDEX "uce_campaign_report_calculations_report_id_calculated_at_idx" ON "uce_campaign_report_calculations"("report_id", "calculated_at");

-- CreateIndex
CREATE INDEX "uce_campaign_report_calculations_availability_idx" ON "uce_campaign_report_calculations"("availability");

-- CreateIndex
CREATE INDEX "uce_campaign_report_calculations_is_final_idx" ON "uce_campaign_report_calculations"("is_final");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_report_calculations_report_id_version_key" ON "uce_campaign_report_calculations"("report_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_execution_snapshots_collaboration_id_key" ON "collaboration_execution_snapshots"("collaboration_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_commercial_agreements_collaboration_id_key" ON "collaboration_commercial_agreements"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_commercial_agreements_negotiation_state_idx" ON "collaboration_commercial_agreements"("negotiation_state");

-- CreateIndex
CREATE INDEX "collaboration_commercial_agreements_securement_state_idx" ON "collaboration_commercial_agreements"("securement_state");

-- CreateIndex
CREATE INDEX "collaboration_commercial_agreements_pricing_tier_snapshot_b_idx" ON "collaboration_commercial_agreements"("pricing_tier_snapshot", "business_country_code_snapshot");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_fulfillments_collaboration_id_key" ON "collaboration_fulfillments"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_fulfillments_state_idx" ON "collaboration_fulfillments"("state");

-- CreateIndex
CREATE INDEX "collaboration_fulfillment_issues_fulfillment_id_reported_at_idx" ON "collaboration_fulfillment_issues"("fulfillment_id", "reported_at");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_fulfillment_issues_fulfillment_id_sequence_key" ON "collaboration_fulfillment_issues"("fulfillment_id", "sequence");

-- CreateIndex
CREATE INDEX "collaboration_deliverable_executions_collaboration_id_state_idx" ON "collaboration_deliverable_executions"("collaboration_id", "state");

-- CreateIndex
CREATE INDEX "collaboration_deliverable_executions_source_brief_deliverab_idx" ON "collaboration_deliverable_executions"("source_brief_deliverable_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_deliverable_executions_collaboration_id_sourc_key" ON "collaboration_deliverable_executions"("collaboration_id", "source_brief_deliverable_id");

-- CreateIndex
CREATE INDEX "collaboration_submission_versions_review_state_review_deadl_idx" ON "collaboration_submission_versions"("review_state", "review_deadline_at");

-- CreateIndex
CREATE INDEX "collaboration_submission_versions_deliverable_execution_id__idx" ON "collaboration_submission_versions"("deliverable_execution_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_submission_versions_deliverable_execution_id__key" ON "collaboration_submission_versions"("deliverable_execution_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_publishing_executions_deliverable_execution_i_key" ON "collaboration_publishing_executions"("deliverable_execution_id");

-- CreateIndex
CREATE INDEX "collaboration_publishing_executions_state_idx" ON "collaboration_publishing_executions"("state");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_financial_resolutions_collaboration_id_key" ON "collaboration_financial_resolutions"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_financial_resolutions_status_idx" ON "collaboration_financial_resolutions"("status");

-- CreateIndex
CREATE INDEX "collaboration_financial_resolutions_outcome_idx" ON "collaboration_financial_resolutions"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_settlements_collaboration_id_key" ON "collaboration_settlements"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_settlements_state_idx" ON "collaboration_settlements"("state");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_feedback_windows_collaboration_id_key" ON "collaboration_feedback_windows"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_feedback_windows_visibility_closes_at_idx" ON "collaboration_feedback_windows"("visibility", "closes_at");

-- CreateIndex
CREATE INDEX "collaboration_feedback_collaboration_id_submitted_at_idx" ON "collaboration_feedback"("collaboration_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_feedback_collaboration_id_author_role_key" ON "collaboration_feedback"("collaboration_id", "author_role");

-- CreateIndex
CREATE INDEX "collaboration_events_collaboration_id_occurred_at_idx" ON "collaboration_events"("collaboration_id", "occurred_at");

-- CreateIndex
CREATE INDEX "collaboration_events_command_id_idx" ON "collaboration_events"("command_id");

-- CreateIndex
CREATE INDEX "collaboration_events_event_type_occurred_at_idx" ON "collaboration_events"("event_type", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_events_collaboration_id_aggregate_version_key" ON "collaboration_events"("collaboration_id", "aggregate_version");

-- CreateIndex
CREATE INDEX "uce_applications_canonical_campaign_asset_id_status_idx" ON "uce_applications"("canonical_campaign_asset_id", "status");

-- CreateIndex
CREATE INDEX "uce_applications_canonical_brief_id_status_idx" ON "uce_applications"("canonical_brief_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "collaborations_source_application_id_key" ON "collaborations"("source_application_id");

-- CreateIndex
CREATE INDEX "collaborations_campaign_id_lifecycle_idx" ON "collaborations"("campaign_id", "lifecycle");

-- CreateIndex
CREATE INDEX "collaborations_campaign_creator_id_idx" ON "collaborations"("campaign_creator_id");

-- CreateIndex
CREATE INDEX "collaborations_campaign_asset_id_idx" ON "collaborations"("campaign_asset_id");

-- CreateIndex
CREATE INDEX "collaborations_canonical_brief_id_idx" ON "collaborations"("canonical_brief_id");

-- CreateIndex
CREATE INDEX "collaborations_brief_id_idx" ON "collaborations"("brief_id");

-- CreateIndex
CREATE INDEX "collaborations_canonical_current_stage_current_stage_status_idx" ON "collaborations"("canonical_current_stage", "current_stage_status");

-- CreateIndex
CREATE INDEX "collaboration_messages_sender_user_id_idx" ON "collaboration_messages"("sender_user_id");

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_canonical_campaign_asset_id_fkey" FOREIGN KEY ("canonical_campaign_asset_id") REFERENCES "uce_campaign_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_canonical_brief_id_fkey" FOREIGN KEY ("canonical_brief_id") REFERENCES "uce_briefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_assets" ADD CONSTRAINT "uce_campaign_assets_brand_offer_id_fkey" FOREIGN KEY ("brand_offer_id") REFERENCES "brand_offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_briefs" ADD CONSTRAINT "uce_briefs_campaign_asset_id_fkey" FOREIGN KEY ("campaign_asset_id") REFERENCES "uce_campaign_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_brief_deliverables" ADD CONSTRAINT "uce_brief_deliverables_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "uce_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_brief_deliverables" ADD CONSTRAINT "uce_brief_deliverables_amplify_target_deliverable_id_fkey" FOREIGN KEY ("amplify_target_deliverable_id") REFERENCES "uce_brief_deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_recommendation_contexts" ADD CONSTRAINT "uce_campaign_recommendation_contexts_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_creator_recommendation_runs" ADD CONSTRAINT "uce_creator_recommendation_runs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_creator_recommendation_runs" ADD CONSTRAINT "uce_creator_recommendation_runs_recommendation_context_id_fkey" FOREIGN KEY ("recommendation_context_id") REFERENCES "uce_campaign_recommendation_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_creator_recommendations" ADD CONSTRAINT "uce_campaign_creator_recommendations_campaign_creator_id_fkey" FOREIGN KEY ("campaign_creator_id") REFERENCES "uce_campaign_creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_creator_recommendations" ADD CONSTRAINT "uce_campaign_creator_recommendations_recommendation_run_id_fkey" FOREIGN KEY ("recommendation_run_id") REFERENCES "uce_creator_recommendation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_creator_recommendations" ADD CONSTRAINT "uce_campaign_creator_recommendations_recommendation_contex_fkey" FOREIGN KEY ("recommendation_context_id") REFERENCES "uce_campaign_recommendation_contexts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_creator_imports" ADD CONSTRAINT "uce_campaign_creator_imports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_outreach" ADD CONSTRAINT "uce_outreach_campaign_creator_id_fkey" FOREIGN KEY ("campaign_creator_id") REFERENCES "uce_campaign_creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_outreach_attempts" ADD CONSTRAINT "uce_outreach_attempts_outreach_id_fkey" FOREIGN KEY ("outreach_id") REFERENCES "uce_outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_outreach_tracking_events" ADD CONSTRAINT "uce_outreach_tracking_events_outreach_id_fkey" FOREIGN KEY ("outreach_id") REFERENCES "uce_outreach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applicant_intelligence" ADD CONSTRAINT "uce_applicant_intelligence_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "uce_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_reports" ADD CONSTRAINT "uce_campaign_reports_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_reports" ADD CONSTRAINT "uce_campaign_reports_latest_calculation_id_fkey" FOREIGN KEY ("latest_calculation_id") REFERENCES "uce_campaign_report_calculations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_report_calculations" ADD CONSTRAINT "uce_campaign_report_calculations_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "uce_campaign_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_source_application_id_fkey" FOREIGN KEY ("source_application_id") REFERENCES "uce_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_campaign_creator_id_fkey" FOREIGN KEY ("campaign_creator_id") REFERENCES "uce_campaign_creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_campaign_asset_id_fkey" FOREIGN KEY ("campaign_asset_id") REFERENCES "uce_campaign_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_canonical_brief_id_fkey" FOREIGN KEY ("canonical_brief_id") REFERENCES "uce_briefs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_execution_snapshots" ADD CONSTRAINT "collaboration_execution_snapshots_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_commercial_agreements" ADD CONSTRAINT "collaboration_commercial_agreements_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_fulfillments" ADD CONSTRAINT "collaboration_fulfillments_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_fulfillment_issues" ADD CONSTRAINT "collaboration_fulfillment_issues_fulfillment_id_fkey" FOREIGN KEY ("fulfillment_id") REFERENCES "collaboration_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_deliverable_executions" ADD CONSTRAINT "collaboration_deliverable_executions_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_deliverable_executions" ADD CONSTRAINT "collaboration_deliverable_executions_source_brief_delivera_fkey" FOREIGN KEY ("source_brief_deliverable_id") REFERENCES "uce_brief_deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_submission_versions" ADD CONSTRAINT "collaboration_submission_versions_deliverable_execution_id_fkey" FOREIGN KEY ("deliverable_execution_id") REFERENCES "collaboration_deliverable_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_publishing_executions" ADD CONSTRAINT "collaboration_publishing_executions_deliverable_execution__fkey" FOREIGN KEY ("deliverable_execution_id") REFERENCES "collaboration_deliverable_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_financial_resolutions" ADD CONSTRAINT "collaboration_financial_resolutions_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_settlements" ADD CONSTRAINT "collaboration_settlements_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_feedback_windows" ADD CONSTRAINT "collaboration_feedback_windows_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_feedback" ADD CONSTRAINT "collaboration_feedback_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
