-- CreateEnum
CREATE TYPE "DataExtractionSourceClass" AS ENUM ('OWNED_WEBSITE');

-- CreateEnum
CREATE TYPE "DataExtractionResourceType" AS ENUM ('OWNED_WEB_PAGE', 'OWNED_WEB_FRAGMENT');

-- CreateEnum
CREATE TYPE "DataExtractionPageRole" AS ENUM ('HOMEPAGE', 'ABOUT_COMPANY', 'BRAND_STORY', 'MISSION_VALUES', 'COMPANY_OVERVIEW', 'PORTFOLIO_OVERVIEW', 'CATEGORY_OVERVIEW', 'SERVICE_OVERVIEW', 'SOLUTIONS_OVERVIEW', 'PRICING_PLANS', 'OFFERING_DETAIL', 'CAMPAIGN_LANDING', 'POLICY', 'LEGAL', 'TESTIMONIAL', 'SUPPORT', 'FAQ_HELP', 'LOCALIZED_VARIANT', 'OTHER');

-- CreateEnum
CREATE TYPE "DataExtractionAcquisitionQuality" AS ENUM ('COMPLETE', 'PARTIAL', 'DEGRADED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DataExtractionCaptureStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DataExtractionContentArtifactKind" AS ENUM ('ACQUIRED_SOURCE_BODY', 'NORMALIZED_TEXT', 'STRUCTURED_SOURCE_FRAGMENT');

-- CreateEnum
CREATE TYPE "DataExtractionCapabilityAvailability" AS ENUM ('AVAILABLE', 'PARTIAL', 'DEGRADED', 'UNAVAILABLE', 'NOT_REQUESTED');

-- CreateEnum
CREATE TYPE "DataExtractionRetryability" AS ENUM ('RETRYABLE', 'NON_RETRYABLE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "DataExtractionCoverage" AS ENUM ('SINGLE_RESOURCE', 'MULTI_RESOURCE_PARTIAL', 'MULTI_RESOURCE_BROAD', 'SITE_WIDE_BOUNDED');

-- CreateEnum
CREATE TYPE "DataExtractionRepresentativeness" AS ENUM ('PERSISTENT_BRAND_LEVEL', 'REPEATED_REPRESENTATIVE', 'CONTEXT_SPECIFIC', 'OFFERING_SPECIFIC', 'INCIDENTAL');

-- CreateEnum
CREATE TYPE "DataExtractionPolarity" AS ENUM ('AFFIRMATIVE', 'EXPLICIT_NEGATIVE', 'RESTRICTION', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "DataExtractionFreshness" AS ENUM ('CURRENT', 'POSSIBLY_STALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DataExtractionFreshnessIntent" AS ENUM ('REUSE_ALLOWED', 'REFRESH_IF_NOT_CURRENT', 'FORCE_RECAPTURE');

-- CreateEnum
CREATE TYPE "DataExtractionFreshnessTargetType" AS ENUM ('RESOURCE', 'CAPTURE', 'EVIDENCE');

-- CreateEnum
CREATE TYPE "DataExtractionSemanticObservationRelationType" AS ENUM ('EQUIVALENT_TO', 'CONFLICTS_WITH');

-- CreateTable
CREATE TABLE "data_extraction_resources" (
    "id" TEXT NOT NULL,
    "resource_ref" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "source_class" "DataExtractionSourceClass" NOT NULL DEFAULT 'OWNED_WEBSITE',
    "resource_type" "DataExtractionResourceType" NOT NULL,
    "page_role" "DataExtractionPageRole",
    "canonical_resource_key" TEXT NOT NULL,
    "canonical_resource_key_hash" VARCHAR(64) NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_captures" (
    "id" TEXT NOT NULL,
    "capture_ref" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "resource_ref" TEXT NOT NULL,
    "capability_execution_ref" TEXT,
    "acquisition_request_key" VARCHAR(255) NOT NULL,
    "status" "DataExtractionCaptureStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL,
    "captured_at" TIMESTAMP(3),
    "observed_at" TIMESTAMP(3),
    "source_revision_ref" VARCHAR(255),
    "source_content_hash" VARCHAR(128),
    "acquisition_quality" "DataExtractionAcquisitionQuality" NOT NULL,
    "quality_failure_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quality_detail_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_content_artifacts" (
    "id" TEXT NOT NULL,
    "content_artifact_ref" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "capture_ref" TEXT NOT NULL,
    "kind" "DataExtractionContentArtifactKind" NOT NULL,
    "media_type" VARCHAR(255) NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "inline_content" TEXT,
    "object_store_ref" TEXT,
    "normalization_contract_version" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_content_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_capability_executions" (
    "id" TEXT NOT NULL,
    "capability_execution_ref" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "normalization_contract_version" VARCHAR(100) NOT NULL,
    "resource_scope_hash" VARCHAR(128) NOT NULL,
    "freshness_intent" "DataExtractionFreshnessIntent" NOT NULL,
    "source_revision_ref" VARCHAR(255),
    "request_key" VARCHAR(255) NOT NULL,
    "availability" "DataExtractionCapabilityAvailability" NOT NULL,
    "retryability" "DataExtractionRetryability" NOT NULL,
    "reason_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverage" "DataExtractionCoverage" NOT NULL,
    "acquisition_quality" "DataExtractionAcquisitionQuality" NOT NULL,
    "quality_failure_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quality_detail_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "data_extraction_capability_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_capability_resources" (
    "brand_id" TEXT NOT NULL,
    "capability_execution_ref" TEXT NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "resource_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_capability_resources_pkey" PRIMARY KEY ("brand_id","capability_execution_ref","resource_ref")
);

-- CreateTable
CREATE TABLE "data_extraction_evidence_items" (
    "id" TEXT NOT NULL,
    "evidence_ref" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "normalization_contract_version" VARCHAR(100) NOT NULL,
    "resource_ref" TEXT NOT NULL,
    "capture_ref" TEXT NOT NULL,
    "content_artifact_ref" TEXT,
    "bounded_payload" JSONB,
    "content_hash" VARCHAR(128) NOT NULL,
    "polarity" "DataExtractionPolarity",
    "representativeness" "DataExtractionRepresentativeness" NOT NULL,
    "coverage_snapshot" "DataExtractionCoverage" NOT NULL,
    "freshness_at_emission" "DataExtractionFreshness" NOT NULL,
    "freshness_basis" TEXT NOT NULL,
    "freshness_evaluated_at" TIMESTAMP(3) NOT NULL,
    "freshness_prior_capture_ref" TEXT,
    "freshness_source_revision_ref" VARCHAR(255),
    "quality_snapshot" "DataExtractionAcquisitionQuality" NOT NULL,
    "quality_failure_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quality_detail_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "item_fingerprint" VARCHAR(128) NOT NULL,
    "semantic_observation_key" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_capability_evidence" (
    "brand_id" TEXT NOT NULL,
    "capability_execution_ref" TEXT NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "evidence_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_capability_evidence_pkey" PRIMARY KEY ("brand_id","capability_execution_ref","evidence_ref")
);

-- CreateTable
CREATE TABLE "data_extraction_semantic_observations" (
    "id" TEXT NOT NULL,
    "semantic_observation_key" VARCHAR(255) NOT NULL,
    "brand_id" TEXT NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "repetition_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_semantic_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_observation_support" (
    "brand_id" TEXT NOT NULL,
    "semantic_observation_key" VARCHAR(255) NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "evidence_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_observation_support_pkey" PRIMARY KEY ("brand_id","semantic_observation_key","evidence_ref")
);

-- CreateTable
CREATE TABLE "data_extraction_observation_relations" (
    "brand_id" TEXT NOT NULL,
    "source_observation_key" VARCHAR(255) NOT NULL,
    "target_observation_key" VARCHAR(255) NOT NULL,
    "capability_id" VARCHAR(100) NOT NULL,
    "relation_type" "DataExtractionSemanticObservationRelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_observation_relations_pkey" PRIMARY KEY ("brand_id","source_observation_key","target_observation_key","relation_type")
);

-- CreateTable
CREATE TABLE "data_extraction_freshness_assessments" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "target_type" "DataExtractionFreshnessTargetType" NOT NULL,
    "target_ref" VARCHAR(255) NOT NULL,
    "state" "DataExtractionFreshness" NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "basis" TEXT NOT NULL,
    "prior_capture_ref" TEXT,
    "source_revision_ref" VARCHAR(255),
    "invalidating_ref" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_freshness_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_extraction_provider_execution_links" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "capture_ref" TEXT,
    "capability_execution_ref" TEXT,
    "provider_execution_ref" VARCHAR(255) NOT NULL,
    "attempt_role" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_extraction_provider_execution_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_extraction_resources_resource_ref_key" ON "data_extraction_resources"("resource_ref");

-- CreateIndex
CREATE INDEX "idx_de_resource_brand_ref" ON "data_extraction_resources"("brand_id", "resource_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_resource_brand_ref" ON "data_extraction_resources"("brand_id", "resource_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_resource_identity" ON "data_extraction_resources"("brand_id", "source_class", "canonical_resource_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "data_extraction_captures_capture_ref_key" ON "data_extraction_captures"("capture_ref");

-- CreateIndex
CREATE INDEX "idx_de_capture_resource_time" ON "data_extraction_captures"("resource_ref", "captured_at");

-- CreateIndex
CREATE INDEX "idx_de_capture_brand_ref" ON "data_extraction_captures"("brand_id", "capture_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_capture_brand_ref" ON "data_extraction_captures"("brand_id", "capture_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_capture_brand_ref_resource" ON "data_extraction_captures"("brand_id", "capture_ref", "resource_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_capture_request" ON "data_extraction_captures"("brand_id", "acquisition_request_key");

-- CreateIndex
CREATE UNIQUE INDEX "data_extraction_content_artifacts_content_artifact_ref_key" ON "data_extraction_content_artifacts"("content_artifact_ref");

-- CreateIndex
CREATE INDEX "idx_de_content_capture" ON "data_extraction_content_artifacts"("brand_id", "capture_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_content_brand_ref" ON "data_extraction_content_artifacts"("brand_id", "content_artifact_ref");

-- CreateIndex
CREATE UNIQUE INDEX "data_extraction_capability_executions_capability_execution__key" ON "data_extraction_capability_executions"("capability_execution_ref");

-- CreateIndex
CREATE INDEX "idx_de_capexec_brand_capability" ON "data_extraction_capability_executions"("brand_id", "capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_capexec_brand_ref" ON "data_extraction_capability_executions"("brand_id", "capability_execution_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_capexec_brand_ref_capability" ON "data_extraction_capability_executions"("brand_id", "capability_execution_ref", "capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_capexec_request" ON "data_extraction_capability_executions"("brand_id", "request_key");

-- CreateIndex
CREATE INDEX "idx_de_capresource_brand_resource" ON "data_extraction_capability_resources"("brand_id", "resource_ref");

-- CreateIndex
CREATE UNIQUE INDEX "data_extraction_evidence_items_evidence_ref_key" ON "data_extraction_evidence_items"("evidence_ref");

-- CreateIndex
CREATE INDEX "idx_de_evidence_brand_capability" ON "data_extraction_evidence_items"("brand_id", "capability_id");

-- CreateIndex
CREATE INDEX "idx_de_evidence_brand_ref" ON "data_extraction_evidence_items"("brand_id", "evidence_ref");

-- CreateIndex
CREATE INDEX "idx_de_evidence_capture_ref" ON "data_extraction_evidence_items"("capture_ref");

-- CreateIndex
CREATE INDEX "idx_de_evidence_observation_key" ON "data_extraction_evidence_items"("semantic_observation_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_evidence_brand_ref" ON "data_extraction_evidence_items"("brand_id", "evidence_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_evidence_brand_ref_capability" ON "data_extraction_evidence_items"("brand_id", "evidence_ref", "capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_evidence_idempotency" ON "data_extraction_evidence_items"("brand_id", "capture_ref", "capability_id", "normalization_contract_version", "item_fingerprint");

-- CreateIndex
CREATE INDEX "idx_de_capevidence_evidence_ref" ON "data_extraction_capability_evidence"("evidence_ref");

-- CreateIndex
CREATE INDEX "idx_de_observation_brand_capability" ON "data_extraction_semantic_observations"("brand_id", "capability_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_observation_brand_key" ON "data_extraction_semantic_observations"("brand_id", "semantic_observation_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_de_observation_brand_key_capability" ON "data_extraction_semantic_observations"("brand_id", "semantic_observation_key", "capability_id");

-- CreateIndex
CREATE INDEX "idx_de_observation_relation_capability" ON "data_extraction_observation_relations"("brand_id", "capability_id");

-- CreateIndex
CREATE INDEX "idx_de_freshness_target" ON "data_extraction_freshness_assessments"("brand_id", "target_type", "target_ref", "evaluated_at");

-- CreateIndex
CREATE INDEX "idx_de_provider_link_provider_ref" ON "data_extraction_provider_execution_links"("brand_id", "provider_execution_ref");

-- CreateIndex
CREATE INDEX "idx_de_provider_link_capture_ref" ON "data_extraction_provider_execution_links"("capture_ref");

-- CreateIndex
CREATE INDEX "idx_de_provider_link_capexec_ref" ON "data_extraction_provider_execution_links"("capability_execution_ref");

-- AddForeignKey
ALTER TABLE "data_extraction_resources" ADD CONSTRAINT "data_extraction_resources_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_captures" ADD CONSTRAINT "data_extraction_captures_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_captures" ADD CONSTRAINT "data_extraction_captures_brand_id_resource_ref_fkey" FOREIGN KEY ("brand_id", "resource_ref") REFERENCES "data_extraction_resources"("brand_id", "resource_ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_captures" ADD CONSTRAINT "data_extraction_captures_brand_id_capability_execution_ref_fkey" FOREIGN KEY ("brand_id", "capability_execution_ref") REFERENCES "data_extraction_capability_executions"("brand_id", "capability_execution_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_content_artifacts" ADD CONSTRAINT "data_extraction_content_artifacts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_content_artifacts" ADD CONSTRAINT "data_extraction_content_artifacts_brand_id_capture_ref_fkey" FOREIGN KEY ("brand_id", "capture_ref") REFERENCES "data_extraction_captures"("brand_id", "capture_ref") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_capability_executions" ADD CONSTRAINT "data_extraction_capability_executions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_capability_resources" ADD CONSTRAINT "data_extraction_capability_resources_brand_id_capability_e_fkey" FOREIGN KEY ("brand_id", "capability_execution_ref", "capability_id") REFERENCES "data_extraction_capability_executions"("brand_id", "capability_execution_ref", "capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_capability_resources" ADD CONSTRAINT "data_extraction_capability_resources_brand_id_resource_ref_fkey" FOREIGN KEY ("brand_id", "resource_ref") REFERENCES "data_extraction_resources"("brand_id", "resource_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_evidence_items" ADD CONSTRAINT "data_extraction_evidence_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_evidence_items" ADD CONSTRAINT "data_extraction_evidence_items_brand_id_resource_ref_fkey" FOREIGN KEY ("brand_id", "resource_ref") REFERENCES "data_extraction_resources"("brand_id", "resource_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_evidence_items" ADD CONSTRAINT "data_extraction_evidence_items_brand_id_capture_ref_resour_fkey" FOREIGN KEY ("brand_id", "capture_ref", "resource_ref") REFERENCES "data_extraction_captures"("brand_id", "capture_ref", "resource_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_evidence_items" ADD CONSTRAINT "data_extraction_evidence_items_brand_id_content_artifact_r_fkey" FOREIGN KEY ("brand_id", "content_artifact_ref") REFERENCES "data_extraction_content_artifacts"("brand_id", "content_artifact_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_capability_evidence" ADD CONSTRAINT "data_extraction_capability_evidence_brand_id_capability_ex_fkey" FOREIGN KEY ("brand_id", "capability_execution_ref", "capability_id") REFERENCES "data_extraction_capability_executions"("brand_id", "capability_execution_ref", "capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_capability_evidence" ADD CONSTRAINT "data_extraction_capability_evidence_brand_id_evidence_ref__fkey" FOREIGN KEY ("brand_id", "evidence_ref", "capability_id") REFERENCES "data_extraction_evidence_items"("brand_id", "evidence_ref", "capability_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_semantic_observations" ADD CONSTRAINT "data_extraction_semantic_observations_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_observation_support" ADD CONSTRAINT "data_extraction_observation_support_brand_id_semantic_obse_fkey" FOREIGN KEY ("brand_id", "semantic_observation_key", "capability_id") REFERENCES "data_extraction_semantic_observations"("brand_id", "semantic_observation_key", "capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_observation_support" ADD CONSTRAINT "data_extraction_observation_support_brand_id_evidence_ref__fkey" FOREIGN KEY ("brand_id", "evidence_ref", "capability_id") REFERENCES "data_extraction_evidence_items"("brand_id", "evidence_ref", "capability_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_observation_relations" ADD CONSTRAINT "data_extraction_observation_relations_brand_id_source_obse_fkey" FOREIGN KEY ("brand_id", "source_observation_key", "capability_id") REFERENCES "data_extraction_semantic_observations"("brand_id", "semantic_observation_key", "capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_observation_relations" ADD CONSTRAINT "data_extraction_observation_relations_brand_id_target_obse_fkey" FOREIGN KEY ("brand_id", "target_observation_key", "capability_id") REFERENCES "data_extraction_semantic_observations"("brand_id", "semantic_observation_key", "capability_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_freshness_assessments" ADD CONSTRAINT "data_extraction_freshness_assessments_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_freshness_assessments" ADD CONSTRAINT "data_extraction_freshness_assessments_brand_id_prior_captu_fkey" FOREIGN KEY ("brand_id", "prior_capture_ref") REFERENCES "data_extraction_captures"("brand_id", "capture_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_provider_execution_links" ADD CONSTRAINT "data_extraction_provider_execution_links_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_provider_execution_links" ADD CONSTRAINT "data_extraction_provider_execution_links_brand_id_capture__fkey" FOREIGN KEY ("brand_id", "capture_ref") REFERENCES "data_extraction_captures"("brand_id", "capture_ref") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_extraction_provider_execution_links" ADD CONSTRAINT "data_extraction_provider_execution_links_brand_id_capabili_fkey" FOREIGN KEY ("brand_id", "capability_execution_ref") REFERENCES "data_extraction_capability_executions"("brand_id", "capability_execution_ref") ON DELETE RESTRICT ON UPDATE CASCADE;


-- DE-W1.0B bounded database invariants that Prisma cannot model directly.
ALTER TABLE "data_extraction_content_artifacts"
  ADD CONSTRAINT "ck_de_content_storage_shape"
  CHECK ("inline_content" IS NOT NULL OR "object_store_ref" IS NOT NULL),
  ADD CONSTRAINT "ck_de_content_byte_length_nonnegative"
  CHECK ("byte_length" >= 0);

ALTER TABLE "data_extraction_provider_execution_links"
  ADD CONSTRAINT "ck_de_provider_link_target"
  CHECK ("capture_ref" IS NOT NULL OR "capability_execution_ref" IS NOT NULL);

ALTER TABLE "data_extraction_semantic_observations"
  ADD CONSTRAINT "ck_de_observation_repetition_positive"
  CHECK ("repetition_count" >= 1);

ALTER TABLE "data_extraction_observation_relations"
  ADD CONSTRAINT "ck_de_observation_relation_not_self"
  CHECK ("source_observation_key" <> "target_observation_key");

ALTER TABLE "data_extraction_capability_executions"
  ADD CONSTRAINT "ck_de_capexec_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));

ALTER TABLE "data_extraction_capability_resources"
  ADD CONSTRAINT "ck_de_capresource_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));

ALTER TABLE "data_extraction_evidence_items"
  ADD CONSTRAINT "ck_de_evidence_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));

ALTER TABLE "data_extraction_capability_evidence"
  ADD CONSTRAINT "ck_de_capevidence_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));

ALTER TABLE "data_extraction_semantic_observations"
  ADD CONSTRAINT "ck_de_observation_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));

ALTER TABLE "data_extraction_observation_support"
  ADD CONSTRAINT "ck_de_obs_support_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));

ALTER TABLE "data_extraction_observation_relations"
  ADD CONSTRAINT "ck_de_obs_relation_wave1_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence'
  ));
