-- Reviewed additive Work Preferences slice after all 102 accepted migrations.
-- No external-owner table rewrite, inferred default, backfill or source coupling.
CREATE TABLE creator_work_preferences (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL UNIQUE,
 owner_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE RESTRICT,
 current_revision INTEGER NOT NULL CHECK (current_revision > 0),
 base_country CHAR(2) NOT NULL CHECK (base_country ~ '^[A-Z]{2}$'),
 open_to_international_brands VARCHAR(3) CHECK (open_to_international_brands IN ('YES','NO')),
 preferred_industry_ids "IndustryVertical"[] NOT NULL,
 excluded_industry_ids "IndustryVertical"[] NOT NULL,
 availability VARCHAR(42) NOT NULL CHECK (availability IN ('ACCEPTING_COLLABORATIONS','PAUSED_UNTIL','NOT_ACCEPTING_NEW_COLLABORATIONS')),
 paused_until TIMESTAMP(3),
 physical_product_collaborations VARCHAR(3) CHECK (physical_product_collaborations IN ('YES','NO')),
 ugc_projects VARCHAR(3) CHECK (ugc_projects IN ('YES','NO')),
 gifting_barter VARCHAR(3) CHECK (gifting_barter IN ('YES','NO')),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(3) NOT NULL,
 UNIQUE(workspace_id,owner_profile_id),
 FOREIGN KEY(workspace_id,owner_profile_id) REFERENCES creator_workspaces(id,owner_profile_id) ON DELETE RESTRICT,
 CHECK ((availability = 'PAUSED_UNTIL') = (paused_until IS NOT NULL)),
 CHECK (cardinality(preferred_industry_ids) <= 4 AND cardinality(excluded_industry_ids) <= 4),
 CHECK (preferred_industry_ids <@ ARRAY['D2C','HEALTHCARE','OFFLINE_SERVICES','SAAS_AI']::"IndustryVertical"[]),
 CHECK (excluded_industry_ids <@ ARRAY['D2C','HEALTHCARE','OFFLINE_SERVICES','SAAS_AI']::"IndustryVertical"[]),
 CHECK (NOT (preferred_industry_ids && excluded_industry_ids))
);
CREATE TABLE creator_work_preferences_revisions (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES creator_work_preferences(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision > 0),
 previous_revision INTEGER NOT NULL CHECK(previous_revision >= 0 AND revision = previous_revision + 1),
 snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot) = 'object'),
 actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 actor_membership_id TEXT NOT NULL REFERENCES creator_workspace_members(id) ON DELETE RESTRICT,
 actor_role "CreatorTeamRole" NOT NULL CHECK(actor_role IN ('OWNER','MANAGER')),
 origin VARCHAR(40) NOT NULL CHECK(origin = 'MANUAL'),
 idempotency_key UUID NOT NULL,
 command_hash VARCHAR(64) NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(profile_id,revision), UNIQUE(profile_id,idempotency_key)
);
ALTER TABLE creator_work_preferences ADD CONSTRAINT creator_work_preferences_current_revision_fk
 FOREIGN KEY(id,current_revision) REFERENCES creator_work_preferences_revisions(profile_id,revision) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION guard_creator_work_preferences_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' AND NEW.current_revision <> 1 THEN RAISE EXCEPTION 'WORK_PREFERENCES_INITIAL_REVISION'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.owner_profile_id <> OLD.owner_profile_id OR NEW.current_revision <> OLD.current_revision + 1) THEN RAISE EXCEPTION 'WORK_PREFERENCES_MONOTONIC_IDENTITY'; END IF;
 IF NEW.preferred_industry_ids <> ARRAY(SELECT x FROM (SELECT DISTINCT x FROM unnest(NEW.preferred_industry_ids) x) d ORDER BY x::TEXT)
 OR NEW.excluded_industry_ids <> ARRAY(SELECT x FROM (SELECT DISTINCT x FROM unnest(NEW.excluded_industry_ids) x) d ORDER BY x::TEXT) THEN RAISE EXCEPTION 'WORK_PREFERENCES_CANONICAL_INDUSTRIES'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_work_preferences_profile_guard BEFORE INSERT OR UPDATE ON creator_work_preferences FOR EACH ROW EXECUTE FUNCTION guard_creator_work_preferences_profile();

CREATE FUNCTION guard_creator_work_preferences_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 -- Audit is immutable while its aggregate exists. Only the FK cascade of an
 -- exact aggregate purge can remove its history; direct revision deletes fail.
 IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 AND NOT EXISTS(SELECT 1 FROM creator_work_preferences WHERE id = OLD.profile_id) THEN RETURN OLD; END IF;
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'WORK_PREFERENCES_REVISION_IMMUTABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_work_preferences p JOIN creator_workspace_members m ON m.workspace_id = p.workspace_id JOIN users u ON u.id = m.user_id
 WHERE p.id = NEW.profile_id AND m.id = NEW.actor_membership_id AND m.user_id = NEW.actor_user_id AND m.security_role_token = NEW.actor_role AND m.is_active_active AND u.auth_state = 'ACTIVE') THEN RAISE EXCEPTION 'WORK_PREFERENCES_ACTOR_MISMATCH'; END IF;
 IF NEW.previous_revision > 0 AND NOT EXISTS(SELECT 1 FROM creator_work_preferences_revisions WHERE profile_id = NEW.profile_id AND revision = NEW.previous_revision) THEN RAISE EXCEPTION 'WORK_PREFERENCES_REVISION_GAP'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_work_preferences_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON creator_work_preferences_revisions FOR EACH ROW EXECUTE FUNCTION guard_creator_work_preferences_revision();

CREATE FUNCTION check_creator_work_preferences_current() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p creator_work_preferences%ROWTYPE; expected JSONB;
BEGIN
 SELECT * INTO p FROM creator_work_preferences WHERE id = NEW.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 expected := jsonb_build_object('baseCountry',btrim(p.base_country),'openToInternationalBrands',p.open_to_international_brands,'preferredIndustryIds',p.preferred_industry_ids,'excludedIndustryIds',p.excluded_industry_ids,'availability',p.availability,'pausedUntil',CASE WHEN p.paused_until IS NULL THEN NULL ELSE to_char(p.paused_until,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END,'physicalProductCollaborations',p.physical_product_collaborations,'ugcProjects',p.ugc_projects,'giftingBarter',p.gifting_barter);
 IF NOT EXISTS(SELECT 1 FROM creator_work_preferences_revisions r WHERE r.profile_id = p.id AND r.revision = p.current_revision AND r.snapshot = expected) THEN RAISE EXCEPTION 'WORK_PREFERENCES_CURRENT_REVISION_MISMATCH'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER creator_work_preferences_current_consistency AFTER INSERT OR UPDATE ON creator_work_preferences DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_creator_work_preferences_current();
