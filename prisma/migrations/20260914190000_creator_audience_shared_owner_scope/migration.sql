CREATE TYPE "IntelligenceOwnerType" AS ENUM ('BRAND', 'CREATOR');

CREATE TABLE "intelligence_owner_scopes" (
  "owner_scope_id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_type" "IntelligenceOwnerType" NOT NULL,
  "owner_key" VARCHAR(255) NOT NULL,
  "brand_profile_id" TEXT,
  "creator_profile_id" TEXT,
  "creator_workspace_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "intelligence_owner_scopes_pkey" PRIMARY KEY ("owner_scope_id"),
  CONSTRAINT "ck_intelligence_owner_scope_exact_arm" CHECK (
    ("owner_type" = 'BRAND' AND "brand_profile_id" IS NOT NULL AND "creator_profile_id" IS NULL AND "creator_workspace_id" IS NULL)
    OR
    ("owner_type" = 'CREATOR' AND "brand_profile_id" IS NULL AND "creator_profile_id" IS NOT NULL AND "creator_workspace_id" IS NOT NULL)
  ),
  CONSTRAINT "fk_intelligence_owner_scope_brand" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_intelligence_owner_scope_creator" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_intelligence_owner_scope_workspace_owner" FOREIGN KEY ("creator_workspace_id", "creator_profile_id") REFERENCES "creator_workspaces"("id", "owner_profile_id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "uq_intelligence_owner_scope_key" ON "intelligence_owner_scopes"("owner_key");
CREATE UNIQUE INDEX "uq_intelligence_owner_scope_brand" ON "intelligence_owner_scopes"("brand_profile_id") WHERE "brand_profile_id" IS NOT NULL;
CREATE UNIQUE INDEX "uq_intelligence_owner_scope_creator" ON "intelligence_owner_scopes"("creator_profile_id") WHERE "creator_profile_id" IS NOT NULL;
CREATE UNIQUE INDEX "uq_intelligence_owner_scope_workspace" ON "intelligence_owner_scopes"("creator_workspace_id") WHERE "creator_workspace_id" IS NOT NULL;
CREATE INDEX "idx_intelligence_owner_scope_type" ON "intelligence_owner_scopes"("owner_type");

INSERT INTO "intelligence_owner_scopes" ("owner_type", "owner_key", "brand_profile_id")
SELECT 'BRAND', 'BRAND:' || "id"::text, "id"
FROM "brand_profiles"
ON CONFLICT ("brand_profile_id") WHERE "brand_profile_id" IS NOT NULL DO NOTHING;

ALTER TABLE "data_extraction_capability_resources" DROP CONSTRAINT "data_extraction_capability_resources_pkey";
ALTER TABLE "data_extraction_capability_evidence" DROP CONSTRAINT "data_extraction_capability_evidence_pkey";
ALTER TABLE "data_extraction_observation_support" DROP CONSTRAINT "data_extraction_observation_support_pkey";
ALTER TABLE "data_extraction_observation_relations" DROP CONSTRAINT "data_extraction_observation_relations_pkey";

DO $owner_scope_uplift$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'intelligence_subjects','intelligence_executions','intelligence_processor_executions',
    'intelligence_processor_attempts','intelligence_actions','intelligence_object_generations',
    'intelligence_component_generations','intelligence_current_components','intelligence_component_candidates',
    'intelligence_evidence_references','intelligence_business_state_references','intelligence_component_transitions',
    'data_extraction_resources','data_extraction_captures','data_extraction_content_artifacts',
    'data_extraction_capability_executions','data_extraction_capability_resources','data_extraction_evidence_items',
    'data_extraction_capability_evidence','data_extraction_semantic_observations','data_extraction_observation_support',
    'data_extraction_observation_relations','data_extraction_freshness_assessments',
    'data_extraction_provider_execution_links','instagram_intelligence_sync_jobs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN owner_scope_id TEXT', table_name);
    EXECUTE format(
      'UPDATE %I row SET owner_scope_id = scope.owner_scope_id FROM intelligence_owner_scopes scope WHERE scope.owner_type = ''BRAND'' AND scope.brand_profile_id = row.brand_id',
      table_name
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN owner_scope_id SET NOT NULL', table_name);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN brand_id DROP NOT NULL', table_name);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (owner_scope_id) REFERENCES intelligence_owner_scopes(owner_scope_id) ON DELETE CASCADE',
      table_name, 'fk_' || table_name || '_owner_scope'
    );
    EXECUTE format('CREATE INDEX %I ON %I(owner_scope_id)', 'idx_' || table_name || '_owner_scope', table_name);
  END LOOP;
