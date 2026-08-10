-- CreateEnum
CREATE TYPE "UceApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "UceApplicationSource" AS ENUM ('DIRECT', 'OUTREACH', 'SHARE', 'LEGACY_PIPELINE');

-- CreateEnum
CREATE TYPE "UceBrandSupportType" AS ENUM ('PRODUCT', 'SERVICE', 'EXPERIENCE', 'ACCESS_SUBSCRIPTION', 'OTHER');

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
CREATE TYPE "CollaborationEventKind" AS ENUM ('DOMAIN', 'AUDIT', 'INTEGRATION');

-- DropIndex
DROP INDEX "collaborations_campaign_id_creator_id_key";

-- AlterTable
ALTER TABLE "uce_campaign_commercials" ADD COLUMN     "brand_support_estimated_value" DECIMAL(12,2),
ADD COLUMN     "brand_support_type" "UceBrandSupportType",
ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "receives_brand_support" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "advance_payment_percentage" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "collaborations" ADD COLUMN     "aggregate_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "campaign_asset_id" TEXT,
ADD COLUMN     "campaign_creator_id" TEXT,
ADD COLUMN     "canonical_stage" "CollaborationStage" NOT NULL DEFAULT 'NEGOTIATION',
ADD COLUMN     "current_stage_status" "CollaborationStageStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN     "lifecycle" "CollaborationLifecycle" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "source_application_id" TEXT;

