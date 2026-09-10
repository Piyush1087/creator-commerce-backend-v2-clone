-- C-04 M2: canonical Creator subject/workspace lineage, first proposal, and
-- immutable per-Collaboration physical delivery destination.

CREATE TYPE "CollaborationAuthorityVersion" AS ENUM ('LEGACY_COMPATIBILITY', 'CANONICAL_V1');
CREATE TYPE "CollaborationDeliveryDestinationSource" AS ENUM ('C05_DEFAULT', 'COLLABORATION_OVERRIDE');

ALTER TABLE "collaborations"
  ADD COLUMN "authority_version" "CollaborationAuthorityVersion" NOT NULL DEFAULT 'LEGACY_COMPATIBILITY',
  ADD COLUMN "creator_profile_id" TEXT,
  ADD COLUMN "creator_workspace_id" TEXT;

ALTER TABLE "collaboration_commercial_agreements"
  ADD COLUMN "creator_proposed_fee" DECIMAL(14,2),
  ADD COLUMN "creator_proposal_submitted_at" TIMESTAMP(3),
  ADD COLUMN "minimum_creator_fee_snapshot" DECIMAL(14,2);

CREATE TABLE "collaboration_delivery_destinations" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "source_type" "CollaborationDeliveryDestinationSource" NOT NULL,
  "source_contact_id" TEXT,
  "source_contact_updated_at" TIMESTAMP(3),
  "recipient_name" TEXT NOT NULL,
  "address_line_1" TEXT NOT NULL,
  "address_line_2" TEXT,
  "city" TEXT NOT NULL,
  "state_region" TEXT,
  "postal_code" TEXT NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "phone_country_calling_code" VARCHAR(8),
  "phone_national_number" VARCHAR(32),
  "phone_e164" VARCHAR(20),
  "delivery_instructions" TEXT,
  "destination_content_hash" CHAR(64) NOT NULL,
  "confirmed_by_user_id" TEXT NOT NULL,
  "confirmed_by_membership_id" TEXT NOT NULL,
  "confirmed_by_role" "CreatorTeamRole" NOT NULL,
  "confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaboration_delivery_destinations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collaboration_delivery_destinations_source_provenance_check" CHECK (
    ("source_type" = 'C05_DEFAULT' AND "source_contact_id" IS NOT NULL AND "source_contact_updated_at" IS NOT NULL)
    OR ("source_type" = 'COLLABORATION_OVERRIDE' AND "source_contact_id" IS NULL AND "source_contact_updated_at" IS NULL)
  ),
  CONSTRAINT "collaboration_delivery_destinations_actor_role_check" CHECK ("confirmed_by_role" IN ('OWNER', 'MANAGER')),
  CONSTRAINT "collaboration_delivery_destinations_hash_check" CHECK ("destination_content_hash" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX "collaborations_campaign_id_creator_profile_id_idx" ON "collaborations"("campaign_id", "creator_profile_id");
CREATE INDEX "collaborations_creator_workspace_id_lifecycle_idx" ON "collaborations"("creator_workspace_id", "lifecycle");
CREATE UNIQUE INDEX "collaboration_delivery_destinations_collaboration_id_key" ON "collaboration_delivery_destinations"("collaboration_id");
CREATE INDEX "collaboration_delivery_destinations_source_contact_id_idx" ON "collaboration_delivery_destinations"("source_contact_id");

ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_creator_profile_id_fkey" FOREIGN KEY ("creator_profile_id") REFERENCES "creator_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_creator_workspace_subject_fkey" FOREIGN KEY ("creator_workspace_id", "creator_profile_id") REFERENCES "creator_workspaces"("id", "owner_profile_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "collaboration_delivery_destinations" ADD CONSTRAINT "collaboration_delivery_destinations_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaboration_commercial_agreements" ADD CONSTRAINT "collaboration_commercial_agreements_creator_proposal_check" CHECK (
  ("creator_proposed_fee" IS NULL AND "creator_proposal_submitted_at" IS NULL)
  OR ("creator_proposed_fee" IS NOT NULL AND "creator_proposal_submitted_at" IS NOT NULL)
);

ALTER TABLE "collaboration_commercial_agreements" ADD CONSTRAINT "collaboration_commercial_agreements_minimum_check" CHECK (
  "minimum_creator_fee_snapshot" IS NULL
  OR (
    ("creator_proposed_fee" IS NULL OR "creator_proposed_fee" >= "minimum_creator_fee_snapshot")
    AND ("brand_counter_fee" IS NULL OR "brand_counter_fee" >= "minimum_creator_fee_snapshot")
    AND ("agreed_creator_fee" IS NULL OR "agreed_creator_fee" >= "minimum_creator_fee_snapshot")
  )
);

-- Promote only rows whose C-03 provenance is exact. Ambiguous rows retain the
-- LEGACY_COMPATIBILITY discriminator and are never heuristically upgraded.
UPDATE "collaborations" AS c
SET "creator_profile_id" = a."subject_creator_profile_id",
    "creator_workspace_id" = a."subject_creator_workspace_id",
    "campaign_asset_id" = a."canonical_campaign_asset_id",
    "authority_version" = 'CANONICAL_V1'
FROM "uce_applications" AS a
WHERE c."source_application_id" = a."id"
  AND a."authority_version" = 'C03_CANONICAL'
  AND a."subject_creator_profile_id" IS NOT NULL
  AND a."subject_creator_workspace_id" IS NOT NULL
  AND a."canonical_campaign_asset_id" IS NOT NULL
  AND a."canonical_brief_id" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "uce_application_snapshots" s
    WHERE s."application_id" = a."id"
      AND s."schema_version" = 'C03_APPLICATION_SNAPSHOT_V1'
  );

