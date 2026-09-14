-- B1 is additive: website defaults and existing rows remain unchanged.
ALTER TYPE "DataExtractionSourceClass" ADD VALUE IF NOT EXISTS 'INSTAGRAM_OWNED';
ALTER TYPE "DataExtractionResourceType" ADD VALUE IF NOT EXISTS 'INSTAGRAM_ACCOUNT';
ALTER TYPE "DataExtractionResourceType" ADD VALUE IF NOT EXISTS 'INSTAGRAM_MEDIA';

-- PostgreSQL requires newly added enum values to commit before use in a check.
BEGIN;

ALTER TABLE "data_extraction_resources"
  ADD COLUMN "provider_account_id" VARCHAR(100);

ALTER TABLE "data_extraction_captures"
  ADD COLUMN "provider_integration_id" TEXT,
  ADD COLUMN "provider_account_id" VARCHAR(100),
  ADD COLUMN "authorization_generation" INTEGER;

ALTER TABLE "data_extraction_capability_executions"
  ADD COLUMN "provider_integration_id" TEXT,
  ADD COLUMN "provider_account_id" VARCHAR(100),
  ADD COLUMN "authorization_generation" INTEGER;

-- Widen every durable capability allowlist to the exact installed B1 vocabulary.
ALTER TABLE "data_extraction_capability_executions"
  DROP CONSTRAINT "ck_de_capexec_supported_capability",
  ADD CONSTRAINT "ck_de_capexec_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_capability_resources"
  DROP CONSTRAINT "ck_de_capresource_supported_capability",
  ADD CONSTRAINT "ck_de_capresource_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_evidence_items"
  DROP CONSTRAINT "ck_de_evidence_supported_capability",
  ADD CONSTRAINT "ck_de_evidence_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_capability_evidence"
  DROP CONSTRAINT "ck_de_capevidence_supported_capability",
  ADD CONSTRAINT "ck_de_capevidence_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_semantic_observations"
  DROP CONSTRAINT "ck_de_observation_supported_capability",
  ADD CONSTRAINT "ck_de_observation_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_observation_support"
  DROP CONSTRAINT "ck_de_obs_support_supported_capability",
  ADD CONSTRAINT "ck_de_obs_support_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_observation_relations"
  DROP CONSTRAINT "ck_de_obs_relation_supported_capability",
  ADD CONSTRAINT "ck_de_obs_relation_supported_capability"
  CHECK ("capability_id" IN (
    'owned_website.brand_messaging',
    'owned_website.brand_company_context',
    'owned_website.offering_context',
    'observed_brand_communication_language_signals',
    'derived_communication_constraint_evidence',
    'explicit_factual_proof_or_claim_evidence',
    'owned_website.visual_evidence',
    'owned_website.serviceability_evidence',
    'owned_website.location_evidence',
    'owned_website.offering_commercial_evidence',
    'instagram.account_profile',
    'instagram.media_inventory',
    'instagram.media_insights',
    'instagram.audience_followers',
    'instagram.audience_engaged',
    'instagram.caption_context',
    'instagram.media_visual_observations',
    'instagram.media_creator_signals',
    'instagram.media_offering_signals'
  ));

ALTER TABLE "data_extraction_resources"
  ADD CONSTRAINT "de_resource_instagram_account_lineage"
  CHECK (
    ("source_class"::text = 'OWNED_WEBSITE' AND "provider_account_id" IS NULL)
    OR
    ("source_class"::text = 'INSTAGRAM_OWNED' AND "provider_account_id" IS NOT NULL AND "page_role" IS NULL)
  );

ALTER TABLE "data_extraction_captures"
  ADD CONSTRAINT "de_capture_provider_fence_complete"
  CHECK (
    num_nonnulls("provider_integration_id", "provider_account_id", "authorization_generation") IN (0, 3)
    AND ("authorization_generation" IS NULL OR "authorization_generation" >= 0)
  );

ALTER TABLE "data_extraction_capability_executions"
  ADD CONSTRAINT "de_capexec_provider_fence_complete"
  CHECK (
    num_nonnulls("provider_integration_id", "provider_account_id", "authorization_generation") IN (0, 3)
    AND ("authorization_generation" IS NULL OR "authorization_generation" >= 0)
  );

CREATE INDEX "idx_de_resource_brand_provider_account"
  ON "data_extraction_resources"("brand_id", "provider_account_id");
CREATE INDEX "idx_de_capture_instagram_fence"
  ON "data_extraction_captures"("brand_id", "provider_account_id", "authorization_generation");
CREATE INDEX "idx_de_capexec_instagram_fence"
  ON "data_extraction_capability_executions"("brand_id", "provider_account_id", "authorization_generation");

COMMIT;
