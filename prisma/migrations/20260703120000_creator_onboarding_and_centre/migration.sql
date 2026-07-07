-- Creator onboarding, centre, co-pilot, and Instagram integration extensions.
-- Apply with: npm run db:migrate:deploy

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM (
  'HANDLE_INPUTTED',
  'ELIGIBILITY_CALCULATED',
  'FEATURES_STAGED',
  'ACCOUNT_CREATED',
  'OTP_VERIFIED',
  'META_OAUTH_SUCCESS',
  'AI_ENGINE_SYNCED',
  'WAITLISTED'
);

-- CreateEnum
CREATE TYPE "ActivatedModule" AS ENUM (
  'MESSY_DMS_TO_DEALS',
  'BUILDING_UPDATING_MEDIA_KIT',
  'POST_PERFORMANCE_PRICING',
  'CONTRACT_ESCROW_SECURITY'
);

-- CreateEnum
CREATE TYPE "DesignTheme" AS ENUM (
  'MINIMAL_STARK',
  'EDITORIAL_LUXE',
  'CYBER_TECH',
  'VIBRANT_KINETIC',
  'PASTEL_MINIMAL'
);

-- CreateEnum
CREATE TYPE "InstagramProfessionalAccountType" AS ENUM (
  'PERSONAL',
  'CREATOR',
  'BUSINESS',
  'UNKNOWN'
);

-- CreateEnum
CREATE TYPE "CreatorCoPilotScopeContext" AS ENUM (
  'GLOBAL',
  'COMMAND_CENTER',
  'MEDIA_KIT',
  'ANALYTICS',
  'DEAL_PIPELINE',
  'PAYOUTS'
);

