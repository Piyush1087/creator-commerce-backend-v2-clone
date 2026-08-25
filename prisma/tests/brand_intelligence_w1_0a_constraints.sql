\set ON_ERROR_STOP on

BEGIN;

INSERT INTO "brand_profiles" ("id", "domain", "brand_name", "industry", "updated_at")
VALUES
  ('00000000-0000-4000-8000-00000000000a', 'w1-0a-a.example', 'W1.0A Brand A', 'D2C', CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-00000000000b', 'w1-0a-b.example', 'W1.0A Brand B', 'D2C', CURRENT_TIMESTAMP);

INSERT INTO "intelligence_executions" (
  "execution_id", "brand_id", "trigger_type", "trigger_ref",
  "trigger_idempotency_key", "correlation_ref", "requested_semantic_impact"
)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000000a',
  'TEST', 'trigger-a', 'idempotency-a', 'correlation-a', '{"objects":["brand_description"]}'::jsonb
);

DO $$
BEGIN
  INSERT INTO "intelligence_executions" (
    "execution_id", "brand_id", "trigger_type", "trigger_ref",
    "trigger_idempotency_key", "correlation_ref", "requested_semantic_impact"
  ) VALUES (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-00000000000a',
    'TEST', 'trigger-duplicate', 'idempotency-a', 'correlation-b', '{}'::jsonb
  );
  RAISE EXCEPTION 'expected duplicate trigger idempotency key to fail';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

INSERT INTO "intelligence_processor_executions" (
  "processor_execution_id", "execution_id", "brand_id", "processor_id", "processor_version",
  "bundle_id", "bundle_version", "bundle_hash", "output_contract_id", "output_contract_version",
  "active_scope", "active_scope_hash", "dependency_manifest", "dependency_manifest_hash",
  "evidence_manifest", "evidence_manifest_hash", "trigger_intent_key", "processor_execution_key",
  "max_attempts", "updated_at"
)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000000a',
  'brand_meaning', '1.0', 'bundle-a', '1.0', repeat('a', 64), 'output-a', '1.0',
  '["$"]'::jsonb, repeat('b', 64), '[]'::jsonb, repeat('c', 64),
  '[]'::jsonb, repeat('d', 64), 'intent-a', repeat('e', 64), 3, CURRENT_TIMESTAMP
);

DO $$
BEGIN
  INSERT INTO "intelligence_processor_executions" (
    "processor_execution_id", "execution_id", "brand_id", "processor_id", "processor_version",
    "bundle_id", "bundle_version", "bundle_hash", "output_contract_id", "output_contract_version",
    "active_scope", "active_scope_hash", "dependency_manifest", "dependency_manifest_hash",
    "evidence_manifest", "evidence_manifest_hash", "trigger_intent_key", "processor_execution_key",
    "max_attempts", "updated_at"
  ) VALUES (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-00000000000a',
    'brand_communication', '1.0', 'bundle-a', '1.0', repeat('a', 64), 'output-b', '1.0',
    '["$/f/primary_language"]'::jsonb, repeat('f', 64), '[]'::jsonb, repeat('c', 64),
    '[]'::jsonb, repeat('d', 64), 'intent-b', repeat('e', 64), 3, CURRENT_TIMESTAMP
  );
  RAISE EXCEPTION 'expected duplicate processor execution key to fail';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

INSERT INTO "intelligence_processor_attempts" (
  "attempt_id", "processor_execution_id", "brand_id", "attempt_number", "worker_identity_ref",
  "lease_token", "lease_acquired_at", "lease_expires_at"
)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000000a',
  1, 'schema-test-worker', 'lease-attempt-a', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes'
);

DO $$
BEGIN
  INSERT INTO "intelligence_processor_attempts" (
    "attempt_id", "processor_execution_id", "brand_id", "attempt_number", "worker_identity_ref",
    "lease_token", "lease_acquired_at", "lease_expires_at"
  ) VALUES (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-00000000000a',
    1, 'schema-test-worker', 'lease-attempt-b', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '5 minutes'
  );
  RAISE EXCEPTION 'expected duplicate processor attempt number to fail';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

INSERT INTO "intelligence_actions" (
  "action_id", "brand_id", "action_type", "actor_type", "actor_ref",
  "request_idempotency_key", "correlation_ref", "reason_code", "requested_atomicity", "outcome"
)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-00000000000a',
  'SCHEMA_TEST', 'SYSTEM', 'schema-test', 'action-idempotency-a', 'correlation-a',
  'SCHEMA_TEST', 'PER_COMPONENT', 'APPLIED'
);