-- CreateTable
CREATE TABLE "uce_brief_deliverables" (
    "id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "format" VARCHAR(80) NOT NULL,
    "display_order" INTEGER NOT NULL,
    "configuration" JSONB,
    "creative_guidance" JSONB,
    "amplify_target_deliverable_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_brief_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_campaign_creators" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_campaign_creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uce_applications" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "campaign_creator_id" TEXT NOT NULL,
    "campaign_asset_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "legacy_pipeline_collaboration_id" TEXT,
    "status" "UceApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "source" "UceApplicationSource" NOT NULL DEFAULT 'DIRECT',
    "proposed_fee" DECIMAL(14,2),
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uce_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "payment_rail" "CollaborationPaymentRail" NOT NULL DEFAULT 'PLATFORM_ESCROW',
    "securement_state" "CollaborationSecurementState",
    "required_secured_amount" DECIMAL(14,2),
    "confirmed_secured_amount" DECIMAL(14,2),
    "terms_locked_at" TIMESTAMP(3),

    CONSTRAINT "collaboration_commercial_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_fulfillments" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "state" "CollaborationFulfillmentState" NOT NULL DEFAULT 'NOT_STARTED',
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_fulfillments_pkey" PRIMARY KEY ("id")
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_deliverable_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_publishing_executions" (
    "id" TEXT NOT NULL,
    "deliverable_execution_id" TEXT NOT NULL,
    "state" "CollaborationPublishingState" NOT NULL,
    "authorization_state" "CollaborationPublicationAuthorizationState" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_publishing_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaboration_events" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "kind" "CollaborationEventKind" NOT NULL,
    "command_id" TEXT,
    "aggregate_version" INTEGER NOT NULL,
    "payload" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uce_brief_deliverables_brief_id_display_order_idx" ON "uce_brief_deliverables"("brief_id", "display_order");

-- CreateIndex
CREATE INDEX "uce_brief_deliverables_amplify_target_deliverable_id_idx" ON "uce_brief_deliverables"("amplify_target_deliverable_id");

-- CreateIndex
CREATE INDEX "uce_campaign_creators_creator_user_id_idx" ON "uce_campaign_creators"("creator_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_campaign_creators_campaign_id_creator_user_id_key" ON "uce_campaign_creators"("campaign_id", "creator_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_applications_request_id_key" ON "uce_applications"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "uce_applications_legacy_pipeline_collaboration_id_key" ON "uce_applications"("legacy_pipeline_collaboration_id");

-- CreateIndex
CREATE INDEX "uce_applications_campaign_id_status_idx" ON "uce_applications"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "uce_applications_campaign_creator_id_status_idx" ON "uce_applications"("campaign_creator_id", "status");

-- CreateIndex
CREATE INDEX "uce_applications_brief_id_status_idx" ON "uce_applications"("brief_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uce_application_snapshots_application_id_key" ON "uce_application_snapshots"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_execution_snapshots_collaboration_id_key" ON "collaboration_execution_snapshots"("collaboration_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_commercial_agreements_collaboration_id_key" ON "collaboration_commercial_agreements"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_commercial_agreements_negotiation_state_idx" ON "collaboration_commercial_agreements"("negotiation_state");

-- CreateIndex
CREATE INDEX "collaboration_commercial_agreements_securement_state_idx" ON "collaboration_commercial_agreements"("securement_state");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_fulfillments_collaboration_id_key" ON "collaboration_fulfillments"("collaboration_id");

-- CreateIndex
CREATE INDEX "collaboration_fulfillments_state_idx" ON "collaboration_fulfillments"("state");

-- CreateIndex
CREATE INDEX "collaboration_deliverable_executions_collaboration_id_state_idx" ON "collaboration_deliverable_executions"("collaboration_id", "state");

-- CreateIndex
CREATE INDEX "collaboration_deliverable_executions_source_brief_deliverab_idx" ON "collaboration_deliverable_executions"("source_brief_deliverable_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_deliverable_executions_collaboration_id_sourc_key" ON "collaboration_deliverable_executions"("collaboration_id", "source_brief_deliverable_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_publishing_executions_deliverable_execution_i_key" ON "collaboration_publishing_executions"("deliverable_execution_id");

-- CreateIndex
CREATE INDEX "collaboration_publishing_executions_state_idx" ON "collaboration_publishing_executions"("state");

-- CreateIndex
CREATE INDEX "collaboration_events_collaboration_id_aggregate_version_idx" ON "collaboration_events"("collaboration_id", "aggregate_version");

-- CreateIndex
CREATE UNIQUE INDEX "collaboration_events_collaboration_id_command_id_key" ON "collaboration_events"("collaboration_id", "command_id");

-- CreateIndex
CREATE UNIQUE INDEX "collaborations_source_application_id_key" ON "collaborations"("source_application_id");

-- CreateIndex
CREATE INDEX "collaborations_campaign_id_creator_id_idx" ON "collaborations"("campaign_id", "creator_id");

-- AddForeignKey
ALTER TABLE "uce_brief_deliverables" ADD CONSTRAINT "uce_brief_deliverables_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "uce_campaign_briefs"("brief_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_brief_deliverables" ADD CONSTRAINT "uce_brief_deliverables_amplify_target_deliverable_id_fkey" FOREIGN KEY ("amplify_target_deliverable_id") REFERENCES "uce_brief_deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_creators" ADD CONSTRAINT "uce_campaign_creators_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_campaign_creators" ADD CONSTRAINT "uce_campaign_creators_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_campaign_creator_id_fkey" FOREIGN KEY ("campaign_creator_id") REFERENCES "uce_campaign_creators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_campaign_asset_id_fkey" FOREIGN KEY ("campaign_asset_id") REFERENCES "uce_campaign_products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "uce_campaign_briefs"("brief_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_applications" ADD CONSTRAINT "uce_applications_legacy_pipeline_collaboration_id_fkey" FOREIGN KEY ("legacy_pipeline_collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uce_application_snapshots" ADD CONSTRAINT "uce_application_snapshots_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "uce_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_source_application_id_fkey" FOREIGN KEY ("source_application_id") REFERENCES "uce_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_execution_snapshots" ADD CONSTRAINT "collaboration_execution_snapshots_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_commercial_agreements" ADD CONSTRAINT "collaboration_commercial_agreements_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_fulfillments" ADD CONSTRAINT "collaboration_fulfillments_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_deliverable_executions" ADD CONSTRAINT "collaboration_deliverable_executions_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_deliverable_executions" ADD CONSTRAINT "collaboration_deliverable_executions_source_brief_delivera_fkey" FOREIGN KEY ("source_brief_deliverable_id") REFERENCES "uce_brief_deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_publishing_executions" ADD CONSTRAINT "collaboration_publishing_executions_deliverable_execution__fkey" FOREIGN KEY ("deliverable_execution_id") REFERENCES "collaboration_deliverable_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
