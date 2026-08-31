-- CreateEnum
CREATE TYPE "IntelligenceSubjectType" AS ENUM ('BRAND', 'OFFERING');

-- DropForeignKey
ALTER TABLE "intelligence_actions" DROP CONSTRAINT "intelligence_actions_processor_execution_id_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_candidates" DROP CONSTRAINT "intelligence_component_candidates_basis_current_component__fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_candidates" DROP CONSTRAINT "intelligence_component_candidates_candidate_component_gene_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_candidates" DROP CONSTRAINT "intelligence_component_candidates_current_component_id_bra_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_candidates" DROP CONSTRAINT "intelligence_component_candidates_producer_action_id_brand_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_candidates" DROP CONSTRAINT "intelligence_component_candidates_producer_execution_id_br_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_candidates" DROP CONSTRAINT "intelligence_component_candidates_resolution_action_id_bra_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_generations" DROP CONSTRAINT "intelligence_component_generations_object_generation_id_br_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_generations" DROP CONSTRAINT "intelligence_component_generations_supersedes_component_ge_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_action_id_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_candidate_id_brand_id_o_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_current_component_id_br_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_expected_generation_id__fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_from_generation_id_bran_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_observed_generation_id__fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_proposed_generation_id__fkey";

-- DropForeignKey
ALTER TABLE "intelligence_component_transitions" DROP CONSTRAINT "intelligence_component_transitions_to_generation_id_brand__fkey";

-- DropForeignKey
ALTER TABLE "intelligence_current_components" DROP CONSTRAINT "intelligence_current_components_current_component_generati_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_object_generations" DROP CONSTRAINT "intelligence_object_generations_action_id_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_object_generations" DROP CONSTRAINT "intelligence_object_generations_based_on_object_generation_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_object_generations" DROP CONSTRAINT "intelligence_object_generations_processor_execution_id_bra_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_object_generations" DROP CONSTRAINT "intelligence_object_generations_supersedes_object_generati_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_processor_executions" DROP CONSTRAINT "intelligence_processor_executions_execution_id_brand_id_fkey";

-- DropIndex
DROP INDEX "idx_intelligence_action_brand_timeline";

-- DropIndex
DROP INDEX "uq_intelligence_action_request";

-- DropIndex
DROP INDEX "uq_intelligence_candidate_full_address";

-- DropIndex
DROP INDEX "idx_intelligence_component_generation_history";

-- DropIndex
DROP INDEX "uq_intelligence_component_generation_address";

-- DropIndex
DROP INDEX "uq_intelligence_component_generation_supersedes";

-- DropIndex
DROP INDEX "uq_intelligence_component_transition_action_path";

-- DropIndex
DROP INDEX "idx_intelligence_current_component_freshness";

-- DropIndex
DROP INDEX "idx_intelligence_current_component_object";

-- DropIndex
DROP INDEX "idx_intelligence_current_component_path";

-- DropIndex
DROP INDEX "idx_intelligence_current_component_protection";

-- DropIndex
DROP INDEX "uq_intelligence_current_component_address";

-- DropIndex
DROP INDEX "uq_intelligence_current_component_full_address";

-- DropIndex
DROP INDEX "idx_intelligence_execution_brand_created";

-- DropIndex
DROP INDEX "uq_intelligence_execution_trigger";

-- DropIndex
DROP INDEX "idx_intelligence_object_generation_history";

-- DropIndex
DROP INDEX "uq_intelligence_object_generation_address";

-- DropIndex
DROP INDEX "uq_intelligence_object_generation_supersedes";

-- DropIndex
DROP INDEX "idx_intelligence_processor_brand_version";

-- AlterTable
ALTER TABLE "intelligence_actions" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_component_candidates" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_component_generations" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_component_transitions" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_current_components" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_executions" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_object_generations" ADD COLUMN     "subject_id" TEXT;

-- AlterTable
ALTER TABLE "intelligence_processor_executions" ADD COLUMN     "processor_key_version" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "subject_id" TEXT;

-- CreateTable
CREATE TABLE "intelligence_subjects" (
    "subject_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "subject_type" "IntelligenceSubjectType" NOT NULL,
    "subject_ref" VARCHAR(255) NOT NULL,
    "offering_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_subjects_pkey" PRIMARY KEY ("subject_id")
);