END
$owner_scope_uplift$;

CREATE OR REPLACE FUNCTION "enforce_intelligence_owner_scope"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  scope "intelligence_owner_scopes"%ROWTYPE;
BEGIN
  IF NEW."owner_scope_id" IS NULL THEN
    IF NEW."brand_id" IS NULL THEN
      RAISE EXCEPTION 'OWNER_SCOPE_REQUIRED';
    END IF;
    INSERT INTO "intelligence_owner_scopes" ("owner_type", "owner_key", "brand_profile_id")
      VALUES ('BRAND', 'BRAND:' || NEW."brand_id"::text, NEW."brand_id")
      ON CONFLICT ("brand_profile_id") WHERE "brand_profile_id" IS NOT NULL DO NOTHING;
    SELECT * INTO scope FROM "intelligence_owner_scopes"
      WHERE "owner_type" = 'BRAND' AND "brand_profile_id" = NEW."brand_id";
    NEW."owner_scope_id" := scope."owner_scope_id";
  ELSE
    SELECT * INTO scope FROM "intelligence_owner_scopes"
      WHERE "owner_scope_id" = NEW."owner_scope_id";
  END IF;

  IF scope."owner_scope_id" IS NULL THEN RAISE EXCEPTION 'OWNER_SCOPE_UNKNOWN'; END IF;
  IF scope."owner_type" = 'BRAND' AND NEW."brand_id" IS DISTINCT FROM scope."brand_profile_id" THEN
    RAISE EXCEPTION 'BRAND_OWNER_SCOPE_MISMATCH';
  END IF;
  IF scope."owner_type" = 'CREATOR' AND NEW."brand_id" IS NOT NULL THEN
    RAISE EXCEPTION 'CREATOR_SCOPE_CANNOT_HAVE_BRAND';
  END IF;
  RETURN NEW;
END $$;

DO $owner_scope_triggers$
DECLARE
  table_name text;
  tables text[] := ARRAY[
    'intelligence_subjects','intelligence_executions','intelligence_processor_executions',
    'intelligence_processor_attempts','intelligence_actions','intelligence_object_generations',
    'intelligence_component_generations','intelligence_current_components','intelligence_component_candidates',
    'intelligence_evidence_references','intelligence_business_state_references','intelligence_component_transitions',
    'data_extraction_resources','data_extraction_captures','data_extraction_content_artifacts',
    'data_extraction_capability_executions','data_extraction_capability_resources','data_extraction_evidence_items',
    'data_extraction_capability_evidence','data_extraction_semantic_observations','data_extraction_observation_support',
    'data_extraction_observation_relations','data_extraction_freshness_assessments',
    'data_extraction_provider_execution_links','instagram_intelligence_sync_jobs'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF owner_scope_id, brand_id ON %I FOR EACH ROW EXECUTE FUNCTION enforce_intelligence_owner_scope()',
      'trg_' || table_name || '_owner_scope', table_name
    );
  END LOOP;
END
$owner_scope_triggers$;

