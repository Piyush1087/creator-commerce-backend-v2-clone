ALTER TABLE "uce_campaigns"
  ADD COLUMN IF NOT EXISTS "creation_source" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "canonical_definition" JSONB;

ALTER TABLE "uce_campaigns"
  DROP CONSTRAINT IF EXISTS "uce_campaigns_creation_source_check";

ALTER TABLE "uce_campaigns"
  ADD CONSTRAINT "uce_campaigns_creation_source_check"
  CHECK ("creation_source" IN ('MANUAL', 'AI_RECOMMENDED'));

COMMENT ON COLUMN "uce_campaigns"."canonical_definition" IS
  'Canonical Campaign v1.2 field object used during legacy UCE persistence reconciliation. Legacy normalized columns remain compatibility projections until a later explicit persistence migration.';
