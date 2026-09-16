ALTER TABLE "uce_campaigns"
ADD COLUMN "canonical_definition_hash" VARCHAR(71);

ALTER TABLE "uce_campaigns"
ADD CONSTRAINT "uce_campaigns_canonical_definition_hash_shape_check"
CHECK (
  "canonical_definition_hash" IS NULL
  OR "canonical_definition_hash" ~ '^sha256:[0-9a-f]{64}$'
);