INSERT INTO "intelligence_object_generations" (
  "object_generation_id", "brand_id", "object_semantic_id", "object_contract_id", "object_contract_version",
  "producer_kind", "producer_id", "bundle_id", "bundle_version", "bundle_hash", "action_id",
  "value_state", "value_payload", "value_hash", "object_metadata_payload", "readiness",
  "freshness_at_generation", "active_scope", "active_scope_hash", "generation_ordinal"
)
VALUES
  ('50000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
   'brand_description', 'brand_description', '1.0', 'AUTHORIZED_APPLICATION_ACTION', 'schema-test',
   'bundle-a', '1.0', repeat('a', 64), '40000000-0000-4000-8000-000000000001',
   'VALUE', '"basis"'::jsonb, repeat('1', 64), '{}'::jsonb, 'READY', 'CURRENT', '["$"]'::jsonb, repeat('b', 64), 1),
  ('50000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a',
   'brand_description', 'brand_description', '1.0', 'AUTHORIZED_APPLICATION_ACTION', 'schema-test',
   'bundle-a', '1.0', repeat('a', 64), '40000000-0000-4000-8000-000000000001',
   'VALUE', '"candidate-one"'::jsonb, repeat('2', 64), '{}'::jsonb, 'READY', 'CURRENT', '["$"]'::jsonb, repeat('b', 64), 2),
  ('50000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a',
   'brand_description', 'brand_description', '1.0', 'AUTHORIZED_APPLICATION_ACTION', 'schema-test',
   'bundle-a', '1.0', repeat('a', 64), '40000000-0000-4000-8000-000000000001',
   'VALUE', '"candidate-two"'::jsonb, repeat('3', 64), '{}'::jsonb, 'READY', 'CURRENT', '["$"]'::jsonb, repeat('b', 64), 3);

INSERT INTO "intelligence_component_generations" (
  "component_generation_id", "brand_id", "object_generation_id", "object_semantic_id",
  "component_semantic_path", "node_kind", "component_contract_id", "component_contract_version",
  "value_state", "value_payload", "value_hash", "authority", "source_class", "readiness",
  "freshness_at_generation", "metadata_payload"
)
VALUES
  ('60000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-000000000001', 'brand_description', '$', 'SCALAR',
   'brand_description', '1.0', 'VALUE', '"basis"'::jsonb, repeat('1', 64),
   'BRAND_CONFIRMED', 'BRAND_USER_INPUT', 'READY', 'CURRENT', '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-000000000002', 'brand_description', '$', 'SCALAR',
   'brand_description', '1.0', 'VALUE', '"candidate-one"'::jsonb, repeat('2', 64),
   'CREATOR_SHOP_DERIVED', 'OWNED_WEBSITE', 'READY', 'CURRENT', '{}'::jsonb),
  ('60000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-000000000003', 'brand_description', '$', 'SCALAR',
   'brand_description', '1.0', 'VALUE', '"candidate-two"'::jsonb, repeat('3', 64),
   'CREATOR_SHOP_DERIVED', 'OWNED_WEBSITE', 'READY', 'CURRENT', '{}'::jsonb);

DO $$
BEGIN
  INSERT INTO "intelligence_component_generations" (
    "component_generation_id", "brand_id", "object_generation_id", "object_semantic_id",
    "component_semantic_path", "node_kind", "component_contract_id", "component_contract_version",
    "value_state", "value_payload", "value_hash", "authority", "source_class", "readiness",
    "freshness_at_generation", "metadata_payload"
  ) VALUES (
    '60000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000a',
    '50000000-0000-4000-8000-000000000001', 'brand_description', '$', 'SCALAR',
    'brand_description', '1.0', 'VALUE', '"duplicate"'::jsonb, repeat('4', 64),
    'CREATOR_SHOP_DERIVED', 'OWNED_WEBSITE', 'READY', 'CURRENT', '{}'::jsonb
  );
  RAISE EXCEPTION 'expected duplicate component path in one Object generation to fail';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

INSERT INTO "intelligence_current_components" (
  "current_component_id", "brand_id", "object_semantic_id", "component_semantic_path", "node_kind",
  "current_component_generation_id", "current_contract_id", "current_contract_version", "current_authority",
  "current_source_class", "current_readiness", "current_freshness", "protection_state", "updated_at"
)
VALUES (
  '70000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
  'brand_description', '$', 'SCALAR', '60000000-0000-4000-8000-000000000001',
  'brand_description', '1.0', 'BRAND_CONFIRMED', 'BRAND_USER_INPUT', 'READY', 'CURRENT',
  'BRAND_CONFIRMED', CURRENT_TIMESTAMP
);

