CREATE TYPE "OrganizationKind" AS ENUM ('BRAND', 'CREATOR');

ALTER TABLE "organizations" ADD COLUMN "kind" "OrganizationKind";
ALTER TABLE "creator_workspaces" ADD COLUMN "organization_id" TEXT;

-- Fail before reconciliation if historical evidence requires a human identity choice.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "organizations" o
    JOIN "brand_profiles" bp ON bp."organization_id" = o."id"
    JOIN "users" u ON u."organization_id" = o."id"
    JOIN "creator_profiles" cp ON cp."user_id" = u."id"
    WHERE u."role" = 'CREATOR'
      AND u."auth_state" = 'ACTIVE'
      AND u."email_verified_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ORGANIZATION_WITH_BRAND_AND_CREATOR_EVIDENCE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "creator_workspaces"
    GROUP BY "owner_profile_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MULTIPLE_CANONICAL_CREATOR_WORKSPACES';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "users" u
    LEFT JOIN "creator_profiles" cp ON cp."user_id" = u."id"
    WHERE u."role" = 'CREATOR'
      AND u."auth_state" = 'ACTIVE'
      AND u."email_verified_at" IS NOT NULL
      AND cp."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'C01_ACTIVE_CREATOR_PROFILE_MISSING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "users" u
    JOIN "creator_profiles" cp ON cp."user_id" = u."id"
    LEFT JOIN "creator_workspaces" cw ON cw."owner_profile_id" = cp."id"
    WHERE u."role" = 'CREATOR'
      AND u."auth_state" = 'PROVISIONAL'
      AND (cp."id" IS NOT NULL OR cw."id" IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'C01_PROVISIONAL_CREATOR_CANONICAL_CONTEXT_CONTRADICTION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "creator_social_integrations"
    GROUP BY "platform_network", "native_platform_user_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'PROVIDER_IDENTITY_OWNERSHIP_CONFLICT';
  END IF;
END $$;

UPDATE "organizations" o
SET "kind" = 'BRAND'::"OrganizationKind"
FROM "brand_profiles" bp
WHERE bp."organization_id" = o."id";

-- Reconcile only ACTIVE, verified Creator identities with a canonical profile.
DO $$
DECLARE
  candidate record;
  candidate_organization_id text;
  candidate_workspace_id text;
  owned_workspace_count integer;
  active_owner_seat_count integer;
BEGIN
  FOR candidate IN
    SELECT
      u."id" AS user_id,
      u."normalized_email" AS normalized_email,
      u."name" AS user_name,
      u."organization_id" AS existing_organization_id,
      cp."id" AS creator_profile_id,
      cp."display_name" AS display_name
    FROM "users" u
    JOIN "creator_profiles" cp ON cp."user_id" = u."id"
    WHERE u."role" = 'CREATOR'
      AND u."auth_state" = 'ACTIVE'
      AND u."email_verified_at" IS NOT NULL
    ORDER BY u."id"
  LOOP
    IF EXISTS (
      SELECT 1 FROM "brand_team_members" btm
      WHERE btm."user_id" = candidate.user_id AND btm."is_active" = true
    ) THEN
      RAISE EXCEPTION 'AMBIGUOUS_BRAND_CREATOR_DUAL_CONTEXT: %', candidate.user_id;
    END IF;

    SELECT count(*), min("id")
      INTO owned_workspace_count, candidate_workspace_id
    FROM "creator_workspaces"
    WHERE "owner_profile_id" = candidate.creator_profile_id;

    IF owned_workspace_count > 1 THEN
      RAISE EXCEPTION 'MULTIPLE_CANONICAL_CREATOR_WORKSPACES: %', candidate.user_id;
    END IF;

    candidate_organization_id := candidate.existing_organization_id;
    IF candidate_organization_id IS NULL THEN
      candidate_organization_id := gen_random_uuid()::text;
      INSERT INTO "organizations" ("id", "name", "kind", "created_at", "updated_at")
      VALUES (
        candidate_organization_id,
        COALESCE(NULLIF(candidate.display_name, ''), NULLIF(candidate.user_name, ''), 'Creator Workspace'),
        'CREATOR'::"OrganizationKind",
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
      UPDATE "users"
      SET "organization_id" = candidate_organization_id
      WHERE "id" = candidate.user_id;
    ELSE
      IF EXISTS (
        SELECT 1 FROM "brand_profiles"
        WHERE "organization_id" = candidate_organization_id
      ) THEN
        RAISE EXCEPTION 'ORGANIZATION_WITH_BRAND_AND_CREATOR_EVIDENCE: %', candidate_organization_id;
      END IF;
      IF EXISTS (
        SELECT 1 FROM "users"
        WHERE "organization_id" = candidate_organization_id
          AND "id" <> candidate.user_id
          AND "auth_state" = 'ACTIVE'
      ) THEN
        RAISE EXCEPTION 'CROSS_ORGANIZATION_OWNERSHIP_AMBIGUITY: %', candidate_organization_id;
      END IF;
      UPDATE "organizations"
      SET "kind" = 'CREATOR'::"OrganizationKind"
      WHERE "id" = candidate_organization_id AND "kind" IS NULL;
      IF EXISTS (
        SELECT 1 FROM "organizations"
        WHERE "id" = candidate_organization_id AND "kind" <> 'CREATOR'::"OrganizationKind"
      ) THEN
        RAISE EXCEPTION 'ORGANIZATION_TYPE_CONTRADICTION: %', candidate_organization_id;
      END IF;
    END IF;

    IF owned_workspace_count = 0 THEN
      candidate_workspace_id := gen_random_uuid()::text;
      INSERT INTO "creator_workspaces" (
        "id", "owner_profile_id", "organization_id", "organization_display_name", "created_at", "updated_at"
      ) VALUES (
        candidate_workspace_id,
        candidate.creator_profile_id,
        candidate_organization_id,
        COALESCE(NULLIF(candidate.display_name, ''), NULLIF(candidate.user_name, ''), 'My Creative Workspace'),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    ELSE
      UPDATE "creator_workspaces"
      SET "organization_id" = candidate_organization_id
      WHERE "id" = candidate_workspace_id;
    END IF;

    SELECT count(*) INTO active_owner_seat_count
    FROM "creator_workspace_members"
    WHERE "workspace_id" = candidate_workspace_id
      AND "security_role_token" = 'OWNER'
      AND "is_active_active" = true;

    IF active_owner_seat_count > 1 OR EXISTS (
      SELECT 1
      FROM "creator_workspace_members"
      WHERE "workspace_id" = candidate_workspace_id
        AND "security_role_token" = 'OWNER'
        AND "is_active_active" = true
        AND "assigned_profile_id" IS DISTINCT FROM candidate.creator_profile_id
    ) THEN
      RAISE EXCEPTION 'C01_CREATOR_OWNER_SEAT_INCONSISTENCY: %', candidate_workspace_id;
    END IF;

    IF active_owner_seat_count = 0 THEN
      IF EXISTS (
        SELECT 1 FROM "creator_workspace_members"
        WHERE "workspace_id" = candidate_workspace_id
          AND lower(btrim("associated_email")) = candidate.normalized_email
      ) THEN
        RAISE EXCEPTION 'C01_CREATOR_OWNER_SEAT_EMAIL_AMBIGUITY: %', candidate_workspace_id;
      END IF;
      INSERT INTO "creator_workspace_members" (
        "id", "workspace_id", "assigned_profile_id", "associated_email",
        "security_role_token", "is_active_active", "joined_at", "created_at", "updated_at"
      ) VALUES (
        gen_random_uuid()::text,
        candidate_workspace_id,
        candidate.creator_profile_id,
        candidate.normalized_email,
        'OWNER', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "creator_workspaces" WHERE "organization_id" IS NULL) THEN
    RAISE EXCEPTION 'C01_CREATOR_WORKSPACE_ORGANIZATION_UNRESOLVED';
  END IF;
  IF EXISTS (SELECT 1 FROM "organizations" WHERE "kind" IS NULL) THEN
    RAISE EXCEPTION 'C01_ORGANIZATION_KIND_UNRESOLVED';
  END IF;
END $$;

ALTER TABLE "organizations" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "creator_workspaces" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "creator_workspaces"
  ADD CONSTRAINT "creator_workspaces_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "creator_workspaces_organization_id_key"
  ON "creator_workspaces"("organization_id");
CREATE UNIQUE INDEX "creator_workspace_active_owner_key"
  ON "creator_workspace_members"("workspace_id")
  WHERE "security_role_token" = 'OWNER' AND "is_active_active" = true;

CREATE FUNCTION "c01_validate_brand_organization"() RETURNS trigger AS $$
BEGIN
  IF NEW."organization_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "organizations"
    WHERE "id" = NEW."organization_id" AND "kind" = 'BRAND'
  ) THEN
    RAISE EXCEPTION 'C01_BRAND_REQUIRES_BRAND_ORGANIZATION';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_brand_organization_guard"
BEFORE INSERT OR UPDATE OF "organization_id" ON "brand_profiles"
FOR EACH ROW EXECUTE FUNCTION "c01_validate_brand_organization"();

CREATE FUNCTION "c01_validate_creator_workspace_owner"() RETURNS trigger AS $$
DECLARE owner_organization_id text;
DECLARE organization_kind "OrganizationKind";
BEGIN
  SELECT u."organization_id" INTO owner_organization_id
  FROM "creator_profiles" cp
  JOIN "users" u ON u."id" = cp."user_id"
  WHERE cp."id" = NEW."owner_profile_id";

  SELECT "kind" INTO organization_kind
  FROM "organizations" WHERE "id" = NEW."organization_id";

  IF organization_kind IS DISTINCT FROM 'CREATOR'::"OrganizationKind" THEN
    RAISE EXCEPTION 'C01_CREATOR_WORKSPACE_REQUIRES_CREATOR_ORGANIZATION';
  END IF;
  IF owner_organization_id IS DISTINCT FROM NEW."organization_id" THEN
    RAISE EXCEPTION 'C01_CREATOR_WORKSPACE_OWNER_ORGANIZATION_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_creator_workspace_owner_guard"
BEFORE INSERT OR UPDATE OF "organization_id", "owner_profile_id" ON "creator_workspaces"
FOR EACH ROW EXECUTE FUNCTION "c01_validate_creator_workspace_owner"();

CREATE FUNCTION "c01_validate_user_organization"() RETURNS trigger AS $$
DECLARE organization_kind "OrganizationKind";
BEGIN
  IF NEW."role" = 'CREATOR' AND NEW."auth_state" = 'PROVISIONAL' AND NEW."organization_id" IS NOT NULL THEN
    RAISE EXCEPTION 'C01_PROVISIONAL_CREATOR_CANNOT_CLAIM_ORGANIZATION';
  END IF;
  IF NEW."organization_id" IS NOT NULL AND NEW."auth_state" = 'ACTIVE' THEN
    SELECT "kind" INTO organization_kind FROM "organizations" WHERE "id" = NEW."organization_id";
    IF NEW."role" = 'BRAND' AND organization_kind IS DISTINCT FROM 'BRAND'::"OrganizationKind" THEN
      RAISE EXCEPTION 'C01_ACTIVE_BRAND_USER_REQUIRES_BRAND_ORGANIZATION';
    END IF;
    IF NEW."role" = 'CREATOR' AND organization_kind IS DISTINCT FROM 'CREATOR'::"OrganizationKind" THEN
      RAISE EXCEPTION 'C01_ACTIVE_CREATOR_USER_REQUIRES_CREATOR_ORGANIZATION';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "creator_profiles" cp
    JOIN "creator_workspaces" cw ON cw."owner_profile_id" = cp."id"
    WHERE cp."user_id" = NEW."id"
      AND cw."organization_id" IS DISTINCT FROM NEW."organization_id"
  ) THEN
    RAISE EXCEPTION 'C01_CREATOR_OWNER_USER_ORGANIZATION_MUTATION_BLOCKED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_user_organization_guard"
BEFORE INSERT OR UPDATE OF "organization_id", "role", "auth_state" ON "users"
FOR EACH ROW EXECUTE FUNCTION "c01_validate_user_organization"();

CREATE FUNCTION "c01_validate_creator_profile_owner"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "creator_workspaces" cw
    JOIN "users" u ON u."id" = NEW."user_id"
    WHERE cw."owner_profile_id" = NEW."id"
      AND cw."organization_id" IS DISTINCT FROM u."organization_id"
  ) THEN
    RAISE EXCEPTION 'C01_CREATOR_PROFILE_USER_MUTATION_BLOCKED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_creator_profile_owner_guard"
