-- CreateEnum
CREATE TYPE "CoPilotScopeContext" AS ENUM ('GLOBAL', 'BRAND_CENTRE', 'ANALYTICS', 'ESCROW');

-- CreateEnum
CREATE TYPE "CoPilotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CoPilotFormatType" AS ENUM ('CONVERSATIONAL_NARRATIVE', 'METRIC_HIGHLIGHT_GRID', 'TABULAR_AUDIT_DATA', 'POLYMORPHIC_ENTITY_CAROUSEL', 'INTERACTIVE_EXECUTION_WIDGET', 'SLOT_FILLING_CLARIFICATION');

-- CreateEnum
CREATE TYPE "CoPilotInteractionStatus" AS ENUM ('SUCCESS', 'QUOTA_DENIED', 'MODERATION_BLOCKED', 'VALIDATION_ERROR', 'ERROR');

-- CreateEnum
CREATE TYPE "CoPilotLinkedEntityType" AS ENUM ('CAMPAIGN', 'COLLABORATION', 'PLANNER_CARD', 'NONE');

-- CreateTable
CREATE TABLE "co_pilot_threads" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope_context" "CoPilotScopeContext" NOT NULL DEFAULT 'BRAND_CENTRE',
    "linked_entity_type" "CoPilotLinkedEntityType" NOT NULL DEFAULT 'NONE',
    "linked_entity_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "co_pilot_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_pilot_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" "CoPilotMessageRole" NOT NULL,
    "text_content" TEXT,
    "payload_json" JSONB,
    "format_type" "CoPilotFormatType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "co_pilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_pilot_slot_sessions" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "intent_workspace_context" TEXT NOT NULL,
    "staged_payload" JSONB NOT NULL,
    "missing_slots" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "co_pilot_slot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "co_pilot_interaction_logs" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "message_id" TEXT,
    "scope_context" "CoPilotScopeContext" NOT NULL,
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

    CONSTRAINT "co_pilot_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "co_pilot_threads_brand_profile_id_last_message_at_idx" ON "co_pilot_threads"("brand_profile_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "co_pilot_threads_brand_profile_id_archived_at_idx" ON "co_pilot_threads"("brand_profile_id", "archived_at");

-- CreateIndex
CREATE INDEX "co_pilot_messages_thread_id_created_at_idx" ON "co_pilot_messages"("thread_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "co_pilot_slot_sessions_thread_id_key" ON "co_pilot_slot_sessions"("thread_id");

-- CreateIndex
CREATE INDEX "co_pilot_interaction_logs_brand_profile_id_created_at_idx" ON "co_pilot_interaction_logs"("brand_profile_id", "created_at");

-- AddForeignKey
ALTER TABLE "co_pilot_threads" ADD CONSTRAINT "co_pilot_threads_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_threads" ADD CONSTRAINT "co_pilot_threads_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_messages" ADD CONSTRAINT "co_pilot_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "co_pilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_slot_sessions" ADD CONSTRAINT "co_pilot_slot_sessions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "co_pilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_interaction_logs" ADD CONSTRAINT "co_pilot_interaction_logs_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "co_pilot_interaction_logs" ADD CONSTRAINT "co_pilot_interaction_logs_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "co_pilot_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