INSERT INTO "collaboration_execution_snapshots" (
  "id", "collaboration_id", "campaign_context", "campaign_asset_context",
  "brief_context", "application_context", "creator_context", "usage_rights",
  "creator_requirements", "receives_brand_support", "physical_delivery_required",
  "brand_support_type", "brand_support_estimated_value",
  "campaign_commercial_context", "advance_percentage_snapshot",
  "commercial_currency", "locked_at"
)
SELECT gen_random_uuid()::text, c."id", s."campaign_context",
       s."campaign_asset_context", s."brief_context",
       jsonb_build_object('sourceApplicationId', a."id"), s."creator_identity",
       s."brief_context"->'usageRights', s."brief_context"->>'creatorRequirements',
       COALESCE((s."commercial_context"->>'receivesBrandSupport')::boolean, false),
       COALESCE(s."commercial_context"->>'brandSupportType', '') = 'PRODUCT',
       CASE WHEN s."commercial_context"->>'brandSupportType' IN ('PRODUCT','SERVICE','EXPERIENCE','ACCESS_SUBSCRIPTION','OTHER')
         THEN (s."commercial_context"->>'brandSupportType')::"UceBrandSupportType" ELSE NULL END,
       CASE WHEN s."commercial_context"->>'brandSupportEstimatedValue' ~ '^\d+(\.\d{1,2})?$'
         THEN (s."commercial_context"->>'brandSupportEstimatedValue')::decimal ELSE NULL END,
       s."commercial_context", 0, s."commercial_context"->>'currency', s."created_at"
FROM "collaborations" c
JOIN "uce_applications" a ON a."id" = c."source_application_id"
JOIN "uce_application_snapshots" s ON s."application_id" = a."id"
WHERE c."authority_version" = 'CANONICAL_V1'
ON CONFLICT ("collaboration_id") DO NOTHING;