-- CreateEnum
CREATE TYPE "CreatorCoPilotLinkedEntityType" AS ENUM (
  'COLLABORATION',
  'CAMPAIGN_APPLICATION',
  'MEDIA_KIT',
  'DEAL_INVITE',
  'NONE'
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "hashed_password" TEXT;

-- AlterTable
ALTER TABLE "creator_social_integrations"
  ADD COLUMN "professional_account_type" "InstagramProfessionalAccountType",
  ADD COLUMN "media_count_cache" INTEGER;

-- CreateTable
CREATE TABLE "creator_onboarding_tracks" (
    "id" TEXT NOT NULL,
    "instagram_handle" VARCHAR(150) NOT NULL,
    "instagram_meta_id" VARCHAR(100),
    "status" "OnboardingStatus" NOT NULL DEFAULT 'HANDLE_INPUTTED',
    "eligibility_score" INTEGER NOT NULL DEFAULT 0,
    "percentile_rank" DECIMAL(5,2),
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "detected_vertical" "IndustryVertical" NOT NULL DEFAULT 'UNKNOWN',
    "is_existing_user_route" BOOLEAN NOT NULL DEFAULT false,
    "staged_modules" "ActivatedModule"[] DEFAULT ARRAY[]::"ActivatedModule"[],
    "client_ip" VARCHAR(100) NOT NULL,
    "user_agent" TEXT,
    "user_id" TEXT,
    "waitlist_lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_onboarding_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_validation_limits" (
    "client_ip" VARCHAR(100) NOT NULL,
    "validation_count" INTEGER NOT NULL DEFAULT 1,
    "first_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_validation_limits_pkey" PRIMARY KEY ("client_ip")
);

-- CreateTable
CREATE TABLE "email_otp_verifications" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "hashed_otp" VARCHAR(128) NOT NULL,
    "attempts_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otp_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" VARCHAR(150),
    "total_reach_cache" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate_cache" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "top_location_cache" VARCHAR(100),
    "show_total_reach" BOOLEAN NOT NULL DEFAULT true,
    "show_engagement_rate" BOOLEAN NOT NULL DEFAULT true,
    "show_views_metric" BOOLEAN NOT NULL DEFAULT true,
    "show_rates_column" BOOLEAN NOT NULL DEFAULT true,
    "active_theme" "DesignTheme" NOT NULL DEFAULT 'MINIMAL_STARK',
    "ai_generated_tagline" TEXT,
    "custom_bio_override" TEXT,
    "short_form_video_rate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "story_bundle_rate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "past_brand_logos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historic_chat_threads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "thread_title" VARCHAR(255) NOT NULL,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messages_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historic_chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_post_pulses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meta_post_id" VARCHAR(150) NOT NULL,
    "post_type" VARCHAR(50) NOT NULL,
    "media_thumbnail_url" TEXT NOT NULL,
    "caption_content" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "impressions_count" INTEGER NOT NULL DEFAULT 0,
    "saves_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "engagement_delta" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "ai_performance_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_post_pulses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_co_pilot_threads" (
    "id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope_context" "CreatorCoPilotScopeContext" NOT NULL DEFAULT 'COMMAND_CENTER',
    "linked_entity_type" "CreatorCoPilotLinkedEntityType" NOT NULL DEFAULT 'NONE',
    "linked_entity_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_co_pilot_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_co_pilot_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" "CoPilotMessageRole" NOT NULL,
    "text_content" TEXT,
    "payload_json" JSONB,
    "format_type" "CoPilotFormatType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_co_pilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_co_pilot_message_feedback" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" "CoPilotFeedbackRating" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_co_pilot_message_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_co_pilot_slot_sessions" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "intent_workspace_context" TEXT NOT NULL,
    "staged_payload" JSONB NOT NULL,
    "missing_slots" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creator_co_pilot_slot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_co_pilot_interaction_logs" (
    "id" TEXT NOT NULL,
    "creator_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "message_id" TEXT,
    "scope_context" "CreatorCoPilotScopeContext" NOT NULL,
    "intent_key" TEXT,
    "model_id" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "estimated_cost_minor" INTEGER,
    "tools_invoked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CoPilotInteractionStatus" NOT NULL,
    "latency_ms" INTEGER,
    "idempotency_key" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_co_pilot_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creator_onboarding_tracks_instagram_meta_id_key" ON "creator_onboarding_tracks"("instagram_meta_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_onboarding_tracks_user_id_key" ON "creator_onboarding_tracks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "creator_onboarding_tracks_waitlist_lead_id_key" ON "creator_onboarding_tracks"("waitlist_lead_id");

-- CreateIndex
CREATE INDEX "creator_onboarding_tracks_instagram_handle_idx" ON "creator_onboarding_tracks"("instagram_handle");

-- CreateIndex
CREATE INDEX "creator_onboarding_tracks_status_idx" ON "creator_onboarding_tracks"("status");

-- CreateIndex
CREATE INDEX "creator_onboarding_tracks_client_ip_idx" ON "creator_onboarding_tracks"("client_ip");

-- CreateIndex
CREATE INDEX "creator_onboarding_tracks_created_at_idx" ON "creator_onboarding_tracks"("created_at");

-- CreateIndex
CREATE INDEX "email_otp_verifications_email_idx" ON "email_otp_verifications"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "historic_chat_threads_user_id_idx" ON "historic_chat_threads"("user_id");

-- CreateIndex
CREATE INDEX "historic_chat_threads_last_active_at_idx" ON "historic_chat_threads"("last_active_at");

-- CreateIndex
CREATE UNIQUE INDEX "metric_post_pulses_meta_post_id_key" ON "metric_post_pulses"("meta_post_id");

-- CreateIndex
CREATE INDEX "metric_post_pulses_user_id_idx" ON "metric_post_pulses"("user_id");

-- CreateIndex
CREATE INDEX "metric_post_pulses_published_at_idx" ON "metric_post_pulses"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "creator_social_integrations_platform_native_user_key" ON "creator_social_integrations"("platform_network", "native_platform_user_id");

-- CreateIndex
CREATE INDEX "creator_co_pilot_threads_creator_profile_id_last_message_at_idx" ON "creator_co_pilot_threads"("creator_profile_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "creator_co_pilot_threads_creator_profile_id_archived_at_idx" ON "creator_co_pilot_threads"("creator_profile_id", "archived_at");

-- CreateIndex
CREATE INDEX "creator_co_pilot_messages_thread_id_created_at_idx" ON "creator_co_pilot_messages"("thread_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "creator_co_pilot_message_feedback_message_id_key" ON "creator_co_pilot_message_feedback"("message_id");

-- CreateIndex
CREATE INDEX "creator_co_pilot_message_feedback_creator_profile_id_created_at_idx" ON "creator_co_pilot_message_feedback"("creator_profile_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "creator_co_pilot_slot_sessions_thread_id_key" ON "creator_co_pilot_slot_sessions"("thread_id");

-- CreateIndex
CREATE INDEX "creator_co_pilot_interaction_logs_creator_profile_id_created_at_idx" ON "creator_co_pilot_interaction_logs"("creator_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "creator_onboarding_tracks" ADD CONSTRAINT "creator_onboarding_tracks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_onboarding_tracks" ADD CONSTRAINT "creator_onboarding_tracks_waitlist_lead_id_fkey" FOREIGN KEY ("waitlist_lead_id") REFERENCES "waitlist_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historic_chat_threads" ADD CONSTRAINT "historic_chat_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_post_pulses" ADD CONSTRAINT "metric_post_pulses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_threads" ADD CONSTRAINT "creator_co_pilot_threads_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_threads" ADD CONSTRAINT "creator_co_pilot_threads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_messages" ADD CONSTRAINT "creator_co_pilot_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "creator_co_pilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_message_feedback" ADD CONSTRAINT "creator_co_pilot_message_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "creator_co_pilot_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_message_feedback" ADD CONSTRAINT "creator_co_pilot_message_feedback_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "creator_co_pilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_message_feedback" ADD CONSTRAINT "creator_co_pilot_message_feedback_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_message_feedback" ADD CONSTRAINT "creator_co_pilot_message_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_slot_sessions" ADD CONSTRAINT "creator_co_pilot_slot_sessions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "creator_co_pilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_interaction_logs" ADD CONSTRAINT "creator_co_pilot_interaction_logs_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_co_pilot_interaction_logs" ADD CONSTRAINT "creator_co_pilot_interaction_logs_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "creator_co_pilot_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
