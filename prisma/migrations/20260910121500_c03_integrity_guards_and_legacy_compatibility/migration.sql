-- C-03 P1.1D: permanent Application evidence/transition guards and final
-- continuation immutability. This atomically replaces the temporary P1.1B
-- canonical-write closure only after the permanent functions are defined.

BEGIN;

ALTER TABLE "uce_applications"
  ADD CONSTRAINT "uce_applications_canonical_lifecycle_shape_check" CHECK (
    "authority_version" = 'LEGACY_COMPATIBILITY'::"UceApplicationAuthorityVersion"
    OR (
      "status" = 'PENDING'::"UceApplicationStatus"
      AND "status_version" = 1
      AND "terminal_at" IS NULL
    ) OR (
      "status" IN (
        'APPROVED'::"UceApplicationStatus",
        'REJECTED'::"UceApplicationStatus",
        'WITHDRAWN'::"UceApplicationStatus",
        'EXPIRED'::"UceApplicationStatus"
      )
      AND "status_version" = 2
      AND "terminal_at" IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION "c03_canonical_application_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  actor_is_valid BOOLEAN;
  reference_is_valid BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'C03_APPLICATION_DELETE_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    OLD."authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    OR NEW."authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
  ) THEN
    IF NEW."authority_version" IS DISTINCT FROM OLD."authority_version"
      OR NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id"
      OR NEW."brand_profile_id" IS DISTINCT FROM OLD."brand_profile_id"
      OR NEW."campaign_creator_id" IS DISTINCT FROM OLD."campaign_creator_id"
      OR NEW."canonical_campaign_asset_id" IS DISTINCT FROM OLD."canonical_campaign_asset_id"
      OR NEW."canonical_brief_id" IS DISTINCT FROM OLD."canonical_brief_id"
      OR NEW."subject_creator_profile_id" IS DISTINCT FROM OLD."subject_creator_profile_id"
      OR NEW."subject_creator_workspace_id" IS DISTINCT FROM OLD."subject_creator_workspace_id"
      OR NEW."actor_user_id" IS DISTINCT FROM OLD."actor_user_id"
      OR NEW."actor_membership_id" IS DISTINCT FROM OLD."actor_membership_id"
      OR NEW."actor_role" IS DISTINCT FROM OLD."actor_role"
      OR NEW."campaign_invitation_id" IS DISTINCT FROM OLD."campaign_invitation_id"
      OR NEW."first_qualified_touch_id" IS DISTINCT FROM OLD."first_qualified_touch_id"
      OR NEW."conversion_touch_id" IS DISTINCT FROM OLD."conversion_touch_id"
      OR NEW."source" IS DISTINCT FROM OLD."source"
      OR NEW."applied_at" IS DISTINCT FROM OLD."applied_at"
      OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    THEN
      RAISE EXCEPTION 'C03_APPLICATION_AUTHORITY_IMMUTABLE'
        USING ERRCODE = '23514';
    END IF;

    IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
      IF NEW."status_version" IS DISTINCT FROM OLD."status_version"
        OR NEW."terminal_at" IS DISTINCT FROM OLD."terminal_at"
      THEN
        RAISE EXCEPTION 'C03_APPLICATION_VERSION_WITHOUT_TRANSITION'
          USING ERRCODE = '23514';
      END IF;
    ELSIF OLD."status" <> 'PENDING'::"UceApplicationStatus"
      OR NEW."status" NOT IN (
        'APPROVED'::"UceApplicationStatus",
        'REJECTED'::"UceApplicationStatus",
        'WITHDRAWN'::"UceApplicationStatus",
        'EXPIRED'::"UceApplicationStatus"
      )
      OR NEW."status_version" <> OLD."status_version" + 1
      OR NEW."terminal_at" IS NULL
    THEN
      RAISE EXCEPTION 'C03_APPLICATION_TRANSITION_INVALID'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."authority_version" = 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    AND TG_OP = 'INSERT'
  THEN
    IF NEW."status" <> 'PENDING'::"UceApplicationStatus"
      OR NEW."status_version" <> 1
      OR NEW."terminal_at" IS NOT NULL
    THEN
      RAISE EXCEPTION 'C03_APPLICATION_INITIAL_STATE_INVALID'
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM "creator_workspace_members" AS member
      WHERE member."id" = NEW."actor_membership_id"
        AND member."workspace_id" = NEW."subject_creator_workspace_id"
        AND member."user_id" = NEW."actor_user_id"
        AND member."security_role_token" = NEW."actor_role"
        AND member."is_active_active" = TRUE
    ) INTO actor_is_valid;

    IF NOT actor_is_valid THEN
      RAISE EXCEPTION 'C03_APPLICATION_ACTOR_EVIDENCE_INVALID'
        USING ERRCODE = '23503';
    END IF;

    IF NEW."campaign_invitation_id" IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM "campaign_opportunity_invitations" AS invitation
        WHERE invitation."id" = NEW."campaign_invitation_id"
          AND invitation."campaign_id" = NEW."campaign_id"
          AND invitation."binding_version" = 1
          AND invitation."bound_creator_profile_id" = NEW."subject_creator_profile_id"
          AND invitation."bound_creator_workspace_id" = NEW."subject_creator_workspace_id"
      ) INTO reference_is_valid;
      IF NOT reference_is_valid THEN
        RAISE EXCEPTION 'C03_APPLICATION_INVITATION_SUBJECT_MISMATCH'
          USING ERRCODE = '23503';
      END IF;
    END IF;

    IF NEW."first_qualified_touch_id" IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM "campaign_ingress_touches" AS touch
        WHERE touch."id" = NEW."first_qualified_touch_id"
          AND touch."campaign_id" = NEW."campaign_id"
          AND touch."kind" = 'QUALIFIED_INGRESS'::"CampaignIngressTouchKind"
          AND touch."bound_creator_profile_id" = NEW."subject_creator_profile_id"
          AND touch."bound_creator_workspace_id" = NEW."subject_creator_workspace_id"
      ) INTO reference_is_valid;
      IF NOT reference_is_valid THEN
        RAISE EXCEPTION 'C03_APPLICATION_FIRST_TOUCH_SUBJECT_MISMATCH'
          USING ERRCODE = '23503';
      END IF;
    END IF;

    IF NEW."conversion_touch_id" IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM "campaign_ingress_touches" AS touch
        WHERE touch."id" = NEW."conversion_touch_id"
          AND touch."campaign_id" = NEW."campaign_id"
          AND touch."kind" = 'APPLICATION_CONVERSION'::"CampaignIngressTouchKind"
          AND touch."bound_creator_profile_id" = NEW."subject_creator_profile_id"
          AND touch."bound_creator_workspace_id" = NEW."subject_creator_workspace_id"
      ) INTO reference_is_valid;
      IF NOT reference_is_valid THEN
        RAISE EXCEPTION 'C03_APPLICATION_CONVERSION_TOUCH_SUBJECT_MISMATCH'
          USING ERRCODE = '23503';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_canonical_application_insert_guard"
