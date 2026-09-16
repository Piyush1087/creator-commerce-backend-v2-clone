-- Canonical reconciliation migration-94 synthetic fixture, version 1.
-- Base commit: 129b291ecbca4a1e79451215a81726000cfb5bff
-- Base tree: 9fe6585addf8d8ccee9973b9b55cc0312c6e2b0b
-- Load only into a clean PostgreSQL 16 database migrated through migration 94.
-- All identities and content below are deterministic, fictional, and reserved for tests.

BEGIN;

INSERT INTO "organizations" ("id", "name", "kind", "created_at", "updated_at") VALUES
  ('94000000-0000-4000-8000-000000000001', 'Synthetic Brand Fixture Organization', 'BRAND', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('94000000-0000-4000-8000-000000000002', 'Synthetic Creator Fixture Organization', 'CREATOR', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO "users" (
  "id", "email", "normalized_email", "role", "organization_id", "name",
  "email_verified_at", "auth_state", "created_at", "updated_at"
) VALUES
  ('94000000-0000-4000-8000-000000000011', 'brand-owner@fixture.invalid', 'brand-owner@fixture.invalid', 'BRAND', '94000000-0000-4000-8000-000000000001', 'Synthetic Brand Owner', '2026-01-01T00:00:00Z', 'ACTIVE', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('94000000-0000-4000-8000-000000000012', 'creator-owner@fixture.invalid', 'creator-owner@fixture.invalid', 'CREATOR', '94000000-0000-4000-8000-000000000002', 'Synthetic Creator Owner', '2026-01-01T00:00:00Z', 'ACTIVE', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('94000000-0000-4000-8000-000000000099', 'unaffected-control@fixture.invalid', 'unaffected-control@fixture.invalid', 'ADMIN', NULL, 'Synthetic Unaffected Control', NULL, 'DISABLED', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO "brand_profiles" (
  "id", "organization_id", "domain", "brand_name", "industry", "description",
  "country_code", "currency_code", "created_at", "updated_at", "social_links"
) VALUES (
  '94000000-0000-4000-8000-000000000021', '94000000-0000-4000-8000-000000000001',
  'synthetic-brand.fixture.invalid', 'Synthetic Fixture Brand', 'D2C',
  'Fictional brand row for canonical migration reconciliation tests.', 'US', 'USD',
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ARRAY['https://synthetic-brand.fixture.invalid/about']
);

INSERT INTO "creator_profiles" (
  "id", "user_id", "display_name", "instagram_handle", "created_at", "updated_at", "primary_region",
  "follower_count", "audience_demographics_matrix", "public_slug", "is_media_kit_public"
) VALUES (
  '94000000-0000-4000-8000-000000000031', '94000000-0000-4000-8000-000000000012',
  'Synthetic Fixture Creator', 'synthetic_fixture_creator', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'US',
  9400, '{"synthetic":true}'::jsonb, 'synthetic-fixture-creator', true
);

INSERT INTO "creator_workspaces" (
  "id", "owner_profile_id", "organization_display_name", "organization_id", "created_at", "updated_at"
) VALUES (
  '94000000-0000-4000-8000-000000000041', '94000000-0000-4000-8000-000000000031',
  'Synthetic Creator Workspace', '94000000-0000-4000-8000-000000000002',
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
);

INSERT INTO "creator_workspace_members" (
  "id", "workspace_id", "assigned_profile_id", "associated_email", "security_role_token",
  "is_active_active", "joined_at", "created_at", "updated_at", "user_id"
) VALUES (
  '94000000-0000-4000-8000-000000000051', '94000000-0000-4000-8000-000000000041',
  '94000000-0000-4000-8000-000000000031', 'creator-owner@fixture.invalid', 'OWNER', true,
  '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z',
  '94000000-0000-4000-8000-000000000012'
);

INSERT INTO "data_extraction_resources" (
  "id", "resource_ref", "brand_id", "source_class", "resource_type", "page_role",
  "canonical_resource_key", "canonical_resource_key_hash", "canonical_url", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000101', 'fixture-resource-home',
  '94000000-0000-4000-8000-000000000021', 'OWNED_WEBSITE', 'OWNED_WEB_PAGE', 'HOMEPAGE',
  'https://synthetic-brand.fixture.invalid/',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'https://synthetic-brand.fixture.invalid/', '2026-01-01T01:00:00Z'
);

INSERT INTO "data_extraction_capability_executions" (
  "id", "capability_execution_ref", "brand_id", "capability_id", "normalization_contract_version",
  "resource_scope_hash", "freshness_intent", "source_revision_ref", "request_key", "availability",
  "retryability", "reason_codes", "coverage", "acquisition_quality", "quality_failure_categories",
  "quality_detail_codes", "created_at", "completed_at"
) VALUES
  ('94000000-0000-4000-8000-000000000111', 'fixture-capexec-messaging', '94000000-0000-4000-8000-000000000021', 'owned_website.brand_messaging', 'fixture-contract-v1', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'REUSE_ALLOWED', 'fixture-revision-1', 'fixture-request-messaging', 'AVAILABLE', 'NOT_APPLICABLE', ARRAY[]::text[], 'SINGLE_RESOURCE', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], '2026-01-01T01:01:00Z', '2026-01-01T01:02:00Z'),
  ('94000000-0000-4000-8000-000000000112', 'fixture-capexec-derived', '94000000-0000-4000-8000-000000000021', 'derived_communication_constraint_evidence', 'instagram-c2-deterministic-foundations-v1', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'REUSE_ALLOWED', 'fixture-revision-1', 'fixture-request-derived', 'AVAILABLE', 'NOT_APPLICABLE', ARRAY[]::text[], 'SINGLE_RESOURCE', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], '2026-01-01T01:01:00Z', '2026-01-01T01:02:00Z'),
  ('94000000-0000-4000-8000-000000000113', 'fixture-capexec-visual', '94000000-0000-4000-8000-000000000021', 'owned_website.visual_evidence', 'fixture-contract-v1', 'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'REFRESH_IF_NOT_CURRENT', 'fixture-revision-1', 'fixture-request-visual', 'AVAILABLE', 'NOT_APPLICABLE', ARRAY[]::text[], 'SINGLE_RESOURCE', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], '2026-01-01T01:01:00Z', '2026-01-01T01:02:00Z');

INSERT INTO "data_extraction_capability_resources" (
  "brand_id", "capability_execution_ref", "capability_id", "resource_ref", "created_at"
) VALUES
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-messaging', 'owned_website.brand_messaging', 'fixture-resource-home', '2026-01-01T01:01:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-derived', 'derived_communication_constraint_evidence', 'fixture-resource-home', '2026-01-01T01:01:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-visual', 'owned_website.visual_evidence', 'fixture-resource-home', '2026-01-01T01:01:00Z');

INSERT INTO "data_extraction_captures" (
  "id", "capture_ref", "brand_id", "resource_ref", "capability_execution_ref", "acquisition_request_key",
  "status", "started_at", "captured_at", "observed_at", "source_revision_ref", "source_content_hash",
  "acquisition_quality", "quality_failure_categories", "quality_detail_codes", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000121', 'fixture-capture-home',
  '94000000-0000-4000-8000-000000000021', 'fixture-resource-home', 'fixture-capexec-messaging',
  'fixture-acquisition-home', 'COMPLETED', '2026-01-01T01:00:00Z', '2026-01-01T01:01:00Z',
  '2026-01-01T00:59:00Z', 'fixture-revision-1',
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], '2026-01-01T01:00:00Z'
);

INSERT INTO "data_extraction_content_artifacts" (
  "id", "content_artifact_ref", "brand_id", "capture_ref", "kind", "media_type", "content_hash",
  "byte_length", "inline_content", "normalization_contract_version", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000131', 'fixture-artifact-home',
  '94000000-0000-4000-8000-000000000021', 'fixture-capture-home', 'NORMALIZED_TEXT', 'text/plain',
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 86,
  'Synthetic normalized source content. No production, provider, customer, or personal data.',
  'fixture-contract-v1', '2026-01-01T01:02:00Z'
);

INSERT INTO "data_extraction_evidence_items" (
  "id", "evidence_ref", "brand_id", "capability_id", "normalization_contract_version", "resource_ref",
  "capture_ref", "content_artifact_ref", "bounded_payload", "content_hash", "polarity",
  "representativeness", "coverage_snapshot", "freshness_at_emission", "freshness_basis",
  "freshness_evaluated_at", "freshness_source_revision_ref", "quality_snapshot",
  "quality_failure_categories", "quality_detail_codes", "item_fingerprint", "semantic_observation_key", "created_at"
) VALUES
  ('94000000-0000-4000-8000-000000000141', 'fixture-evidence-message', '94000000-0000-4000-8000-000000000021', 'owned_website.brand_messaging', 'fixture-contract-v1', 'fixture-resource-home', 'fixture-capture-home', 'fixture-artifact-home', '{"claim":"synthetic fixture message"}'::jsonb, '1111111111111111111111111111111111111111111111111111111111111111', 'AFFIRMATIVE', 'PERSISTENT_BRAND_LEVEL', 'SINGLE_RESOURCE', 'CURRENT', 'fixture captured timestamp', '2026-01-01T01:02:00Z', 'fixture-revision-1', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'fixture-fingerprint-message', 'fixture-observation-message-a', '2026-01-01T01:02:00Z'),
  ('94000000-0000-4000-8000-000000000142', 'fixture-evidence-snake', '94000000-0000-4000-8000-000000000021', 'derived_communication_constraint_evidence', 'instagram-c2-deterministic-foundations-v1', 'fixture-resource-home', 'fixture-capture-home', 'fixture-artifact-home', '{"supporting_evidence_refs":["fixture-evidence-message","fixture-evidence-message"]}'::jsonb, '2222222222222222222222222222222222222222222222222222222222222222', 'RESTRICTION', 'REPEATED_REPRESENTATIVE', 'SINGLE_RESOURCE', 'CURRENT', 'fixture deterministic derivation', '2026-01-01T01:03:00Z', 'fixture-revision-1', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'fixture-fingerprint-snake', 'fixture-observation-derived-snake', '2026-01-01T01:03:00Z'),
  ('94000000-0000-4000-8000-000000000143', 'fixture-evidence-camel', '94000000-0000-4000-8000-000000000021', 'derived_communication_constraint_evidence', 'instagram-c2-deterministic-foundations-v1', 'fixture-resource-home', 'fixture-capture-home', 'fixture-artifact-home', '{"supportingEvidenceRefs":["fixture-evidence-snake","fixture-evidence-message"]}'::jsonb, '3333333333333333333333333333333333333333333333333333333333333333', 'NEUTRAL', 'CONTEXT_SPECIFIC', 'SINGLE_RESOURCE', 'CURRENT', 'fixture deterministic derivation', '2026-01-01T01:03:00Z', 'fixture-revision-1', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'fixture-fingerprint-camel', 'fixture-observation-derived-camel', '2026-01-01T01:03:00Z'),
  ('94000000-0000-4000-8000-000000000144', 'fixture-evidence-visual', '94000000-0000-4000-8000-000000000021', 'owned_website.visual_evidence', 'fixture-contract-v1', 'fixture-resource-home', 'fixture-capture-home', 'fixture-artifact-home', '{"palette":["synthetic-blue"]}'::jsonb, '4444444444444444444444444444444444444444444444444444444444444444', 'AFFIRMATIVE', 'CONTEXT_SPECIFIC', 'SINGLE_RESOURCE', 'CURRENT', 'fixture captured timestamp', '2026-01-01T01:02:00Z', 'fixture-revision-1', 'COMPLETE', ARRAY[]::text[], ARRAY[]::text[], 'fixture-fingerprint-visual', 'fixture-observation-visual', '2026-01-01T01:02:00Z');

INSERT INTO "data_extraction_capability_evidence" (
  "brand_id", "capability_execution_ref", "capability_id", "evidence_ref", "created_at"
) VALUES
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-messaging', 'owned_website.brand_messaging', 'fixture-evidence-message', '2026-01-01T01:04:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-derived', 'derived_communication_constraint_evidence', 'fixture-evidence-snake', '2026-01-01T01:04:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-derived', 'derived_communication_constraint_evidence', 'fixture-evidence-camel', '2026-01-01T01:04:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-capexec-visual', 'owned_website.visual_evidence', 'fixture-evidence-visual', '2026-01-01T01:04:00Z');

INSERT INTO "data_extraction_semantic_observations" (
  "id", "semantic_observation_key", "brand_id", "capability_id", "repetition_count", "created_at"
) VALUES
  ('94000000-0000-4000-8000-000000000151', 'fixture-observation-message-a', '94000000-0000-4000-8000-000000000021', 'owned_website.brand_messaging', 2, '2026-01-01T01:05:00Z'),
  ('94000000-0000-4000-8000-000000000152', 'fixture-observation-message-b', '94000000-0000-4000-8000-000000000021', 'owned_website.brand_messaging', 1, '2026-01-01T01:05:00Z'),
  ('94000000-0000-4000-8000-000000000153', 'fixture-observation-derived-snake', '94000000-0000-4000-8000-000000000021', 'derived_communication_constraint_evidence', 1, '2026-01-01T01:05:00Z'),
  ('94000000-0000-4000-8000-000000000154', 'fixture-observation-derived-camel', '94000000-0000-4000-8000-000000000021', 'derived_communication_constraint_evidence', 1, '2026-01-01T01:05:00Z'),
  ('94000000-0000-4000-8000-000000000155', 'fixture-observation-visual', '94000000-0000-4000-8000-000000000021', 'owned_website.visual_evidence', 1, '2026-01-01T01:05:00Z');

INSERT INTO "data_extraction_observation_support" (
  "brand_id", "semantic_observation_key", "capability_id", "evidence_ref", "created_at"
) VALUES
  ('94000000-0000-4000-8000-000000000021', 'fixture-observation-message-a', 'owned_website.brand_messaging', 'fixture-evidence-message', '2026-01-01T01:06:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-observation-derived-snake', 'derived_communication_constraint_evidence', 'fixture-evidence-snake', '2026-01-01T01:06:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-observation-derived-camel', 'derived_communication_constraint_evidence', 'fixture-evidence-camel', '2026-01-01T01:06:00Z'),
  ('94000000-0000-4000-8000-000000000021', 'fixture-observation-visual', 'owned_website.visual_evidence', 'fixture-evidence-visual', '2026-01-01T01:06:00Z');

INSERT INTO "data_extraction_observation_relations" (
  "brand_id", "source_observation_key", "target_observation_key", "capability_id", "relation_type", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000021', 'fixture-observation-message-a',
  'fixture-observation-message-b', 'owned_website.brand_messaging', 'EQUIVALENT_TO', '2026-01-01T01:06:00Z'
);

INSERT INTO "data_extraction_freshness_assessments" (
  "id", "brand_id", "target_type", "target_ref", "state", "evaluated_at", "basis",
  "prior_capture_ref", "source_revision_ref", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000161', '94000000-0000-4000-8000-000000000021',
  'EVIDENCE', 'fixture-evidence-message', 'CURRENT', '2026-01-01T01:07:00Z',
  'synthetic fixture freshness assessment', 'fixture-capture-home', 'fixture-revision-1', '2026-01-01T01:07:00Z'
);

INSERT INTO "data_extraction_provider_execution_links" (
  "id", "brand_id", "capture_ref", "capability_execution_ref", "provider_execution_ref", "attempt_role", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000171', '94000000-0000-4000-8000-000000000021',
  'fixture-capture-home', 'fixture-capexec-messaging', 'fixture-provider-execution-not-real', 'PRIMARY',
  '2026-01-01T01:08:00Z'
);

INSERT INTO "intelligence_subjects" (
  "subject_id", "brand_id", "subject_type", "subject_ref", "created_at", "updated_at"
) VALUES (
  '94000000-0000-4000-8000-000000000201', '94000000-0000-4000-8000-000000000021',
  'BRAND', '94000000-0000-4000-8000-000000000021', '2026-01-01T02:00:00Z', '2026-01-01T02:00:00Z'
);

INSERT INTO "intelligence_actions" (
  "action_id", "brand_id", "action_type", "actor_type", "actor_ref", "request_idempotency_key",
  "correlation_ref", "reason_code", "requested_atomicity", "outcome", "created_at", "subject_id"
) VALUES (
  '94000000-0000-4000-8000-000000000211', '94000000-0000-4000-8000-000000000021',
  'FIXTURE_MIGRATION_IMPORT', 'SYSTEM', 'synthetic-fixture', 'fixture-intelligence-action-v1',
  'fixture-correlation-v1', 'SYNTHETIC_FIXTURE', 'ATOMIC', 'SUCCEEDED', '2026-01-01T02:01:00Z',
  '94000000-0000-4000-8000-000000000201'
);

INSERT INTO "intelligence_object_generations" (
  "object_generation_id", "brand_id", "object_semantic_id", "object_contract_id", "object_contract_version",
  "producer_kind", "producer_id", "bundle_id", "bundle_version", "bundle_hash", "action_id", "value_state",
  "value_payload", "value_hash", "object_metadata_payload", "readiness", "freshness_at_generation",
  "active_scope", "active_scope_hash", "generation_ordinal", "created_at", "subject_id"
) VALUES (
  '94000000-0000-4000-8000-000000000221', '94000000-0000-4000-8000-000000000021',
  'fixture.brand.summary', 'fixture-brand-summary', '1', 'MIGRATION_IMPORT', 'synthetic-fixture',
  'fixture-bundle', '1', '5555555555555555555555555555555555555555555555555555555555555555',
  '94000000-0000-4000-8000-000000000211', 'VALUE', '{"summary":"synthetic fixture value"}'::jsonb,
  '6666666666666666666666666666666666666666666666666666666666666666',
  '{"synthetic":true}'::jsonb, 'READY', 'CURRENT', '{"paths":["$/f/summary"]}'::jsonb,
  '7777777777777777777777777777777777777777777777777777777777777777', 1,
  '2026-01-01T02:02:00Z', '94000000-0000-4000-8000-000000000201'
);

INSERT INTO "intelligence_component_generations" (
  "component_generation_id", "brand_id", "object_generation_id", "object_semantic_id", "path_scheme_version",
  "component_semantic_path", "node_kind", "component_contract_id", "component_contract_version", "value_state",
  "value_payload", "value_hash", "authority", "source_class", "readiness", "freshness_at_generation",
  "metadata_payload", "presentation_order", "created_at", "subject_id"
) VALUES (
  '94000000-0000-4000-8000-000000000231', '94000000-0000-4000-8000-000000000021',
  '94000000-0000-4000-8000-000000000221', 'fixture.brand.summary', 1, '$/f/summary', 'OBJECT_FIELD',
  'fixture-summary-component', '1', 'VALUE', '"synthetic fixture value"'::jsonb,
  '8888888888888888888888888888888888888888888888888888888888888888',
  'SYSTEM_DERIVED', 'OWNED_WEBSITE', 'READY', 'CURRENT', '{"synthetic":true}'::jsonb, 0,
  '2026-01-01T02:03:00Z', '94000000-0000-4000-8000-000000000201'
);

INSERT INTO "intelligence_current_components" (
  "current_component_id", "brand_id", "object_semantic_id", "path_scheme_version", "component_semantic_path",
  "node_kind", "current_component_generation_id", "current_contract_id", "current_contract_version",
  "current_authority", "current_source_class", "current_readiness", "current_freshness", "revision",
  "freshness_evaluated_at", "created_at", "updated_at", "subject_id"
) VALUES (
  '94000000-0000-4000-8000-000000000241', '94000000-0000-4000-8000-000000000021',
  'fixture.brand.summary', 1, '$/f/summary', 'OBJECT_FIELD', '94000000-0000-4000-8000-000000000231',
  'fixture-summary-component', '1', 'SYSTEM_DERIVED', 'OWNED_WEBSITE', 'READY', 'CURRENT', 1,
  '2026-01-01T02:04:00Z', '2026-01-01T02:04:00Z', '2026-01-01T02:04:00Z',
  '94000000-0000-4000-8000-000000000201'
);

INSERT INTO "intelligence_evidence_references" (
  "evidence_reference_id", "brand_id", "object_generation_id", "component_semantic_path", "evidence_ref",
  "capability_id", "capture_id", "capture_version", "source_class", "captured_at", "observed_freshness",
  "evidence_manifest_ref", "evidence_manifest_hash", "created_at"
) VALUES (
  '94000000-0000-4000-8000-000000000251', '94000000-0000-4000-8000-000000000021',
  '94000000-0000-4000-8000-000000000221', '$/f/summary', 'fixture-evidence-message',
  'owned_website.brand_messaging', 'fixture-capture-home', 'fixture-revision-1', 'OWNED_WEBSITE',
  '2026-01-01T01:01:00Z', 'CURRENT', 'fixture-evidence-manifest-v1',
  '9999999999999999999999999999999999999999999999999999999999999999', '2026-01-01T02:05:00Z'
);

COMMIT;