INSERT INTO "collaboration_commercial_agreements" (
  "id", "collaboration_id", "negotiation_state", "creator_proposed_fee",
  "minimum_creator_fee_snapshot", "agreed_creator_fee", "currency",
  "advance_percentage_snapshot", "payment_rail", "terms_locked_at"
)
SELECT gen_random_uuid()::text, c."id",
       CASE WHEN s."commercial_context"->>'compensationModel' = 'FIXED'
         THEN 'NOT_REQUIRED'::"CollaborationNegotiationState"
         ELSE 'AWAITING_CREATOR_PROPOSAL'::"CollaborationNegotiationState" END,
       NULL,
       CASE WHEN s."commercial_context"->>'compensationModel' = 'NEGOTIABLE'
         THEN (s."commercial_context"->>'offer')::decimal ELSE NULL END,
       CASE WHEN s."commercial_context"->>'compensationModel' = 'FIXED'
         THEN (s."commercial_context"->>'offer')::decimal ELSE NULL END,
       s."commercial_context"->>'currency', 0, 'PLATFORM_ESCROW',
       CASE WHEN s."commercial_context"->>'compensationModel' = 'FIXED'
         THEN s."created_at" ELSE NULL END
FROM "collaborations" c
JOIN "uce_applications" a ON a."id" = c."source_application_id"
JOIN "uce_application_snapshots" s ON s."application_id" = a."id"
WHERE c."authority_version" = 'CANONICAL_V1'
ON CONFLICT ("collaboration_id") DO NOTHING;

INSERT INTO "collaboration_fulfillments" (
  "id", "collaboration_id", "state", "issue_count", "created_at", "updated_at"
)
SELECT gen_random_uuid()::text, c."id", 'NOT_STARTED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "collaborations" c
WHERE c."authority_version" = 'CANONICAL_V1'
ON CONFLICT ("collaboration_id") DO NOTHING;

INSERT INTO "collaboration_deliverable_executions" (
  "id", "collaboration_id", "source_brief_deliverable_id", "display_order",
  "definition_snapshot", "state", "revision_request_count",
  "publishing_required", "created_at", "updated_at"
)
SELECT gen_random_uuid()::text, c."id", d."deliverable_id",
       COALESCE(d."display_order", 0), to_jsonb(d), 'AWAITING_SUBMISSION', 0,
       COALESCE(d."publishing_required", false), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "collaborations" c
JOIN "uce_applications" a ON a."id" = c."source_application_id"
JOIN "campaign_brief_deliverables" d ON d."brief_id" = a."canonical_brief_id"
WHERE c."authority_version" = 'CANONICAL_V1'
ON CONFLICT ("collaboration_id", "source_brief_deliverable_id") DO NOTHING;

INSERT INTO "collaboration_publishing_executions" (
  "id", "deliverable_execution_id", "state", "authorization_state",
  "created_at", "updated_at"
)
SELECT gen_random_uuid()::text, d."id",
       CASE WHEN d."publishing_required" THEN 'AWAITING_PUBLISHING' ELSE 'PUBLISHING_NOT_REQUIRED' END::"CollaborationPublishingState",
       CASE WHEN d."publishing_required" THEN 'NOT_AUTHORIZED' ELSE 'NOT_REQUIRED' END::"CollaborationPublicationAuthorizationState",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "collaboration_deliverable_executions" d
ON CONFLICT ("deliverable_execution_id") DO NOTHING;

INSERT INTO "collaboration_events" (
  "id", "collaboration_id", "kind", "event_type", "actor_class",
  "aggregate_version", "payload", "occurred_at"
)
SELECT gen_random_uuid()::text, c."id", 'AUDIT', 'COLLABORATION_CONVERGED',
       'SYSTEM', c."aggregate_version",
       jsonb_build_object('sourceApplicationId', c."source_application_id"),
       CURRENT_TIMESTAMP
FROM "collaborations" c
WHERE c."authority_version" = 'CANONICAL_V1'
ON CONFLICT ("collaboration_id", "aggregate_version") DO NOTHING;
