-- C3-R0 adds explicit, provider-neutral Evidence derivation provenance.
-- Existing rows remain nullable and continue through the bounded legacy fallback.
CREATE TYPE "DataExtractionCaptureMethodClass" AS ENUM (
  'DIRECT_FETCH',
  'RENDERED_FETCH',
  'PROVIDER_MEDIATED_FETCH',
  'DETERMINISTIC_DERIVATION',
  'MODEL_DERIVATION'
);

ALTER TABLE "data_extraction_evidence_items"
  ADD COLUMN "capture_method_class" "DataExtractionCaptureMethodClass",
  ADD COLUMN "parent_evidence_refs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- The accepted C2 contract marker is unambiguous. No capability-name inference
-- is used for MODEL_DERIVATION or for other historical Instagram rows.
UPDATE "data_extraction_evidence_items"
SET
  "capture_method_class" = 'DETERMINISTIC_DERIVATION',
  "parent_evidence_refs" = CASE
    WHEN jsonb_typeof("bounded_payload"->'supporting_evidence_refs') = 'array'
      THEN ARRAY(
        SELECT DISTINCT jsonb_array_elements_text(
          "bounded_payload"->'supporting_evidence_refs'
        ) AS ref
        ORDER BY ref
      )
    WHEN jsonb_typeof("bounded_payload"->'supportingEvidenceRefs') = 'array'
      THEN ARRAY(
        SELECT DISTINCT jsonb_array_elements_text(
          "bounded_payload"->'supportingEvidenceRefs'
        ) AS ref
        ORDER BY ref
      )
    ELSE ARRAY[]::TEXT[]
  END
WHERE "capture_method_class" IS NULL
  AND "normalization_contract_version" = 'instagram-c2-deterministic-foundations-v1';