ALTER TABLE "data_extraction_capability_resources" ADD CONSTRAINT "data_extraction_capability_resources_pkey" PRIMARY KEY ("owner_scope_id", "capability_execution_ref", "resource_ref");
ALTER TABLE "data_extraction_capability_evidence" ADD CONSTRAINT "data_extraction_capability_evidence_pkey" PRIMARY KEY ("owner_scope_id", "capability_execution_ref", "evidence_ref");
ALTER TABLE "data_extraction_observation_support" ADD CONSTRAINT "data_extraction_observation_support_pkey" PRIMARY KEY ("owner_scope_id", "semantic_observation_key", "evidence_ref");
ALTER TABLE "data_extraction_observation_relations" ADD CONSTRAINT "data_extraction_observation_relations_pkey" PRIMARY KEY ("owner_scope_id", "source_observation_key", "target_observation_key", "relation_type");

ALTER TABLE "intelligence_subjects" DROP CONSTRAINT "ck_intelligence_subject_typed_binding";
ALTER TABLE "intelligence_subjects" ADD CONSTRAINT "ck_intelligence_subject_typed_binding" CHECK (
  ("subject_type" = 'BRAND' AND "brand_id" IS NOT NULL AND "subject_ref" = "brand_id" AND "offering_id" IS NULL)
  OR ("subject_type" = 'OFFERING' AND "brand_id" IS NOT NULL AND "offering_id" IS NOT NULL AND "subject_ref" = "offering_id")
  OR ("subject_type" = 'CREATOR' AND "brand_id" IS NULL AND "offering_id" IS NULL)
);

ALTER TABLE "instagram_intelligence_sync_jobs" DROP CONSTRAINT "instagram_intelligence_sync_jobs_integration_id_fkey";
ALTER TABLE "instagram_intelligence_sync_jobs" ALTER COLUMN "integration_id" DROP NOT NULL;
ALTER TABLE "instagram_intelligence_sync_jobs" ADD COLUMN "creator_integration_id" TEXT;
ALTER TABLE "instagram_intelligence_sync_jobs" ADD CONSTRAINT "fk_instagram_sync_creator_integration"
  FOREIGN KEY ("creator_integration_id") REFERENCES "creator_social_integrations"("id") ON DELETE CASCADE;
ALTER TABLE "instagram_intelligence_sync_jobs" ADD CONSTRAINT "ck_instagram_sync_exact_integration_arm" CHECK (
  (("brand_id" IS NOT NULL)::int + ("creator_integration_id" IS NOT NULL)::int) = 1
  AND ("brand_id" IS NULL OR "integration_id" IS NOT NULL)
  AND ("brand_id" IS NOT NULL OR "integration_id" IS NULL)
);
CREATE UNIQUE INDEX "uq_instagram_sync_creator_generation_class"
  ON "instagram_intelligence_sync_jobs"("owner_scope_id", "creator_integration_id", "provider_account_id", "authorization_generation", "capability_class")
  WHERE "creator_integration_id" IS NOT NULL;

CREATE UNIQUE INDEX "uq_de_resource_owner_ref" ON "data_extraction_resources"("owner_scope_id", "resource_ref");
CREATE UNIQUE INDEX "uq_de_capture_owner_ref" ON "data_extraction_captures"("owner_scope_id", "capture_ref");
CREATE UNIQUE INDEX "uq_de_capexec_owner_ref" ON "data_extraction_capability_executions"("owner_scope_id", "capability_execution_ref");
CREATE UNIQUE INDEX "uq_de_evidence_owner_ref" ON "data_extraction_evidence_items"("owner_scope_id", "evidence_ref");
CREATE UNIQUE INDEX "uq_de_observation_owner_key" ON "data_extraction_semantic_observations"("owner_scope_id", "semantic_observation_key");
CREATE UNIQUE INDEX "uq_intelligence_subject_owner_identity" ON "intelligence_subjects"("owner_scope_id", "subject_type", "subject_ref");
CREATE UNIQUE INDEX "uq_instagram_sync_owner_generation_class" ON "instagram_intelligence_sync_jobs"("owner_scope_id", "integration_id", "provider_account_id", "authorization_generation", "capability_class");
