-- C-03 P1.1B: canonical Application shape and immutable snapshot foundation.
-- Existing rows remain LEGACY_COMPATIBILITY. Canonical writes stay closed
-- until P1.1D installs the complete transition/event invariant set.

BEGIN;

CREATE TYPE "UceApplicationAuthorityVersion" AS ENUM (
  'LEGACY_COMPATIBILITY',
  'C03_CANONICAL'
);

CREATE TYPE "UceApplicationSnapshotVersion" AS ENUM (
  'C03_APPLICATION_SNAPSHOT_V1'
);

ALTER TABLE "uce_applications"
  ADD COLUMN "authority_version" "UceApplicationAuthorityVersion" NOT NULL
    DEFAULT 'LEGACY_COMPATIBILITY',
  ADD COLUMN "brand_profile_id" TEXT,
  ADD COLUMN "canonical_campaign_asset_id" TEXT,
  ADD COLUMN "canonical_brief_id" TEXT,
  ADD COLUMN "subject_creator_profile_id" TEXT,
  ADD COLUMN "subject_creator_workspace_id" TEXT,
  ADD COLUMN "actor_user_id" TEXT,
  ADD COLUMN "actor_membership_id" TEXT,
  ADD COLUMN "actor_role" "CreatorTeamRole",
  ADD COLUMN "campaign_invitation_id" TEXT,
  ADD COLUMN "first_qualified_touch_id" TEXT,
  ADD COLUMN "conversion_touch_id" TEXT,
  ADD COLUMN "status_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "terminal_at" TIMESTAMP(3),
  ALTER COLUMN "request_id" DROP NOT NULL,
  ALTER COLUMN "campaign_creator_id" DROP NOT NULL,
  ALTER COLUMN "campaign_asset_id" DROP NOT NULL,
  ALTER COLUMN "brief_id" DROP NOT NULL;

-- This explicit projection documents the only authorized backfill. Defaults
-- already produce the same values on PostgreSQL's fast path; no legacy row is
-- promoted and no identity is inferred.
UPDATE "uce_applications"
SET "authority_version" = 'LEGACY_COMPATIBILITY'::"UceApplicationAuthorityVersion",
    "status_version" = 0;

ALTER TABLE "uce_applications"
  ADD CONSTRAINT "uce_applications_authority_shape_check" CHECK (
    (
      "authority_version" = 'LEGACY_COMPATIBILITY'::"UceApplicationAuthorityVersion"
      AND "request_id" IS NOT NULL
      AND "campaign_creator_id" IS NOT NULL
      AND "campaign_asset_id" IS NOT NULL
      AND "brief_id" IS NOT NULL
      AND "brand_profile_id" IS NULL
      AND "canonical_campaign_asset_id" IS NULL
      AND "canonical_brief_id" IS NULL
      AND "subject_creator_profile_id" IS NULL
      AND "subject_creator_workspace_id" IS NULL
      AND "actor_user_id" IS NULL
      AND "actor_membership_id" IS NULL
      AND "actor_role" IS NULL
      AND "campaign_invitation_id" IS NULL
      AND "first_qualified_touch_id" IS NULL
      AND "conversion_touch_id" IS NULL
      AND "status_version" = 0
      AND "terminal_at" IS NULL
    ) OR (
      "authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
      AND "request_id" IS NULL
      AND "campaign_asset_id" IS NULL
      AND "brief_id" IS NULL
      AND "brand_profile_id" IS NOT NULL
      AND "canonical_campaign_asset_id" IS NOT NULL
      AND "canonical_brief_id" IS NOT NULL
      AND "subject_creator_profile_id" IS NOT NULL
      AND "subject_creator_workspace_id" IS NOT NULL
      AND "actor_user_id" IS NOT NULL
      AND "actor_membership_id" IS NOT NULL
      AND "actor_role" IS NOT NULL
      AND "approved_at" IS NULL
      AND "rejected_at" IS NULL
      AND "withdrawn_at" IS NULL
      AND "expired_at" IS NULL
      AND "superseded_at" IS NULL
      AND "superseded_by_application_id" IS NULL
      AND "status_version" >= 1
    )
  );