BEFORE INSERT ON "uce_applications"
FOR EACH ROW EXECUTE FUNCTION "c03_canonical_application_guard"();

CREATE TRIGGER "c03_canonical_application_update_guard"
BEFORE UPDATE ON "uce_applications"
FOR EACH ROW EXECUTE FUNCTION "c03_canonical_application_guard"();

CREATE TRIGGER "c03_application_delete_guard"
BEFORE DELETE ON "uce_applications"
FOR EACH ROW EXECUTE FUNCTION "c03_canonical_application_guard"();

CREATE OR REPLACE FUNCTION "c03_application_snapshot_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  application_authority "UceApplicationAuthorityVersion";
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'C03_APPLICATION_SNAPSHOT_IMMUTABLE'
      USING ERRCODE = '23514';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'C03_APPLICATION_SNAPSHOT_DELETE_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  SELECT "authority_version" INTO application_authority
  FROM "uce_applications"
  WHERE "id" = NEW."application_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'C03_SNAPSHOT_APPLICATION_NOT_FOUND'
      USING ERRCODE = '23503';
  END IF;

  IF application_authority = 'C03_CANONICAL'::"UceApplicationAuthorityVersion" THEN
    IF NEW."schema_version" IS DISTINCT FROM
        'C03_APPLICATION_SNAPSHOT_V1'::"UceApplicationSnapshotVersion"
      OR NEW."actor_context" IS NULL
      OR NEW."attribution_context" IS NULL
      OR jsonb_typeof(NEW."campaign_context") <> 'object'
      OR jsonb_typeof(NEW."campaign_asset_context") <> 'object'
      OR jsonb_typeof(NEW."brief_context") <> 'object'
      OR jsonb_typeof(NEW."commercial_context") <> 'object'
      OR jsonb_typeof(NEW."creator_identity") <> 'object'
      OR jsonb_typeof(NEW."actor_context") <> 'object'
      OR jsonb_typeof(NEW."attribution_context") <> 'object'
    THEN
      RAISE EXCEPTION 'C03_APPLICATION_SNAPSHOT_SHAPE_INVALID'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."schema_version" IS NOT NULL
    OR NEW."actor_context" IS NOT NULL
    OR NEW."attribution_context" IS NOT NULL
  THEN
    RAISE EXCEPTION 'C03_LEGACY_APPLICATION_SNAPSHOT_SHAPE_INVALID'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_application_snapshot_insert_guard"
