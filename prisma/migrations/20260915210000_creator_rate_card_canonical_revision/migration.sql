-- Reviewed additive Rate Card aggregate after the independent Work Preferences slice.
-- No external commercial history, payout state or accepted migration is rewritten.
CREATE TABLE creator_rate_cards (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL UNIQUE,
 owner_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE RESTRICT,
 current_revision INTEGER NOT NULL CHECK(current_revision > 0),
 authority_source VARCHAR(20) NOT NULL CHECK(authority_source IN ('CREATOR_DECLARED','PAYOUT_BANK')),
 authority_reference TEXT NOT NULL,
 authority_version INTEGER NOT NULL CHECK(authority_version > 0),
 authority_legal_version INTEGER CHECK(authority_legal_version > 0),
 country CHAR(2) NOT NULL CHECK(country ~ '^[A-Z]{2}$'),
 currency VARCHAR(3) NOT NULL CHECK(currency = CASE WHEN country = 'IN' THEN 'INR' ELSE 'USD' END),
 authority_fingerprint VARCHAR(64) NOT NULL CHECK(authority_fingerprint ~ '^[a-f0-9]{64}$'),
 reel_enabled BOOLEAN NOT NULL, reel_amount_minor BIGINT,
 story_enabled BOOLEAN NOT NULL, story_amount_minor BIGINT,
 carousel_enabled BOOLEAN NOT NULL, carousel_amount_minor BIGINT,
 photoshoot_enabled BOOLEAN NOT NULL, photoshoot_amount_minor BIGINT,
 link_in_bio_enabled BOOLEAN NOT NULL, link_in_bio_amount_minor BIGINT,
 partnership_ads_enabled BOOLEAN NOT NULL, partnership_ads_amount_minor BIGINT,
 content_usage_rights VARCHAR(3) CHECK(content_usage_rights IN ('YES','NO')),
 usage_days BIGINT CHECK(usage_days BETWEEN 1 AND 9007199254740991),
 advance_percent INTEGER CHECK(advance_percent IN (0,25,50,75,100)),
 balance_term VARCHAR(6) CHECK(balance_term IN ('NET_7','NET_15','NET_30','NET_45','NET_60')),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(3) NOT NULL,
 UNIQUE(workspace_id,owner_profile_id),
 FOREIGN KEY(workspace_id,owner_profile_id) REFERENCES creator_workspaces(id,owner_profile_id) ON DELETE RESTRICT,
 CHECK(reel_enabled = (reel_amount_minor IS NOT NULL) AND (reel_amount_minor IS NULL OR reel_amount_minor BETWEEN 1 AND 9007199254740991)),
 CHECK(story_enabled = (story_amount_minor IS NOT NULL) AND (story_amount_minor IS NULL OR story_amount_minor BETWEEN 1 AND 9007199254740991)),
 CHECK(carousel_enabled = (carousel_amount_minor IS NOT NULL) AND (carousel_amount_minor IS NULL OR carousel_amount_minor BETWEEN 1 AND 9007199254740991)),
 CHECK(photoshoot_enabled = (photoshoot_amount_minor IS NOT NULL) AND (photoshoot_amount_minor IS NULL OR photoshoot_amount_minor BETWEEN 1 AND 9007199254740991)),
 CHECK(link_in_bio_enabled = (link_in_bio_amount_minor IS NOT NULL) AND (link_in_bio_amount_minor IS NULL OR link_in_bio_amount_minor BETWEEN 1 AND 9007199254740991)),
 CHECK(partnership_ads_enabled = (partnership_ads_amount_minor IS NOT NULL) AND (partnership_ads_amount_minor IS NULL OR partnership_ads_amount_minor BETWEEN 1 AND 9007199254740991)),
 CHECK(usage_days IS NULL OR content_usage_rights IS NOT DISTINCT FROM 'YES'),
 CHECK(authority_source <> 'CREATOR_DECLARED' OR authority_legal_version IS NULL)
);
CREATE TABLE creator_rate_card_revisions (
 id TEXT PRIMARY KEY,
 profile_id TEXT NOT NULL REFERENCES creator_rate_cards(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision > 0),
 previous_revision INTEGER NOT NULL CHECK(previous_revision >= 0 AND revision = previous_revision + 1),
 snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot) = 'object'),
 authority_snapshot JSONB NOT NULL CHECK(jsonb_typeof(authority_snapshot) = 'object'),
 transition_snapshot JSONB CHECK(jsonb_typeof(transition_snapshot) = 'object'),
 actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 actor_membership_id TEXT NOT NULL REFERENCES creator_workspace_members(id) ON DELETE RESTRICT,
 actor_role "CreatorTeamRole" NOT NULL CHECK(actor_role IN ('OWNER','MANAGER')),
 origin VARCHAR(40) NOT NULL CHECK(origin IN ('MANUAL','COUNTRY_AUTHORITY_RECONCILIATION','MANUAL_COUNTRY_MONETARY_RESET')),
 idempotency_key UUID NOT NULL,
 command_hash VARCHAR(64) NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(profile_id,revision), UNIQUE(profile_id,idempotency_key)
);
ALTER TABLE creator_rate_cards ADD CONSTRAINT creator_rate_cards_current_revision_fk
 FOREIGN KEY(id,current_revision) REFERENCES creator_rate_card_revisions(profile_id,revision) DEFERRABLE INITIALLY DEFERRED;