-- One canonical BRAND subject is materialized for every Brand so legacy
-- Brand-only call sites have an exact, durable compatibility scope.
INSERT INTO "intelligence_subjects" (
  "subject_id",
  "brand_id",
  "subject_type",
  "subject_ref",
  "offering_id",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  "id",
  'BRAND'::"IntelligenceSubjectType",
  "id",
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "brand_profiles";

-- Preserve historical processor keys exactly and label their original material.
UPDATE "intelligence_processor_executions"
SET "processor_key_version" = 1;

-- Attach the existing Brand-scoped lineage from roots toward semantic addresses.
UPDATE "intelligence_executions" AS target
SET "subject_id" = subject."subject_id"
FROM "intelligence_subjects" AS subject
WHERE subject."brand_id" = target."brand_id"
  AND subject."subject_type" = 'BRAND'::"IntelligenceSubjectType";

UPDATE "intelligence_processor_executions" AS target
SET "subject_id" = parent."subject_id"
FROM "intelligence_executions" AS parent
WHERE parent."execution_id" = target."execution_id"
  AND parent."brand_id" = target."brand_id";

UPDATE "intelligence_actions" AS target
SET "subject_id" = parent."subject_id"
FROM "intelligence_processor_executions" AS parent
WHERE parent."processor_execution_id" = target."processor_execution_id"
  AND parent."brand_id" = target."brand_id";

UPDATE "intelligence_actions" AS target
SET "subject_id" = subject."subject_id"
FROM "intelligence_subjects" AS subject
WHERE target."subject_id" IS NULL
  AND subject."brand_id" = target."brand_id"
  AND subject."subject_type" = 'BRAND'::"IntelligenceSubjectType";

UPDATE "intelligence_object_generations" AS target
SET "subject_id" = processor."subject_id"
FROM "intelligence_processor_executions" AS processor
WHERE processor."processor_execution_id" = target."processor_execution_id"
  AND processor."brand_id" = target."brand_id";

-- The producer check guarantees exactly one root.
UPDATE "intelligence_object_generations" AS target
SET "subject_id" = action."subject_id"
FROM "intelligence_actions" AS action
WHERE target."subject_id" IS NULL
  AND action."action_id" = target."action_id"
  AND action."brand_id" = target."brand_id";

UPDATE "intelligence_component_generations" AS target
SET "subject_id" = parent."subject_id"
FROM "intelligence_object_generations" AS parent
WHERE parent."object_generation_id" = target."object_generation_id"
  AND parent."brand_id" = target."brand_id";

UPDATE "intelligence_current_components" AS target
SET "subject_id" = generation."subject_id"
FROM "intelligence_component_generations" AS generation
WHERE generation."component_generation_id" = target."current_component_generation_id"
  AND generation."brand_id" = target."brand_id";

UPDATE "intelligence_component_candidates" AS target
SET "subject_id" = current_component."subject_id"
FROM "intelligence_current_components" AS current_component
WHERE current_component."current_component_id" = target."current_component_id"
  AND current_component."brand_id" = target."brand_id";

UPDATE "intelligence_component_transitions" AS target
SET "subject_id" = action."subject_id"
FROM "intelligence_actions" AS action
WHERE action."action_id" = target."action_id"
  AND action."brand_id" = target."brand_id";

-- Fail the migration before non-null/FK enforcement if any legacy lineage could
-- not be attached or if a child disagrees with its durable parent subject.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT "brand_id", "subject_id" FROM "intelligence_executions"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_processor_executions"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_actions"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_object_generations"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_component_generations"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_current_components"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_component_candidates"
      UNION ALL SELECT "brand_id", "subject_id" FROM "intelligence_component_transitions"
    ) AS scoped
    WHERE scoped."subject_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Intelligence subject backfill left orphan lineage';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT child."brand_id", child."subject_id", parent."subject_id" AS parent_subject
      FROM "intelligence_processor_executions" child
      JOIN "intelligence_executions" parent ON parent."execution_id" = child."execution_id"
      UNION ALL
      SELECT child."brand_id", child."subject_id", parent."subject_id"
      FROM "intelligence_component_generations" child
      JOIN "intelligence_object_generations" parent ON parent."object_generation_id" = child."object_generation_id"
      UNION ALL
      SELECT child."brand_id", child."subject_id", parent."subject_id"
      FROM "intelligence_current_components" child
      JOIN "intelligence_component_generations" parent ON parent."component_generation_id" = child."current_component_generation_id"
      UNION ALL
      SELECT child."brand_id", child."subject_id", parent."subject_id"
      FROM "intelligence_component_candidates" child
      JOIN "intelligence_current_components" parent ON parent."current_component_id" = child."current_component_id"
      UNION ALL
      SELECT child."brand_id", child."subject_id", parent."subject_id"
      FROM "intelligence_component_transitions" child
      JOIN "intelligence_actions" parent ON parent."action_id" = child."action_id"
    ) AS lineage
    WHERE lineage."subject_id" <> lineage.parent_subject
  ) THEN
    RAISE EXCEPTION 'Intelligence subject backfill found cross-subject lineage';
  END IF;