BEFORE INSERT ON "uce_application_snapshots"
FOR EACH ROW EXECUTE FUNCTION "c03_application_snapshot_guard"();

CREATE TRIGGER "c03_application_snapshot_update_guard"
BEFORE UPDATE ON "uce_application_snapshots"
FOR EACH ROW EXECUTE FUNCTION "c03_application_snapshot_guard"();

CREATE TRIGGER "c03_application_snapshot_delete_guard"
BEFORE DELETE ON "uce_application_snapshots"
FOR EACH ROW EXECUTE FUNCTION "c03_application_snapshot_guard"();

CREATE OR REPLACE FUNCTION "c03_application_event_insert_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  application_row "uce_applications"%ROWTYPE;
  event_actor_is_valid BOOLEAN;
BEGIN
  SELECT * INTO application_row
  FROM "uce_applications"
  WHERE "id" = NEW."application_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'C03_EVENT_APPLICATION_NOT_FOUND'
      USING ERRCODE = '23503';
  END IF;

  IF application_row."authority_version" <> 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    OR NEW."application_version" IS DISTINCT FROM application_row."status_version"
    OR NEW."to_status" IS DISTINCT FROM application_row."status"
    OR NEW."subject_creator_profile_id" IS DISTINCT FROM application_row."subject_creator_profile_id"
    OR NEW."subject_creator_workspace_id" IS DISTINCT FROM application_row."subject_creator_workspace_id"
    OR NEW."brand_profile_id" IS DISTINCT FROM application_row."brand_profile_id"
    OR NEW."campaign_id" IS DISTINCT FROM application_row."campaign_id"
    OR NEW."canonical_campaign_asset_id" IS DISTINCT FROM application_row."canonical_campaign_asset_id"
    OR NEW."canonical_brief_id" IS DISTINCT FROM application_row."canonical_brief_id"
  THEN
    RAISE EXCEPTION 'C03_EVENT_APPLICATION_IDENTITY_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."event_name" = 'application.submitted'::"ApplicationDomainEventName"
    AND (
      NEW."actor_user_id" IS DISTINCT FROM application_row."actor_user_id"
      OR NEW."actor_membership_id" IS DISTINCT FROM application_row."actor_membership_id"
      OR NEW."actor_role" IS DISTINCT FROM application_row."actor_role"
    )
  THEN
    RAISE EXCEPTION 'C03_SUBMITTED_EVENT_ACTOR_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."actor_class" = 'CREATOR_TEAM_USER'::"ApplicationEventActorClass" THEN
    SELECT EXISTS (
      SELECT 1
      FROM "creator_workspace_members" AS member
      WHERE member."id" = NEW."actor_membership_id"
        AND member."workspace_id" = NEW."subject_creator_workspace_id"
        AND member."user_id" = NEW."actor_user_id"
        AND member."security_role_token" = NEW."actor_role"
        AND member."is_active_active" = TRUE
    ) INTO event_actor_is_valid;
  ELSIF NEW."actor_class" = 'BRAND_USER'::"ApplicationEventActorClass" THEN
    SELECT EXISTS (
      SELECT 1
      FROM "users" AS actor
      WHERE actor."id" = NEW."actor_user_id"
        AND actor."role" = 'BRAND'::"UserRole"
    ) INTO event_actor_is_valid;
  ELSE
    event_actor_is_valid := TRUE;
  END IF;

  IF NOT event_actor_is_valid THEN
    RAISE EXCEPTION 'C03_EVENT_ACTOR_EVIDENCE_INVALID'
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "c03_require_canonical_application_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  snapshot_count INTEGER;
  event_count INTEGER;
