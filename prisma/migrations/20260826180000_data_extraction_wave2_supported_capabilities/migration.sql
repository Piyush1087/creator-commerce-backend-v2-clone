-- DE-W2: approved closed-list compatibility expansion; no row or identity rewrite.
BEGIN;

ALTER TABLE "data_extraction_capability_executions"
  DROP CONSTRAINT "ck_de_capexec_wave1_capability",
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
    'owned_website.location_evidence'
  ));

ALTER TABLE "data_extraction_capability_resources"
  DROP CONSTRAINT "ck_de_capresource_wave1_capability",
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
    'owned_website.location_evidence'
  ));

ALTER TABLE "data_extraction_evidence_items"
  DROP CONSTRAINT "ck_de_evidence_wave1_capability",
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
    'owned_website.location_evidence'
  ));

ALTER TABLE "data_extraction_capability_evidence"
  DROP CONSTRAINT "ck_de_capevidence_wave1_capability",
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
    'owned_website.location_evidence'
  ));

ALTER TABLE "data_extraction_semantic_observations"
  DROP CONSTRAINT "ck_de_observation_wave1_capability",
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
    'owned_website.location_evidence'
  ));

ALTER TABLE "data_extraction_observation_support"
  DROP CONSTRAINT "ck_de_obs_support_wave1_capability",
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
    'owned_website.location_evidence'
  ));

ALTER TABLE "data_extraction_observation_relations"
  DROP CONSTRAINT "ck_de_obs_relation_wave1_capability",
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
    'owned_website.location_evidence'
  ));

COMMIT;
