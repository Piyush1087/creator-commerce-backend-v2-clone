-- Additive canonical business aggregate. No source-derived backfill or source FK.
CREATE TABLE creator_brand_profiles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  owner_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE RESTRICT,
  current_revision INTEGER NOT NULL CHECK (current_revision > 0),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  UNIQUE (workspace_id, owner_profile_id),
  FOREIGN KEY (workspace_id, owner_profile_id) REFERENCES creator_workspaces(id, owner_profile_id) ON DELETE RESTRICT
);
CREATE TABLE creator_brand_revisions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES creator_brand_profiles(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  previous_revision INTEGER NOT NULL CHECK (previous_revision >= 0 AND revision = previous_revision + 1),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_membership_id TEXT NOT NULL REFERENCES creator_workspace_members(id) ON DELETE RESTRICT,
  actor_role "CreatorTeamRole" NOT NULL CHECK (actor_role IN ('OWNER','MANAGER')),
  origin VARCHAR(30) NOT NULL CHECK (origin IN ('MANUAL','SUGGESTION_USED','SUGGESTION_EDITED')),
  idempotency_key UUID NOT NULL,
  command_hash VARCHAR(64) NOT NULL CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  suggestion_object_generation_id TEXT,
  suggestion_component_generation_id TEXT,
  suggestion_candidate_id VARCHAR(100),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (profile_id, revision),
  UNIQUE (profile_id, idempotency_key),
  CHECK ((origin = 'MANUAL' AND suggestion_object_generation_id IS NULL AND suggestion_component_generation_id IS NULL AND suggestion_candidate_id IS NULL)
    OR (origin <> 'MANUAL' AND suggestion_object_generation_id IS NOT NULL AND suggestion_component_generation_id IS NOT NULL AND suggestion_candidate_id IS NOT NULL))
);
ALTER TABLE creator_brand_profiles ADD CONSTRAINT creator_brand_current_revision_fk
 FOREIGN KEY (id, current_revision) REFERENCES creator_brand_revisions(profile_id, revision) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION validate_creator_brand_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE field TEXT; maximum INTEGER;
BEGIN
 IF TG_TABLE_NAME = 'creator_brand_profiles' AND TG_OP = 'UPDATE' THEN
  IF NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.owner_profile_id <> OLD.owner_profile_id OR NEW.current_revision <> OLD.current_revision + 1 THEN RAISE EXCEPTION 'CREATOR_BRAND_PROFILE_MONOTONIC_IDENTITY'; END IF;
 END IF;
 IF NOT (NEW.snapshot ?& ARRAY['headline','commercialBio','primaryNicheIds','creatorArchetypeIds','archetypeState','voiceDescriptorIds','voiceDescription','visualStyleDescriptors','palette','languages'])
 OR (SELECT count(*) FROM jsonb_object_keys(NEW.snapshot)) <> 10 THEN RAISE EXCEPTION 'CREATOR_BRAND_SNAPSHOT_SHAPE'; END IF;
 FOREACH field IN ARRAY ARRAY['primaryNicheIds','creatorArchetypeIds','voiceDescriptorIds','visualStyleDescriptors','languages'] LOOP
  maximum := CASE field WHEN 'languages' THEN 10 WHEN 'visualStyleDescriptors' THEN 5 ELSE 3 END;
  IF jsonb_typeof(NEW.snapshot->field) <> 'array' OR jsonb_array_length(NEW.snapshot->field) > maximum THEN RAISE EXCEPTION 'CREATOR_BRAND_SNAPSHOT_BOUND'; END IF;
 END LOOP;
 IF (NEW.snapshot->>'archetypeState') NOT IN ('UNCONFIGURED','CONFIRMED')
 OR ((jsonb_array_length(NEW.snapshot->'creatorArchetypeIds') = 0) <> (NEW.snapshot->>'archetypeState' = 'UNCONFIGURED')) THEN RAISE EXCEPTION 'CREATOR_BRAND_ARCHETYPE_STATE'; END IF;
 IF jsonb_typeof(NEW.snapshot->'palette') <> 'null' AND (jsonb_typeof(NEW.snapshot->'palette') <> 'array' OR jsonb_array_length(NEW.snapshot->'palette') > 5) THEN RAISE EXCEPTION 'CREATOR_BRAND_PALETTE_BOUND'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_brand_profile_snapshot BEFORE INSERT OR UPDATE ON creator_brand_profiles FOR EACH ROW EXECUTE FUNCTION validate_creator_brand_snapshot();
CREATE TRIGGER creator_brand_revision_snapshot BEFORE INSERT ON creator_brand_revisions FOR EACH ROW EXECUTE FUNCTION validate_creator_brand_snapshot();

CREATE FUNCTION guard_creator_brand_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'CREATOR_BRAND_REVISION_IMMUTABLE'; END IF;
 IF NOT EXISTS (SELECT 1 FROM creator_brand_profiles p JOIN creator_workspace_members m ON m.workspace_id = p.workspace_id JOIN users u ON u.id = m.user_id
 WHERE p.id = NEW.profile_id AND m.id = NEW.actor_membership_id AND m.user_id = NEW.actor_user_id AND m.security_role_token = NEW.actor_role AND m.is_active_active AND u.auth_state = 'ACTIVE') THEN RAISE EXCEPTION 'CREATOR_BRAND_ACTOR_MISMATCH'; END IF;
 IF NEW.previous_revision > 0 AND NOT EXISTS (SELECT 1 FROM creator_brand_revisions WHERE profile_id = NEW.profile_id AND revision = NEW.previous_revision) THEN RAISE EXCEPTION 'CREATOR_BRAND_REVISION_GAP'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_brand_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON creator_brand_revisions FOR EACH ROW EXECUTE FUNCTION guard_creator_brand_revision();

CREATE FUNCTION check_creator_brand_current() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM creator_brand_revisions r JOIN creator_brand_profiles p ON p.id = r.profile_id WHERE p.id = NEW.id AND r.revision = p.current_revision AND r.snapshot = p.snapshot)
 THEN RAISE EXCEPTION 'CREATOR_BRAND_CURRENT_REVISION_MISMATCH'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER creator_brand_current_consistency AFTER INSERT OR UPDATE ON creator_brand_profiles DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_creator_brand_current();