ALTER TABLE "creator_workspaces"
  ADD CONSTRAINT "creator_workspaces_id_owner_profile_id_key"
  UNIQUE ("id", "owner_profile_id");

ALTER TABLE "uce_applications"
  ADD CONSTRAINT "uce_applications_campaign_id_brand_profile_id_fkey"
    FOREIGN KEY ("campaign_id", "brand_profile_id")
    REFERENCES "uce_campaigns"("id", "brand_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_campaign_id_canonical_campaign_asset_id_fkey"
    FOREIGN KEY ("campaign_id", "canonical_campaign_asset_id")
    REFERENCES "uce_campaign_assets"("campaign_id", "campaign_asset_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_canonical_campaign_asset_id_canonical_brief_id_fkey"
    FOREIGN KEY ("canonical_campaign_asset_id", "canonical_brief_id")
    REFERENCES "campaign_briefs"("campaign_asset_id", "brief_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_subject_workspace_owner_fkey"
    FOREIGN KEY ("subject_creator_workspace_id", "subject_creator_profile_id")
    REFERENCES "creator_workspaces"("id", "owner_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_actor_membership_id_fkey"
    FOREIGN KEY ("actor_membership_id") REFERENCES "creator_workspace_members"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "uce_applications_canonical_active_opportunity_key"
  ON "uce_applications"(
    "subject_creator_profile_id",
    "campaign_id",
    "canonical_campaign_asset_id",
    "canonical_brief_id"
  )
  WHERE "authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    AND "status" IN (
      'PENDING'::"UceApplicationStatus",
      'APPROVED'::"UceApplicationStatus",
      'REJECTED'::"UceApplicationStatus",
      'SUPERSEDED'::"UceApplicationStatus"
    );

CREATE INDEX "uce_applications_canonical_creator_campaign_count_idx"
  ON "uce_applications"(
    "subject_creator_profile_id", "campaign_id", "status", "applied_at" DESC
  )
  WHERE "authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    AND "status" <> 'WITHDRAWN'::"UceApplicationStatus";

CREATE INDEX "uce_applications_canonical_creator_brand_count_idx"
  ON "uce_applications"(
    "subject_creator_profile_id", "brand_profile_id", "status", "applied_at" DESC
  )
  WHERE "authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    AND "status" <> 'WITHDRAWN'::"UceApplicationStatus";

CREATE INDEX "uce_applications_canonical_workspace_history_idx"
  ON "uce_applications"(
    "subject_creator_workspace_id", "applied_at" DESC, "id" DESC
  )
  WHERE "authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion";

CREATE INDEX "uce_applications_canonical_brand_applicants_idx"
  ON "uce_applications"(
    "brand_profile_id", "campaign_id", "status", "applied_at" DESC
  )
  WHERE "authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion";

CREATE INDEX "uce_applications_campaign_invitation_id_idx"
  ON "uce_applications"("campaign_invitation_id");
CREATE INDEX "uce_applications_first_qualified_touch_id_idx"
  ON "uce_applications"("first_qualified_touch_id");
CREATE INDEX "uce_applications_conversion_touch_id_idx"
  ON "uce_applications"("conversion_touch_id");
CREATE INDEX "uce_applications_actor_membership_id_idx"
  ON "uce_applications"("actor_membership_id");

ALTER TABLE "uce_application_snapshots"
  ADD COLUMN "schema_version" "UceApplicationSnapshotVersion",
  ADD COLUMN "actor_context" JSONB,
  ADD COLUMN "attribution_context" JSONB;

ALTER TABLE "uce_application_snapshots"
  DROP CONSTRAINT "uce_application_snapshots_application_id_fkey",
  ADD CONSTRAINT "uce_application_snapshots_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "uce_applications"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION "c03_reject_canonical_application_until_guards"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion" THEN
    RAISE EXCEPTION 'C03_CANONICAL_APPLICATION_WRITE_CLOSED'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_canonical_application_write_closed"
BEFORE INSERT OR UPDATE ON "uce_applications"
FOR EACH ROW
EXECUTE FUNCTION "c03_reject_canonical_application_until_guards"();

COMMIT;