DO $$
BEGIN
  INSERT INTO "intelligence_current_components" (
    "current_component_id", "brand_id", "object_semantic_id", "component_semantic_path", "node_kind",
    "current_component_generation_id", "current_contract_id", "current_contract_version", "current_authority",
    "current_source_class", "current_readiness", "current_freshness", "protection_state", "updated_at"
  ) VALUES (
    '70000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a',
    'brand_description', '$', 'SCALAR', '60000000-0000-4000-8000-000000000001',
    'brand_description', '1.0', 'BRAND_CONFIRMED', 'BRAND_USER_INPUT', 'READY', 'CURRENT',
    'BRAND_CONFIRMED', CURRENT_TIMESTAMP
  );
  RAISE EXCEPTION 'expected duplicate semantic current path to fail';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

INSERT INTO "intelligence_component_candidates" (
  "component_candidate_id", "brand_id", "current_component_id", "object_semantic_id",
  "path_scheme_version", "component_semantic_path", "candidate_component_generation_id",
  "basis_current_component_generation_id", "basis_current_revision", "candidate_value_hash",
  "discrepancy_code", "producer_action_id"
)
VALUES
  ('80000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
   '70000000-0000-4000-8000-000000000001', 'brand_description', 1, '$',
   '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 1,
   repeat('2', 64), 'MATERIAL_DIFFERENCE', '40000000-0000-4000-8000-000000000001'),
  ('80000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a',
   '70000000-0000-4000-8000-000000000001', 'brand_description', 1, '$',
   '60000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', 1,
   repeat('3', 64), 'MATERIAL_DIFFERENCE', '40000000-0000-4000-8000-000000000001');

DO $$
DECLARE candidate_count integer;
BEGIN
  SELECT count(*) INTO candidate_count
  FROM "intelligence_component_candidates"
  WHERE "current_component_id" = '70000000-0000-4000-8000-000000000001' AND "status" = 'PENDING';
  IF candidate_count <> 2 THEN
    RAISE EXCEPTION 'expected two pending candidates, found %', candidate_count;
  END IF;
END $$;

DO $$
BEGIN
  INSERT INTO "intelligence_component_candidates" (
    "component_candidate_id", "brand_id", "current_component_id", "object_semantic_id",
    "path_scheme_version", "component_semantic_path", "candidate_component_generation_id",
    "basis_current_component_generation_id", "basis_current_revision", "candidate_value_hash",
    "discrepancy_code", "producer_action_id"
  ) VALUES (
    '80000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a',
    '70000000-0000-4000-8000-000000000001', 'brand_description', 1, '$',
    '60000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', 1,
    repeat('4', 64), 'MATERIAL_DIFFERENCE', '40000000-0000-4000-8000-000000000001'
  );
  RAISE EXCEPTION 'expected duplicate candidate generation to fail';
EXCEPTION WHEN unique_violation THEN
  NULL;
END $$;

DO $$
BEGIN
  INSERT INTO "intelligence_current_components" (
    "current_component_id", "brand_id", "object_semantic_id", "component_semantic_path", "node_kind",
    "current_component_generation_id", "current_contract_id", "current_contract_version", "current_authority",
    "current_source_class", "current_readiness", "current_freshness", "protection_state", "updated_at"
  ) VALUES (
    '70000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000b',
    'brand_description', '$', 'SCALAR', '60000000-0000-4000-8000-000000000001',
    'brand_description', '1.0', 'BRAND_CONFIRMED', 'BRAND_USER_INPUT', 'READY', 'CURRENT',
    'BRAND_CONFIRMED', CURRENT_TIMESTAMP
  );
  RAISE EXCEPTION 'expected cross-Brand current-generation relation to fail';
EXCEPTION WHEN foreign_key_violation THEN
  NULL;
END $$;

DO $$
DECLARE
  intelligence_values text[];
  evidence_values text[];
BEGIN
  SELECT array_agg(enum_value ORDER BY sort_order) INTO intelligence_values
  FROM (
    SELECT enumlabel::text AS enum_value, enumsortorder AS sort_order
    FROM pg_enum
    WHERE enumtypid = '"IntelligenceFreshness"'::regtype
  ) values_in_order;

  SELECT array_agg(enum_value ORDER BY sort_order) INTO evidence_values
  FROM (
    SELECT enumlabel::text AS enum_value, enumsortorder AS sort_order
    FROM pg_enum
    WHERE enumtypid = '"IntelligenceEvidenceFreshness"'::regtype
  ) values_in_order;

  IF intelligence_values <> ARRAY['CURRENT', 'STALE', 'UNKNOWN'] THEN
    RAISE EXCEPTION 'unexpected permanent Intelligence freshness vocabulary: %', intelligence_values;
  END IF;
  IF evidence_values <> ARRAY['CURRENT', 'POSSIBLY_STALE', 'UNKNOWN'] THEN
    RAISE EXCEPTION 'unexpected normalized Evidence freshness vocabulary: %', evidence_values;
  END IF;
