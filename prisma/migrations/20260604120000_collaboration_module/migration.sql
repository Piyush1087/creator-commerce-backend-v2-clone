-- Rename influencer role to creator (product terminology)
ALTER TYPE "UserRole" RENAME VALUE 'INFLUENCER' TO 'CREATOR';

-- Collaboration enums
CREATE TYPE "CollaborationPayoutMode" AS ENUM ('ESCROW', 'MANUAL', 'BARTER');
CREATE TYPE "CollaborationIndustryType" AS ENUM ('D2C_ECOMMERCE', 'HEALTHCARE_CLINICAL', 'AI_SAAS', 'OFFLINE_EXPERIENCES');
CREATE TYPE "FulfillmentIssueType" AS ENUM ('DAMAGED', 'INVALID_CODE', 'LOST', 'TECH_ERROR', 'NO_SHOW');
CREATE TYPE "CollaborationMediaPhase" AS ENUM ('SCRIPTING', 'MEDIA');
CREATE TYPE "CollaborationMediaReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CollaborationEscrowStatus" AS ENUM ('AWAITING_FUNDS', 'FUNDED', 'PARTIAL_RELEASE', 'SETTLED', 'REFUNDED');
CREATE TYPE "CollaborationMessageKind" AS ENUM ('USER', 'SYSTEM');

-- Creator profile prerequisites
CREATE TABLE "creator_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "instagram_handle" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creator_bank_details" (
    "id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "account_holder" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "ifsc_or_routing" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_bank_details_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "creator_shipping_addresses" (
    "id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "city" TEXT NOT NULL,
    "state_region" TEXT,
    "postal_code" TEXT NOT NULL,
    "country_code" TEXT NOT NULL DEFAULT 'IN',
    "phone" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_shipping_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaborations" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "brief_id" TEXT NOT NULL,
    "product_id" TEXT,
    "uce_pipeline_collaboration_id" TEXT,
    "current_stage" "UceMilestoneStage" NOT NULL DEFAULT 'STAGE_1_NEGOTIATION',
    "payout_mode" "CollaborationPayoutMode" NOT NULL DEFAULT 'ESCROW',
    "industry" "CollaborationIndustryType" NOT NULL,
    "negotiation_round" INTEGER NOT NULL DEFAULT 0,
    "fulfillment_issue_count" INTEGER NOT NULL DEFAULT 0,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "unread_count_brand" INTEGER NOT NULL DEFAULT 0,
    "unread_count_creator" INTEGER NOT NULL DEFAULT 0,
    "last_message_snippet" TEXT,
    "last_message_at" TIMESTAMP(3),
    "stage_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "is_terminated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaborations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_commercials" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "initial_quote" DECIMAL(12,2),
    "brand_counter_offer" DECIMAL(12,2),
    "final_quote" DECIMAL(12,2),
    "product_retail_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_final_offer" BOOLEAN NOT NULL DEFAULT false,
    "advance_30_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_70_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creator_bank_details_id" TEXT,
    "escrow_vault_id" TEXT,
    "escrow_status" "CollaborationEscrowStatus",
    "advance_receipt_url" TEXT,
    "final_receipt_url" TEXT,
    "agreement_pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_commercials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_logistics" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "tracking_id" TEXT,
    "courier_name" TEXT,
    "digital_access_credentials" TEXT,
    "redemption_code" TEXT,
    "is_received_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "last_reported_issue" "FulfillmentIssueType",
    "issue_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_logistics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_media" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "phase" "CollaborationMediaPhase" NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "media_url" TEXT NOT NULL,
    "deliverable_type" TEXT,
    "status" "CollaborationMediaReviewStatus" NOT NULL DEFAULT 'PENDING',
    "brand_feedback" TEXT,
    "is_aspect_ratio_verified" BOOLEAN NOT NULL DEFAULT false,
    "auto_approval_deadline" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_finalization" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "live_post_url" TEXT,
    "partnership_ad_code" TEXT,
    "is_compliance_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_final_payout_released" BOOLEAN NOT NULL DEFAULT false,
    "creator_rating" INTEGER,
    "creator_review_text" TEXT,
    "brand_rating" INTEGER,
    "brand_review_text" TEXT,
    "reviews_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaboration_finalization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_messages" (
    "id" TEXT NOT NULL,
    "collaboration_id" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "kind" "CollaborationMessageKind" NOT NULL DEFAULT 'USER',
    "body" TEXT NOT NULL,
    "system_event_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collaboration_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_profiles_user_id_key" ON "creator_profiles"("user_id");
CREATE INDEX "creator_bank_details_creator_profile_id_idx" ON "creator_bank_details"("creator_profile_id");
CREATE INDEX "creator_shipping_addresses_creator_profile_id_idx" ON "creator_shipping_addresses"("creator_profile_id");

CREATE UNIQUE INDEX "collaborations_uce_pipeline_collaboration_id_key" ON "collaborations"("uce_pipeline_collaboration_id");
CREATE UNIQUE INDEX "collaborations_campaign_id_creator_id_key" ON "collaborations"("campaign_id", "creator_id");
CREATE INDEX "collaborations_brand_id_current_stage_idx" ON "collaborations"("brand_id", "current_stage");
CREATE INDEX "collaborations_creator_id_current_stage_idx" ON "collaborations"("creator_id", "current_stage");
CREATE INDEX "collaborations_last_message_at_idx" ON "collaborations"("last_message_at");

CREATE UNIQUE INDEX "collaboration_commercials_collaboration_id_key" ON "collaboration_commercials"("collaboration_id");
CREATE UNIQUE INDEX "collaboration_logistics_collaboration_id_key" ON "collaboration_logistics"("collaboration_id");
CREATE INDEX "collaboration_media_collaboration_id_phase_version_number_idx" ON "collaboration_media"("collaboration_id", "phase", "version_number");
CREATE UNIQUE INDEX "collaboration_finalization_collaboration_id_key" ON "collaboration_finalization"("collaboration_id");
CREATE INDEX "collaboration_messages_collaboration_id_created_at_idx" ON "collaboration_messages"("collaboration_id", "created_at");

ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_bank_details" ADD CONSTRAINT "creator_bank_details_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "creator_shipping_addresses" ADD CONSTRAINT "creator_shipping_addresses_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "uce_campaign_briefs"("brief_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "uce_campaign_products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_uce_pipeline_collaboration_id_fkey" FOREIGN KEY ("uce_pipeline_collaboration_id") REFERENCES "uce_campaign_collaborations"("collaboration_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "collaboration_commercials" ADD CONSTRAINT "collaboration_commercials_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_commercials" ADD CONSTRAINT "collaboration_commercials_creator_bank_details_id_fkey" FOREIGN KEY ("creator_bank_details_id") REFERENCES "creator_bank_details"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "collaboration_logistics" ADD CONSTRAINT "collaboration_logistics_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_media" ADD CONSTRAINT "collaboration_media_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_finalization" ADD CONSTRAINT "collaboration_finalization_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_messages" ADD CONSTRAINT "collaboration_messages_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
