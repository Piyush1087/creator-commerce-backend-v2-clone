-- CreateEnum
CREATE TYPE "IntelligenceAuthority" AS ENUM ('OBSERVED', 'CREATOR_SHOP_DERIVED', 'BRAND_CONFIRMED', 'SUPPORT_CONTROLLED', 'SYSTEM_DERIVED');

-- CreateEnum
CREATE TYPE "IntelligenceReadiness" AS ENUM ('READY', 'PARTIAL', 'NOT_READY');

-- CreateEnum
CREATE TYPE "IntelligenceFreshness" AS ENUM ('CURRENT', 'STALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IntelligenceProtectionState" AS ENUM ('UNPROTECTED', 'BRAND_CONFIRMED', 'SUPPORT_CONTROLLED');

-- CreateEnum
CREATE TYPE "IntelligenceExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntelligenceExecutionAggregateResult" AS ENUM ('SUCCEEDED', 'PARTIAL', 'FAILED', 'NO_RESULT');

-- CreateEnum
CREATE TYPE "IntelligenceProcessorExecutionStatus" AS ENUM ('WAITING_FOR_DEPENDENCY', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED_TERMINAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntelligenceProcessorAttemptStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_TERMINAL', 'WAITING_DEPENDENCY', 'LEASE_LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntelligenceProducerKind" AS ENUM ('PROCESSOR_OUTPUT', 'AUTHORIZED_APPLICATION_ACTION', 'SYSTEM_TRANSITION_RESOLUTION', 'MIGRATION_IMPORT');

-- CreateEnum
CREATE TYPE "IntelligenceValueState" AS ENUM ('VALUE', 'EXPLICIT_NULL', 'INTENTIONALLY_ABSENT');

-- CreateEnum
CREATE TYPE "IntelligenceNodeKind" AS ENUM ('SCALAR', 'OBJECT_FIELD', 'COLLECTION', 'SEMANTIC_ITEM', 'NESTED_FIELD');

-- CreateEnum
CREATE TYPE "IntelligenceCurrentComponentLifecycle" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "IntelligenceComponentCandidateStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'OBSOLETE');

-- CreateEnum
CREATE TYPE "IntelligenceBusinessStateRevisionKind" AS ENUM ('EXPLICIT_VERSION', 'UPDATED_AT', 'SNAPSHOT_FINGERPRINT');

-- CreateEnum
CREATE TYPE "IntelligenceActionActorType" AS ENUM ('PROCESSOR', 'BRAND_ACTOR', 'SUPPORT_ACTOR', 'SYSTEM', 'MIGRATION');

-- CreateEnum
CREATE TYPE "IntelligenceComponentTransitionOutcome" AS ENUM ('APPLIED_CURRENT', 'RECORDED_CANDIDATE', 'NOOP_EQUIVALENT', 'REJECTED_CAS', 'REJECTED_PROTECTED', 'REJECTED_VALIDATION', 'MARKED_OBSOLETE');

-- CreateTable
CREATE TABLE "intelligence_executions" (
    "execution_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "trigger_type" VARCHAR(100) NOT NULL,
    "trigger_ref" VARCHAR(255) NOT NULL,
    "trigger_idempotency_key" VARCHAR(255) NOT NULL,
    "correlation_ref" VARCHAR(255) NOT NULL,
    "requested_semantic_impact" JSONB NOT NULL,
    "status" "IntelligenceExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "aggregate_result" "IntelligenceExecutionAggregateResult",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "intelligence_executions_pkey" PRIMARY KEY ("execution_id")
);

-- CreateTable
CREATE TABLE "intelligence_processor_executions" (
    "processor_execution_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "processor_id" VARCHAR(160) NOT NULL,
    "processor_version" VARCHAR(80) NOT NULL,
    "bundle_id" VARCHAR(160) NOT NULL,
    "bundle_version" VARCHAR(80) NOT NULL,
    "bundle_hash" CHAR(64) NOT NULL,
    "output_contract_id" VARCHAR(160) NOT NULL,
    "output_contract_version" VARCHAR(80) NOT NULL,
    "active_scope" JSONB NOT NULL,
    "active_scope_hash" CHAR(64) NOT NULL,
    "dependency_manifest" JSONB NOT NULL,
    "dependency_manifest_hash" CHAR(64) NOT NULL,
    "evidence_manifest" JSONB NOT NULL,
    "evidence_manifest_hash" CHAR(64) NOT NULL,
    "trigger_intent_key" VARCHAR(255) NOT NULL,
    "processor_execution_key" CHAR(64) NOT NULL,
    "max_attempts" INTEGER NOT NULL,
    "status" "IntelligenceProcessorExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "result_readiness" "IntelligenceReadiness",
    "eligible_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "lease_token" TEXT,
    "lease_owner_ref" VARCHAR(255),
    "lease_expires_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3),
    "last_error_category" VARCHAR(100),
    "last_error_code" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_processor_executions_pkey" PRIMARY KEY ("processor_execution_id")
);

-- CreateTable
CREATE TABLE "intelligence_processor_attempts" (
    "attempt_id" TEXT NOT NULL,
    "processor_execution_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "worker_identity_ref" VARCHAR(255) NOT NULL,
    "lease_token" TEXT NOT NULL,
    "lease_acquired_at" TIMESTAMP(3) NOT NULL,
    "lease_expires_at" TIMESTAMP(3) NOT NULL,
    "last_heartbeat_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "status" "IntelligenceProcessorAttemptStatus" NOT NULL DEFAULT 'RUNNING',
    "prompt_build_ref" VARCHAR(255),
    "runtime_telemetry_summary" JSONB,
    "error_category" VARCHAR(100),
    "error_code" VARCHAR(160),

    CONSTRAINT "intelligence_processor_attempts_pkey" PRIMARY KEY ("attempt_id")
);

-- CreateTable
CREATE TABLE "intelligence_actions" (
    "action_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "actor_type" "IntelligenceActionActorType" NOT NULL,
    "actor_ref" VARCHAR(255) NOT NULL,
    "authorization_decision_ref" VARCHAR(255),
    "request_idempotency_key" VARCHAR(255) NOT NULL,
    "correlation_ref" VARCHAR(255) NOT NULL,
    "reason_code" VARCHAR(160) NOT NULL,
    "requested_atomicity" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(80) NOT NULL,
    "processor_execution_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_actions_pkey" PRIMARY KEY ("action_id")
);

-- CreateTable
CREATE TABLE "intelligence_object_generations" (
    "object_generation_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "object_semantic_id" VARCHAR(160) NOT NULL,
    "object_contract_id" VARCHAR(160) NOT NULL,
    "object_contract_version" VARCHAR(80) NOT NULL,
    "output_contract_id" VARCHAR(160),
    "output_contract_version" VARCHAR(80),
    "producer_kind" "IntelligenceProducerKind" NOT NULL,
    "producer_id" VARCHAR(160) NOT NULL,
    "producer_version" VARCHAR(80),
    "bundle_id" VARCHAR(160) NOT NULL,
    "bundle_version" VARCHAR(80) NOT NULL,
    "bundle_hash" CHAR(64) NOT NULL,
    "processor_execution_id" TEXT,
    "successful_attempt_id" TEXT,
    "action_id" TEXT,
    "value_state" "IntelligenceValueState" NOT NULL,
    "value_payload" JSONB,
    "value_hash" CHAR(64) NOT NULL,
    "object_metadata_payload" JSONB NOT NULL,
    "readiness" "IntelligenceReadiness" NOT NULL,
    "freshness_at_generation" "IntelligenceFreshness" NOT NULL,
    "active_scope" JSONB NOT NULL,
    "active_scope_hash" CHAR(64) NOT NULL,
    "based_on_object_generation_id" TEXT,
    "supersedes_object_generation_id" TEXT,
    "generation_ordinal" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_object_generations_pkey" PRIMARY KEY ("object_generation_id")
);

-- CreateTable
CREATE TABLE "intelligence_component_generations" (
    "component_generation_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "object_generation_id" TEXT NOT NULL,
    "object_semantic_id" VARCHAR(160) NOT NULL,
    "path_scheme_version" INTEGER NOT NULL DEFAULT 1,
    "component_semantic_path" TEXT NOT NULL,
    "node_kind" "IntelligenceNodeKind" NOT NULL,
    "component_contract_id" VARCHAR(160) NOT NULL,
    "component_contract_version" VARCHAR(80) NOT NULL,
    "value_state" "IntelligenceValueState" NOT NULL,
    "value_payload" JSONB,
    "value_hash" CHAR(64) NOT NULL,
    "authority" "IntelligenceAuthority" NOT NULL,
    "source_class" VARCHAR(100) NOT NULL,
    "readiness" "IntelligenceReadiness" NOT NULL,
    "freshness_at_generation" "IntelligenceFreshness" NOT NULL,
    "metadata_payload" JSONB NOT NULL,
    "confidence" VARCHAR(40),
    "evidence_strength" VARCHAR(80),
    "presentation_order" INTEGER,
    "supersedes_component_generation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_component_generations_pkey" PRIMARY KEY ("component_generation_id")
);

-- CreateTable
CREATE TABLE "intelligence_current_components" (
    "current_component_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "object_semantic_id" VARCHAR(160) NOT NULL,
    "path_scheme_version" INTEGER NOT NULL DEFAULT 1,
    "component_semantic_path" TEXT NOT NULL,
    "node_kind" "IntelligenceNodeKind" NOT NULL,
    "current_component_generation_id" TEXT NOT NULL,
    "current_contract_id" VARCHAR(160) NOT NULL,
    "current_contract_version" VARCHAR(80) NOT NULL,
    "current_authority" "IntelligenceAuthority" NOT NULL,
    "current_source_class" VARCHAR(100) NOT NULL,
    "current_readiness" "IntelligenceReadiness" NOT NULL,
    "current_freshness" "IntelligenceFreshness" NOT NULL,
    "protection_state" "IntelligenceProtectionState" NOT NULL DEFAULT 'UNPROTECTED',
    "lifecycle_status" "IntelligenceCurrentComponentLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "revision" BIGINT NOT NULL DEFAULT 1,
    "freshness_evaluated_at" TIMESTAMP(3),
    "stale_since" TIMESTAMP(3),
    "stale_reason_code" VARCHAR(160),
    "invalidating_ref" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_current_components_pkey" PRIMARY KEY ("current_component_id")
);

-- CreateTable
CREATE TABLE "intelligence_component_candidates" (
    "component_candidate_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "current_component_id" TEXT NOT NULL,
    "object_semantic_id" VARCHAR(160) NOT NULL,
    "path_scheme_version" INTEGER NOT NULL,
    "component_semantic_path" TEXT NOT NULL,
    "candidate_component_generation_id" TEXT NOT NULL,
    "basis_current_component_generation_id" TEXT NOT NULL,
    "basis_current_revision" BIGINT NOT NULL,
    "candidate_value_hash" CHAR(64) NOT NULL,
    "discrepancy_code" VARCHAR(160) NOT NULL,
    "producer_execution_id" TEXT,
    "producer_action_id" TEXT,
    "status" "IntelligenceComponentCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolution_action_id" TEXT,

    CONSTRAINT "intelligence_component_candidates_pkey" PRIMARY KEY ("component_candidate_id")
);

-- CreateTable
CREATE TABLE "intelligence_evidence_references" (
    "evidence_reference_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "object_generation_id" TEXT NOT NULL,
    "component_semantic_path" TEXT NOT NULL,
    "evidence_ref" VARCHAR(255) NOT NULL,
    "capability_id" VARCHAR(160) NOT NULL,
    "capture_id" VARCHAR(255) NOT NULL,
    "capture_version" VARCHAR(80) NOT NULL,
    "source_class" VARCHAR(100) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "observed_freshness" "IntelligenceFreshness",
    "evidence_manifest_ref" VARCHAR(255),
    "evidence_manifest_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_evidence_references_pkey" PRIMARY KEY ("evidence_reference_id")
);

-- CreateTable
CREATE TABLE "intelligence_business_state_references" (
    "business_state_reference_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "object_generation_id" TEXT NOT NULL,
    "component_semantic_path" TEXT NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "semantic_field_path" VARCHAR(255) NOT NULL,
    "revision_kind" "IntelligenceBusinessStateRevisionKind" NOT NULL,
    "revision_token" VARCHAR(255) NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "canonical_snapshot_ref" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_business_state_references_pkey" PRIMARY KEY ("business_state_reference_id")
);

-- CreateTable
CREATE TABLE "intelligence_component_transitions" (
    "component_transition_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "current_component_id" TEXT,
    "object_semantic_id" VARCHAR(160) NOT NULL,
    "path_scheme_version" INTEGER NOT NULL,
    "component_semantic_path" TEXT NOT NULL,
    "from_generation_id" TEXT,
    "expected_exists" BOOLEAN NOT NULL,
    "expected_revision" BIGINT,
    "expected_generation_id" TEXT,
    "observed_revision" BIGINT,
    "observed_generation_id" TEXT,
    "proposed_generation_id" TEXT,
    "to_generation_id" TEXT,
    "candidate_id" TEXT,
    "transition_type" VARCHAR(100) NOT NULL,
    "outcome" "IntelligenceComponentTransitionOutcome" NOT NULL,
    "reason_code" VARCHAR(160) NOT NULL,
    "resulting_revision" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_component_transitions_pkey" PRIMARY KEY ("component_transition_id")
);

-- CreateIndex
CREATE INDEX "idx_intelligence_execution_brand_created" ON "intelligence_executions"("brand_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_execution_status_created" ON "intelligence_executions"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_execution_correlation" ON "intelligence_executions"("correlation_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_execution_trigger" ON "intelligence_executions"("brand_id", "trigger_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_execution_id_brand" ON "intelligence_executions"("execution_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_execution_key" ON "intelligence_processor_executions"("processor_execution_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_execution_lease_token" ON "intelligence_processor_executions"("lease_token");

-- CreateIndex
CREATE INDEX "idx_intelligence_processor_queue" ON "intelligence_processor_executions"("status", "eligible_at", "lease_expires_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_processor_brand_version" ON "intelligence_processor_executions"("brand_id", "processor_id", "processor_version", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_processor_bundle_hash" ON "intelligence_processor_executions"("bundle_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_execution_scope" ON "intelligence_processor_executions"("execution_id", "processor_id", "active_scope_hash");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_execution_id_brand" ON "intelligence_processor_executions"("processor_execution_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_attempt_lease_token" ON "intelligence_processor_attempts"("lease_token");

-- CreateIndex
CREATE INDEX "idx_intelligence_processor_attempt_lease" ON "intelligence_processor_attempts"("status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_processor_attempt_timeline" ON "intelligence_processor_attempts"("processor_execution_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_attempt_number" ON "intelligence_processor_attempts"("processor_execution_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_attempt_id_brand" ON "intelligence_processor_attempts"("attempt_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_attempt_lineage" ON "intelligence_processor_attempts"("attempt_id", "processor_execution_id", "brand_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_action_brand_timeline" ON "intelligence_actions"("brand_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_action_correlation" ON "intelligence_actions"("correlation_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_action_request" ON "intelligence_actions"("brand_id", "action_type", "request_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_action_id_brand" ON "intelligence_actions"("action_id", "brand_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_object_generation_history" ON "intelligence_object_generations"("brand_id", "object_semantic_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_object_generation_processor" ON "intelligence_object_generations"("processor_execution_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_object_generation_action" ON "intelligence_object_generations"("action_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_id_brand" ON "intelligence_object_generations"("object_generation_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_address" ON "intelligence_object_generations"("object_generation_id", "brand_id", "object_semantic_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_supersedes" ON "intelligence_object_generations"("supersedes_object_generation_id", "brand_id", "object_semantic_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_processor" ON "intelligence_object_generations"("processor_execution_id", "object_semantic_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_action" ON "intelligence_object_generations"("action_id", "object_semantic_id", "generation_ordinal");

-- CreateIndex
CREATE INDEX "idx_intelligence_component_generation_history" ON "intelligence_component_generations"("brand_id", "object_semantic_id", "component_semantic_path", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_component_generation_object" ON "intelligence_component_generations"("object_generation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_generation_path" ON "intelligence_component_generations"("object_generation_id", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_generation_id_brand" ON "intelligence_component_generations"("component_generation_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_generation_address" ON "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_generation_supersedes" ON "intelligence_component_generations"("supersedes_component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_object" ON "intelligence_current_components"("brand_id", "object_semantic_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_path" ON "intelligence_current_components"("brand_id", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_freshness" ON "intelligence_current_components"("brand_id", "current_freshness");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_protection" ON "intelligence_current_components"("brand_id", "protection_state");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_generation" ON "intelligence_current_components"("current_component_generation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_current_component_address" ON "intelligence_current_components"("brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_current_component_id_brand" ON "intelligence_current_components"("current_component_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_current_component_full_address" ON "intelligence_current_components"("current_component_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_candidate_generation" ON "intelligence_component_candidates"("candidate_component_generation_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_candidate_pending" ON "intelligence_component_candidates"("current_component_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_candidate_resolution" ON "intelligence_component_candidates"("resolution_action_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_candidate_id_brand" ON "intelligence_component_candidates"("component_candidate_id", "brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_candidate_full_address" ON "intelligence_component_candidates"("component_candidate_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_evidence_ref" ON "intelligence_evidence_references"("brand_id", "evidence_ref");

-- CreateIndex
CREATE INDEX "idx_intelligence_evidence_capture" ON "intelligence_evidence_references"("capability_id", "capture_id", "capture_version");

-- CreateIndex
CREATE INDEX "idx_intelligence_evidence_object" ON "intelligence_evidence_references"("object_generation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_evidence_lineage" ON "intelligence_evidence_references"("object_generation_id", "component_semantic_path", "evidence_ref", "capability_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_business_state_entity" ON "intelligence_business_state_references"("brand_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_business_state_revision" ON "intelligence_business_state_references"("revision_token");

-- CreateIndex
CREATE INDEX "idx_intelligence_business_state_object" ON "intelligence_business_state_references"("object_generation_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_business_state_lineage" ON "intelligence_business_state_references"("object_generation_id", "component_semantic_path", "entity_type", "entity_id", "semantic_field_path", "revision_token");

-- CreateIndex
CREATE INDEX "idx_intelligence_component_transition_current" ON "intelligence_component_transitions"("current_component_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_intelligence_component_transition_action" ON "intelligence_component_transitions"("action_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_component_transition_outcome" ON "intelligence_component_transitions"("outcome", "reason_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_transition_action_path" ON "intelligence_component_transitions"("action_id", "object_semantic_id", "component_semantic_path");

-- AddForeignKey
ALTER TABLE "intelligence_executions" ADD CONSTRAINT "intelligence_executions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_processor_executions" ADD CONSTRAINT "intelligence_processor_executions_execution_id_brand_id_fkey" FOREIGN KEY ("execution_id", "brand_id") REFERENCES "intelligence_executions"("execution_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_processor_executions" ADD CONSTRAINT "intelligence_processor_executions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_processor_attempts" ADD CONSTRAINT "intelligence_processor_attempts_processor_execution_id_bra_fkey" FOREIGN KEY ("processor_execution_id", "brand_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_processor_attempts" ADD CONSTRAINT "intelligence_processor_attempts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_actions" ADD CONSTRAINT "intelligence_actions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_actions" ADD CONSTRAINT "intelligence_actions_processor_execution_id_brand_id_fkey" FOREIGN KEY ("processor_execution_id", "brand_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_processor_execution_id_bra_fkey" FOREIGN KEY ("processor_execution_id", "brand_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_successful_attempt_id_proc_fkey" FOREIGN KEY ("successful_attempt_id", "processor_execution_id", "brand_id") REFERENCES "intelligence_processor_attempts"("attempt_id", "processor_execution_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_action_id_brand_id_fkey" FOREIGN KEY ("action_id", "brand_id") REFERENCES "intelligence_actions"("action_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_based_on_object_generation_fkey" FOREIGN KEY ("based_on_object_generation_id", "brand_id", "object_semantic_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id", "object_semantic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_supersedes_object_generati_fkey" FOREIGN KEY ("supersedes_object_generation_id", "brand_id", "object_semantic_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id", "object_semantic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_generations" ADD CONSTRAINT "intelligence_component_generations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_generations" ADD CONSTRAINT "intelligence_component_generations_object_generation_id_br_fkey" FOREIGN KEY ("object_generation_id", "brand_id", "object_semantic_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id", "object_semantic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_generations" ADD CONSTRAINT "intelligence_component_generations_supersedes_component_ge_fkey" FOREIGN KEY ("supersedes_component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_current_components" ADD CONSTRAINT "intelligence_current_components_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_current_components" ADD CONSTRAINT "intelligence_current_components_current_component_generati_fkey" FOREIGN KEY ("current_component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_current_component_id_bra_fkey" FOREIGN KEY ("current_component_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_current_components"("current_component_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_candidate_component_gene_fkey" FOREIGN KEY ("candidate_component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_basis_current_component__fkey" FOREIGN KEY ("basis_current_component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_producer_execution_id_br_fkey" FOREIGN KEY ("producer_execution_id", "brand_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_producer_action_id_brand_fkey" FOREIGN KEY ("producer_action_id", "brand_id") REFERENCES "intelligence_actions"("action_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_resolution_action_id_bra_fkey" FOREIGN KEY ("resolution_action_id", "brand_id") REFERENCES "intelligence_actions"("action_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_evidence_references" ADD CONSTRAINT "intelligence_evidence_references_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_evidence_references" ADD CONSTRAINT "intelligence_evidence_references_object_generation_id_bran_fkey" FOREIGN KEY ("object_generation_id", "brand_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_business_state_references" ADD CONSTRAINT "intelligence_business_state_references_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_business_state_references" ADD CONSTRAINT "intelligence_business_state_references_object_generation_i_fkey" FOREIGN KEY ("object_generation_id", "brand_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_action_id_brand_id_fkey" FOREIGN KEY ("action_id", "brand_id") REFERENCES "intelligence_actions"("action_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_current_component_id_br_fkey" FOREIGN KEY ("current_component_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_current_components"("current_component_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_from_generation_id_bran_fkey" FOREIGN KEY ("from_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_expected_generation_id__fkey" FOREIGN KEY ("expected_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_observed_generation_id__fkey" FOREIGN KEY ("observed_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_proposed_generation_id__fkey" FOREIGN KEY ("proposed_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_to_generation_id_brand__fkey" FOREIGN KEY ("to_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_candidate_id_brand_id_o_fkey" FOREIGN KEY ("candidate_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_candidates"("component_candidate_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- W1.0A invariants that Prisma cannot express directly.
ALTER TABLE "intelligence_processor_executions"
  ADD CONSTRAINT "ck_intelligence_processor_attempt_bounds"
    CHECK ("max_attempts" > 0 AND "attempt_count" >= 0 AND "attempt_count" <= "max_attempts"),
  ADD CONSTRAINT "ck_intelligence_processor_lease_coherence"
    CHECK (
      ("lease_token" IS NULL AND "lease_owner_ref" IS NULL AND "lease_expires_at" IS NULL AND "last_heartbeat_at" IS NULL)
      OR
      ("lease_token" IS NOT NULL AND "lease_owner_ref" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
    ),
  ADD CONSTRAINT "ck_intelligence_processor_running_lease"
    CHECK ("status" <> 'RUNNING' OR "lease_token" IS NOT NULL),
  ADD CONSTRAINT "ck_intelligence_processor_result_readiness"
    CHECK (("status" = 'COMPLETED') = ("result_readiness" IS NOT NULL)),
  ADD CONSTRAINT "ck_intelligence_processor_hashes"
    CHECK (
      "bundle_hash" ~ '^[0-9a-f]{64}$'
      AND "active_scope_hash" ~ '^[0-9a-f]{64}$'
      AND "dependency_manifest_hash" ~ '^[0-9a-f]{64}$'
      AND "evidence_manifest_hash" ~ '^[0-9a-f]{64}$'
      AND "processor_execution_key" ~ '^[0-9a-f]{64}$'
    );

ALTER TABLE "intelligence_processor_attempts"
  ADD CONSTRAINT "ck_intelligence_attempt_number_positive"
    CHECK ("attempt_number" > 0),
  ADD CONSTRAINT "ck_intelligence_attempt_lease_window"
    CHECK ("lease_expires_at" > "lease_acquired_at"),
  ADD CONSTRAINT "ck_intelligence_attempt_completion"
    CHECK (
      ("status" = 'RUNNING' AND "completed_at" IS NULL)
      OR
      ("status" <> 'RUNNING' AND "completed_at" IS NOT NULL)
    );

ALTER TABLE "intelligence_actions"
  ADD CONSTRAINT "ck_intelligence_action_authorization"
    CHECK (
      "actor_type" NOT IN ('BRAND_ACTOR', 'SUPPORT_ACTOR')
      OR "authorization_decision_ref" IS NOT NULL
    );

ALTER TABLE "intelligence_object_generations"
  ADD CONSTRAINT "ck_intelligence_object_generation_ordinal"
    CHECK ("generation_ordinal" > 0),
  ADD CONSTRAINT "ck_intelligence_object_generation_hashes"
    CHECK (
      "bundle_hash" ~ '^[0-9a-f]{64}$'
      AND "value_hash" ~ '^[0-9a-f]{64}$'
      AND "active_scope_hash" ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT "ck_intelligence_object_generation_value_state"
    CHECK (
      ("value_state" = 'VALUE' AND "value_payload" IS NOT NULL AND "value_payload" <> 'null'::jsonb)
      OR ("value_state" = 'EXPLICIT_NULL' AND "value_payload" IS NOT NULL AND "value_payload" = 'null'::jsonb)
      OR ("value_state" = 'INTENTIONALLY_ABSENT' AND "value_payload" IS NULL)
    ),
  ADD CONSTRAINT "ck_intelligence_object_generation_output_contract"
    CHECK (("output_contract_id" IS NULL) = ("output_contract_version" IS NULL)),
  ADD CONSTRAINT "ck_intelligence_object_generation_producer"
    CHECK (
      (
        "producer_kind" = 'PROCESSOR_OUTPUT'
        AND "processor_execution_id" IS NOT NULL
        AND "successful_attempt_id" IS NOT NULL
        AND "action_id" IS NULL
        AND "output_contract_id" IS NOT NULL
        AND "producer_version" IS NOT NULL
      )
      OR
      (
        "producer_kind" IN ('AUTHORIZED_APPLICATION_ACTION', 'SYSTEM_TRANSITION_RESOLUTION', 'MIGRATION_IMPORT')
        AND "processor_execution_id" IS NULL
        AND "successful_attempt_id" IS NULL
        AND "action_id" IS NOT NULL
      )
    ),
  ADD CONSTRAINT "ck_intelligence_object_generation_lineage"
    CHECK (
      "based_on_object_generation_id" IS DISTINCT FROM "object_generation_id"
      AND "supersedes_object_generation_id" IS DISTINCT FROM "object_generation_id"
    );

ALTER TABLE "intelligence_component_generations"
  ADD CONSTRAINT "ck_intelligence_component_path_scheme"
    CHECK ("path_scheme_version" > 0 AND "component_semantic_path" ~ '^\$(/(f|i)/[^/]+)*$'),
  ADD CONSTRAINT "ck_intelligence_component_generation_hash"
    CHECK ("value_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_intelligence_component_generation_value_state"
    CHECK (
      ("value_state" = 'VALUE' AND "value_payload" IS NOT NULL AND "value_payload" <> 'null'::jsonb)
      OR ("value_state" = 'EXPLICIT_NULL' AND "value_payload" IS NOT NULL AND "value_payload" = 'null'::jsonb)
      OR ("value_state" = 'INTENTIONALLY_ABSENT' AND "value_payload" IS NULL)
    ),
  ADD CONSTRAINT "ck_intelligence_component_presentation_order"
    CHECK ("presentation_order" IS NULL OR "presentation_order" >= 0),
  ADD CONSTRAINT "ck_intelligence_component_generation_lineage"
    CHECK ("supersedes_component_generation_id" IS DISTINCT FROM "component_generation_id");

ALTER TABLE "intelligence_current_components"
  ADD CONSTRAINT "ck_intelligence_current_path_scheme"
    CHECK ("path_scheme_version" > 0 AND "component_semantic_path" ~ '^\$(/(f|i)/[^/]+)*$'),
  ADD CONSTRAINT "ck_intelligence_current_revision"
    CHECK ("revision" > 0),
  ADD CONSTRAINT "ck_intelligence_current_protection"
    CHECK (
      ("current_authority" = 'BRAND_CONFIRMED' AND "protection_state" = 'BRAND_CONFIRMED')
      OR ("current_authority" = 'SUPPORT_CONTROLLED' AND "protection_state" = 'SUPPORT_CONTROLLED')
      OR ("current_authority" NOT IN ('BRAND_CONFIRMED', 'SUPPORT_CONTROLLED') AND "protection_state" = 'UNPROTECTED')
    ),
  ADD CONSTRAINT "ck_intelligence_current_stale_detail"
    CHECK (
      "current_freshness" = 'STALE'
      OR ("stale_since" IS NULL AND "stale_reason_code" IS NULL AND "invalidating_ref" IS NULL)
    );

ALTER TABLE "intelligence_component_candidates"
  ADD CONSTRAINT "ck_intelligence_candidate_path_scheme"
    CHECK ("path_scheme_version" > 0 AND "component_semantic_path" ~ '^\$(/(f|i)/[^/]+)*$'),
  ADD CONSTRAINT "ck_intelligence_candidate_basis_revision"
    CHECK ("basis_current_revision" > 0),
  ADD CONSTRAINT "ck_intelligence_candidate_hash"
    CHECK ("candidate_value_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_intelligence_candidate_distinct_generation"
    CHECK ("candidate_component_generation_id" <> "basis_current_component_generation_id"),
  ADD CONSTRAINT "ck_intelligence_candidate_producer"
    CHECK (num_nonnulls("producer_execution_id", "producer_action_id") = 1),
  ADD CONSTRAINT "ck_intelligence_candidate_resolution"
    CHECK (
      ("status" = 'PENDING' AND "resolved_at" IS NULL AND "resolution_action_id" IS NULL)
      OR
      ("status" <> 'PENDING' AND "resolved_at" IS NOT NULL AND "resolution_action_id" IS NOT NULL)
    );

CREATE UNIQUE INDEX "uq_intelligence_candidate_pending_basis_value"
  ON "intelligence_component_candidates" (
    "current_component_id",
    "basis_current_component_generation_id",
    "candidate_value_hash"
  )
  WHERE "status" = 'PENDING';

ALTER TABLE "intelligence_evidence_references"
  ADD CONSTRAINT "ck_intelligence_evidence_path"
    CHECK ("component_semantic_path" ~ '^\$(/(f|i)/[^/]+)*$'),
  ADD CONSTRAINT "ck_intelligence_evidence_manifest_hash"
    CHECK ("evidence_manifest_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "intelligence_business_state_references"
  ADD CONSTRAINT "ck_intelligence_business_state_path"
    CHECK ("component_semantic_path" ~ '^\$(/(f|i)/[^/]+)*$');

ALTER TABLE "intelligence_component_transitions"
  ADD CONSTRAINT "ck_intelligence_transition_path_scheme"
    CHECK ("path_scheme_version" > 0 AND "component_semantic_path" ~ '^\$(/(f|i)/[^/]+)*$'),
  ADD CONSTRAINT "ck_intelligence_transition_expected"
    CHECK (
      ("expected_exists" AND "expected_revision" IS NOT NULL AND "expected_generation_id" IS NOT NULL)
      OR
      (NOT "expected_exists" AND "expected_revision" IS NULL AND "expected_generation_id" IS NULL)
    ),
  ADD CONSTRAINT "ck_intelligence_transition_revisions"
    CHECK (
      ("expected_revision" IS NULL OR "expected_revision" > 0)
      AND ("observed_revision" IS NULL OR "observed_revision" > 0)
      AND ("resulting_revision" IS NULL OR "resulting_revision" > 0)
    ),
  ADD CONSTRAINT "ck_intelligence_transition_outcome_refs"
    CHECK (
      ("outcome" <> 'APPLIED_CURRENT' OR ("to_generation_id" IS NOT NULL AND "resulting_revision" IS NOT NULL))
      AND ("outcome" <> 'RECORDED_CANDIDATE' OR "candidate_id" IS NOT NULL)
    );

COMMENT ON TABLE "intelligence_object_generations" IS 'W1.0A permanent history: insert-only through future application repositories; privacy purge requires separate authorization.';
COMMENT ON TABLE "intelligence_component_generations" IS 'W1.0A permanent history: insert-only through future application repositories; privacy purge requires separate authorization.';
COMMENT ON TABLE "intelligence_evidence_references" IS 'Reference-only Evidence lineage owned semantically by Data Extraction; no raw/provider payload.';
COMMENT ON TABLE "intelligence_business_state_references" IS 'Reference-only canonical business-state lineage; no copied canonical values.';
COMMENT ON TABLE "intelligence_actions" IS 'W1.0A immutable audit envelope; no ordinary update/delete path.';
COMMENT ON TABLE "intelligence_component_transitions" IS 'W1.0A immutable component transition audit; no ordinary update/delete path.';