BEFORE UPDATE OF "user_id" ON "creator_profiles"
FOR EACH ROW EXECUTE FUNCTION "c01_validate_creator_profile_owner"();

CREATE FUNCTION "c01_validate_organization_kind_mutation"() RETURNS trigger AS $$
BEGIN
  IF NEW."kind" IS DISTINCT FROM OLD."kind" AND (
    EXISTS (SELECT 1 FROM "brand_profiles" WHERE "organization_id" = NEW."id")
    OR EXISTS (SELECT 1 FROM "creator_workspaces" WHERE "organization_id" = NEW."id")
  ) THEN
    RAISE EXCEPTION 'C01_ORGANIZATION_KIND_MUTATION_BLOCKED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_organization_kind_guard"
BEFORE UPDATE OF "kind" ON "organizations"
FOR EACH ROW EXECUTE FUNCTION "c01_validate_organization_kind_mutation"();

CREATE FUNCTION "c01_validate_creator_owner_seat"() RETURNS trigger AS $$
DECLARE canonical_owner_profile_id text;
BEGIN
  IF NEW."security_role_token" = 'OWNER' AND NEW."is_active_active" = true THEN
    SELECT "owner_profile_id" INTO canonical_owner_profile_id
    FROM "creator_workspaces" WHERE "id" = NEW."workspace_id";
    IF NEW."assigned_profile_id" IS DISTINCT FROM canonical_owner_profile_id THEN
      RAISE EXCEPTION 'C01_CREATOR_OWNER_SEAT_PROFILE_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_creator_owner_seat_guard"
BEFORE INSERT OR UPDATE OF "workspace_id", "assigned_profile_id", "security_role_token", "is_active_active"
ON "creator_workspace_members"
FOR EACH ROW EXECUTE FUNCTION "c01_validate_creator_owner_seat"();