END $$;

ALTER TABLE "intelligence_executions" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_processor_executions" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_actions" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_object_generations" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_component_generations" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_current_components" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_component_candidates" ALTER COLUMN "subject_id" SET NOT NULL;
ALTER TABLE "intelligence_component_transitions" ALTER COLUMN "subject_id" SET NOT NULL;

ALTER TABLE "intelligence_subjects"
  ADD CONSTRAINT "ck_intelligence_subject_typed_binding"
  CHECK (
    ("subject_type" = 'BRAND' AND "subject_ref" = "brand_id" AND "offering_id" IS NULL)
    OR
    ("subject_type" = 'OFFERING' AND "offering_id" IS NOT NULL AND "subject_ref" = "offering_id")
  );

-- CreateIndex
CREATE INDEX "idx_intelligence_subject_brand_type" ON "intelligence_subjects"("brand_id", "subject_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_subject_identity" ON "intelligence_subjects"("brand_id", "subject_type", "subject_ref");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_subject_id_brand" ON "intelligence_subjects"("subject_id", "brand_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_action_subject_timeline" ON "intelligence_actions"("brand_id", "subject_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_action_request" ON "intelligence_actions"("brand_id", "subject_id", "action_type", "request_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_action_id_brand_subject" ON "intelligence_actions"("action_id", "brand_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_candidate_full_address" ON "intelligence_component_candidates"("component_candidate_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_component_generation_history" ON "intelligence_component_generations"("brand_id", "subject_id", "object_semantic_id", "component_semantic_path", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_generation_address" ON "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_generation_supersedes" ON "intelligence_component_generations"("supersedes_component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_component_transition_action_path" ON "intelligence_component_transitions"("action_id", "subject_id", "object_semantic_id", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_object" ON "intelligence_current_components"("brand_id", "subject_id", "object_semantic_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_path" ON "intelligence_current_components"("brand_id", "subject_id", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_freshness" ON "intelligence_current_components"("brand_id", "subject_id", "current_freshness");

-- CreateIndex
CREATE INDEX "idx_intelligence_current_component_protection" ON "intelligence_current_components"("brand_id", "subject_id", "protection_state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_current_component_address" ON "intelligence_current_components"("brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_current_component_full_address" ON "intelligence_current_components"("current_component_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");

-- CreateIndex
CREATE INDEX "idx_intelligence_execution_subject_created" ON "intelligence_executions"("brand_id", "subject_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_execution_trigger" ON "intelligence_executions"("brand_id", "subject_id", "trigger_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_execution_id_brand_subject" ON "intelligence_executions"("execution_id", "brand_id", "subject_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_object_generation_history" ON "intelligence_object_generations"("brand_id", "subject_id", "object_semantic_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_id_brand_subject" ON "intelligence_object_generations"("object_generation_id", "brand_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_address" ON "intelligence_object_generations"("object_generation_id", "brand_id", "subject_id", "object_semantic_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_object_generation_supersedes" ON "intelligence_object_generations"("supersedes_object_generation_id", "brand_id", "subject_id", "object_semantic_id");

-- CreateIndex
CREATE INDEX "idx_intelligence_processor_subject_version" ON "intelligence_processor_executions"("brand_id", "subject_id", "processor_id", "processor_version", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_intelligence_processor_execution_id_brand_subject" ON "intelligence_processor_executions"("processor_execution_id", "brand_id", "subject_id");

-- AddForeignKey
ALTER TABLE "intelligence_subjects" ADD CONSTRAINT "intelligence_subjects_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brand_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_subjects" ADD CONSTRAINT "intelligence_subjects_brand_id_offering_id_fkey" FOREIGN KEY ("brand_id", "offering_id") REFERENCES "offerings"("brand_profile_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_executions" ADD CONSTRAINT "intelligence_executions_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_processor_executions" ADD CONSTRAINT "intelligence_processor_executions_execution_id_brand_id_su_fkey" FOREIGN KEY ("execution_id", "brand_id", "subject_id") REFERENCES "intelligence_executions"("execution_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_processor_executions" ADD CONSTRAINT "intelligence_processor_executions_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_actions" ADD CONSTRAINT "intelligence_actions_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_actions" ADD CONSTRAINT "intelligence_actions_processor_execution_id_brand_id_subje_fkey" FOREIGN KEY ("processor_execution_id", "brand_id", "subject_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_processor_execution_id_bra_fkey" FOREIGN KEY ("processor_execution_id", "brand_id", "subject_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_action_id_brand_id_subject_fkey" FOREIGN KEY ("action_id", "brand_id", "subject_id") REFERENCES "intelligence_actions"("action_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_based_on_object_generation_fkey" FOREIGN KEY ("based_on_object_generation_id", "brand_id", "subject_id", "object_semantic_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id", "subject_id", "object_semantic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_object_generations" ADD CONSTRAINT "intelligence_object_generations_supersedes_object_generati_fkey" FOREIGN KEY ("supersedes_object_generation_id", "brand_id", "subject_id", "object_semantic_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id", "subject_id", "object_semantic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_generations" ADD CONSTRAINT "intelligence_component_generations_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_generations" ADD CONSTRAINT "intelligence_component_generations_object_generation_id_br_fkey" FOREIGN KEY ("object_generation_id", "brand_id", "subject_id", "object_semantic_id") REFERENCES "intelligence_object_generations"("object_generation_id", "brand_id", "subject_id", "object_semantic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_generations" ADD CONSTRAINT "intelligence_component_generations_supersedes_component_ge_fkey" FOREIGN KEY ("supersedes_component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_current_components" ADD CONSTRAINT "intelligence_current_components_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_current_components" ADD CONSTRAINT "intelligence_current_components_current_component_generati_fkey" FOREIGN KEY ("current_component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_current_component_id_bra_fkey" FOREIGN KEY ("current_component_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_current_components"("current_component_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_candidate_component_gene_fkey" FOREIGN KEY ("candidate_component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_basis_current_component__fkey" FOREIGN KEY ("basis_current_component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_producer_execution_id_br_fkey" FOREIGN KEY ("producer_execution_id", "brand_id", "subject_id") REFERENCES "intelligence_processor_executions"("processor_execution_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_producer_action_id_brand_fkey" FOREIGN KEY ("producer_action_id", "brand_id", "subject_id") REFERENCES "intelligence_actions"("action_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_candidates" ADD CONSTRAINT "intelligence_component_candidates_resolution_action_id_bra_fkey" FOREIGN KEY ("resolution_action_id", "brand_id", "subject_id") REFERENCES "intelligence_actions"("action_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_subject_id_brand_id_fkey" FOREIGN KEY ("subject_id", "brand_id") REFERENCES "intelligence_subjects"("subject_id", "brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_action_id_brand_id_subj_fkey" FOREIGN KEY ("action_id", "brand_id", "subject_id") REFERENCES "intelligence_actions"("action_id", "brand_id", "subject_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_current_component_id_br_fkey" FOREIGN KEY ("current_component_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_current_components"("current_component_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_from_generation_id_bran_fkey" FOREIGN KEY ("from_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_expected_generation_id__fkey" FOREIGN KEY ("expected_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_observed_generation_id__fkey" FOREIGN KEY ("observed_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_proposed_generation_id__fkey" FOREIGN KEY ("proposed_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_to_generation_id_brand__fkey" FOREIGN KEY ("to_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_generations"("component_generation_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_component_transitions" ADD CONSTRAINT "intelligence_component_transitions_candidate_id_brand_id_s_fkey" FOREIGN KEY ("candidate_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") REFERENCES "intelligence_component_candidates"("component_candidate_id", "brand_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path") ON DELETE RESTRICT ON UPDATE CASCADE;