CREATE FUNCTION guard_creator_rate_card_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' AND NEW.current_revision <> 1 THEN RAISE EXCEPTION 'RATE_CARD_INITIAL_REVISION'; END IF;
 IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.workspace_id <> OLD.workspace_id OR NEW.owner_profile_id <> OLD.owner_profile_id OR NEW.current_revision <> OLD.current_revision + 1) THEN RAISE EXCEPTION 'RATE_CARD_MONOTONIC_IDENTITY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_rate_card_profile_guard BEFORE INSERT OR UPDATE ON creator_rate_cards FOR EACH ROW EXECUTE FUNCTION guard_creator_rate_card_profile();
CREATE FUNCTION guard_creator_rate_card_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 AND NOT EXISTS(SELECT 1 FROM creator_rate_cards WHERE id = OLD.profile_id) THEN RETURN OLD; END IF;
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'RATE_CARD_REVISION_IMMUTABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_rate_cards p JOIN creator_workspace_members m ON m.workspace_id = p.workspace_id JOIN users u ON u.id = m.user_id
 WHERE p.id = NEW.profile_id AND m.id = NEW.actor_membership_id AND m.user_id = NEW.actor_user_id AND m.security_role_token = NEW.actor_role AND m.is_active_active AND u.auth_state = 'ACTIVE') THEN RAISE EXCEPTION 'RATE_CARD_ACTOR_MISMATCH'; END IF;
 IF NEW.previous_revision > 0 AND NOT EXISTS(SELECT 1 FROM creator_rate_card_revisions WHERE profile_id = NEW.profile_id AND revision = NEW.previous_revision) THEN RAISE EXCEPTION 'RATE_CARD_REVISION_GAP'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_rate_card_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON creator_rate_card_revisions FOR EACH ROW EXECUTE FUNCTION guard_creator_rate_card_revision();
CREATE FUNCTION check_creator_rate_card_current() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p creator_rate_cards%ROWTYPE; expected JSONB; authority JSONB;
BEGIN
 SELECT * INTO p FROM creator_rate_cards WHERE id = NEW.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 expected := jsonb_build_object(
 'REEL_VIDEO',jsonb_build_object('enabled',p.reel_enabled,'amountMinor',p.reel_amount_minor),
 'STORY',jsonb_build_object('enabled',p.story_enabled,'amountMinor',p.story_amount_minor),
 'BANNER_CAROUSEL',jsonb_build_object('enabled',p.carousel_enabled,'amountMinor',p.carousel_amount_minor),
 'PHOTOSHOOT',jsonb_build_object('enabled',p.photoshoot_enabled,'amountMinor',p.photoshoot_amount_minor),
 'linkInBio',jsonb_build_object('enabled',p.link_in_bio_enabled,'amountMinor',p.link_in_bio_amount_minor),
 'paidAmplification',jsonb_build_object('enabled',p.partnership_ads_enabled,'amountMinor',p.partnership_ads_amount_minor),
 'contentUsageRights',p.content_usage_rights,'usageDays',p.usage_days,'advancePercent',p.advance_percent,'balanceTerm',p.balance_term);
 authority := jsonb_build_object('binding',jsonb_build_object('source',p.authority_source,'sourceReference',p.authority_reference,'sourceVersion',p.authority_version,'legalProfileVersion',p.authority_legal_version,'country',btrim(p.country),'currency',p.currency),'fingerprint',p.authority_fingerprint);
 IF NOT EXISTS(SELECT 1 FROM creator_rate_card_revisions r WHERE r.profile_id = p.id AND r.revision = p.current_revision AND r.snapshot = expected AND r.authority_snapshot = authority) THEN RAISE EXCEPTION 'RATE_CARD_CURRENT_REVISION_MISMATCH'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER creator_rate_card_current_consistency AFTER INSERT OR UPDATE ON creator_rate_cards DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_creator_rate_card_current();