BEGIN
  IF NEW."authority_version" <> 'C03_CANONICAL'::"UceApplicationAuthorityVersion" THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO snapshot_count
  FROM "uce_application_snapshots"
  WHERE "application_id" = NEW."id"
    AND "schema_version" =
      'C03_APPLICATION_SNAPSHOT_V1'::"UceApplicationSnapshotVersion";

  IF snapshot_count <> 1 THEN
    RAISE EXCEPTION 'C03_CANONICAL_APPLICATION_REQUIRES_ONE_SNAPSHOT'
      USING ERRCODE = '23514';
  END IF;

  SELECT COUNT(*) INTO event_count
  FROM "application_domain_events"
  WHERE "application_id" = NEW."id"
    AND "application_version" = NEW."status_version"
    AND "to_status" = NEW."status";

  IF event_count <> 1 THEN
    RAISE EXCEPTION 'C03_CANONICAL_APPLICATION_REQUIRES_MATCHING_EVENT'
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "c03_canonical_application_evidence_guard"
AFTER INSERT OR UPDATE ON "uce_applications"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "c03_require_canonical_application_evidence"();

DROP TRIGGER "c01_creator_entry_continuation_authority_guard"
  ON "creator_entry_continuations";

CREATE OR REPLACE FUNCTION "c01_creator_entry_continuation_immutable_authority"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'C03_CREATOR_ENTRY_CONTINUATION_DELETE_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."token_digest" IS DISTINCT FROM OLD."token_digest"
    OR NEW."intent" IS DISTINCT FROM OLD."intent"
    OR NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"
    OR NEW."context_version" IS DISTINCT FROM OLD."context_version"
    OR NEW."entry_surface" IS DISTINCT FROM OLD."entry_surface"
    OR NEW."entry_authority_kind" IS DISTINCT FROM OLD."entry_authority_kind"
    OR NEW."campaign_share_id" IS DISTINCT FROM OLD."campaign_share_id"
    OR NEW."campaign_invitation_id" IS DISTINCT FROM OLD."campaign_invitation_id"
    OR NEW."first_qualified_touch_id" IS DISTINCT FROM OLD."first_qualified_touch_id"
    OR (
      OLD."bound_user_id" IS NOT NULL
      AND NEW."bound_user_id" IS DISTINCT FROM OLD."bound_user_id"
    )
    OR (
      OLD."consumed_at" IS NOT NULL
      AND NEW."consumed_at" IS DISTINCT FROM OLD."consumed_at"
    )
    OR (
      (
        OLD."bound_creator_workspace_id" IS NOT NULL
        OR OLD."bound_creator_profile_id" IS NOT NULL
      )
      AND (
        NEW."bound_creator_workspace_id" IS DISTINCT FROM OLD."bound_creator_workspace_id"
        OR NEW."bound_creator_profile_id" IS DISTINCT FROM OLD."bound_creator_profile_id"
      )
    )
  THEN
    RAISE EXCEPTION 'C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "c01_creator_entry_continuation_authority_guard"
BEFORE UPDATE ON "creator_entry_continuations"
FOR EACH ROW EXECUTE FUNCTION "c01_creator_entry_continuation_immutable_authority"();

CREATE TRIGGER "c03_creator_entry_continuation_delete_guard"
BEFORE DELETE ON "creator_entry_continuations"
FOR EACH ROW EXECUTE FUNCTION "c01_creator_entry_continuation_immutable_authority"();

-- The temporary closure is removed last: every permanent trigger and
-- constraint above is already installed inside this migration transaction.
DROP TRIGGER "c03_canonical_application_write_closed" ON "uce_applications";
DROP FUNCTION "c03_reject_canonical_application_until_guards"();

COMMIT;