END $$;

INSERT INTO "intelligence_evidence_references" (
  "evidence_reference_id", "brand_id", "object_generation_id", "component_semantic_path",
  "evidence_ref", "capability_id", "capture_id", "capture_version", "source_class",
  "captured_at", "observed_freshness", "evidence_manifest_hash"
)
VALUES
  ('90000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-000000000001', '$', 'evidence:test:current', 'PUBLIC_WEBSITE',
   'capture-current', '1', 'OWNED_WEBSITE', CURRENT_TIMESTAMP, 'CURRENT', repeat('d', 64)),
  ('90000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-000000000001', '$', 'evidence:test:possibly-stale', 'PUBLIC_WEBSITE',
   'capture-possibly-stale', '1', 'OWNED_WEBSITE', CURRENT_TIMESTAMP, 'POSSIBLY_STALE', repeat('d', 64)),
  ('90000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-00000000000a',
   '50000000-0000-4000-8000-000000000001', '$', 'evidence:test:unknown', 'PUBLIC_WEBSITE',
   'capture-unknown', '1', 'OWNED_WEBSITE', CURRENT_TIMESTAMP, 'UNKNOWN', repeat('d', 64));

DO $$
BEGIN
  EXECUTE $sql$
    INSERT INTO "intelligence_evidence_references" (
      "evidence_reference_id", "brand_id", "object_generation_id", "component_semantic_path",
      "evidence_ref", "capability_id", "capture_id", "capture_version", "source_class",
      "captured_at", "observed_freshness", "evidence_manifest_hash"
    ) VALUES (
      '90000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-00000000000a',
      '50000000-0000-4000-8000-000000000001', '$', 'evidence:test:stale', 'PUBLIC_WEBSITE',
      'capture-stale', '1', 'OWNED_WEBSITE', CURRENT_TIMESTAMP, 'STALE', repeat('d', 64)
    )
  $sql$;
  RAISE EXCEPTION 'expected Evidence freshness STALE to be rejected';
EXCEPTION WHEN invalid_text_representation THEN
  NULL;
END $$;

DO $$
BEGIN
  INSERT INTO "intelligence_evidence_references" (
    "evidence_reference_id", "brand_id", "object_generation_id", "component_semantic_path",
    "evidence_ref", "capability_id", "capture_id", "capture_version", "source_class",
    "captured_at", "evidence_manifest_hash"
  ) VALUES (
    '90000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-00000000000b',
    '50000000-0000-4000-8000-000000000001', '$', 'evidence:test:cross-brand', 'PUBLIC_WEBSITE',
    'capture-cross-brand', '1', 'OWNED_WEBSITE', CURRENT_TIMESTAMP, repeat('d', 64)
  );
  RAISE EXCEPTION 'expected cross-Brand Evidence-generation relation to fail';
EXCEPTION WHEN foreign_key_violation THEN
  NULL;
END $$;

INSERT INTO "intelligence_business_state_references" (
  "business_state_reference_id", "brand_id", "object_generation_id", "component_semantic_path",
  "entity_type", "entity_id", "semantic_field_path", "revision_kind", "revision_token",
  "observed_at", "canonical_snapshot_ref"
)
VALUES (
  'a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000a',
  '50000000-0000-4000-8000-000000000001', '$', 'BRAND',
  '00000000-0000-4000-8000-00000000000a', 'description', 'SNAPSHOT_FINGERPRINT',
  repeat('f', 64), CURRENT_TIMESTAMP, 'brand-snapshot:test:1'
);

DO $$
DECLARE forbidden_count integer;
BEGIN
  SELECT count(*) INTO forbidden_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'intelligence_evidence_references'
    AND column_name IN (
      'raw_page_content', 'provider_response', 'provider_name', 'model_name',
      'tokens', 'headers', 'credentials', 'evidence_payload'
    );
  IF forbidden_count <> 0 THEN
    RAISE EXCEPTION 'Evidence reference table contains forbidden payload/provider columns';
  END IF;

  SELECT count(*) INTO forbidden_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'intelligence_business_state_references'
    AND column_name IN ('canonical_value', 'value_payload', 'snapshot_payload');
  IF forbidden_count <> 0 THEN
    RAISE EXCEPTION 'business-state reference table contains copied canonical value columns';
  END IF;
END $$;

SELECT 'W1.0A database constraints passed' AS result;

ROLLBACK;
