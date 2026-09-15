-- Portfolio-only additive slice after 104 accepted migrations. No backfill,
-- source foreign key, source purge target, Settings action or foreign rewrite.
CREATE TABLE creator_portfolios (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL UNIQUE,
 owner_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE RESTRICT,
 current_revision INTEGER NOT NULL CHECK(current_revision > 0),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(3) NOT NULL,
 UNIQUE(workspace_id,owner_profile_id),
 FOREIGN KEY(workspace_id,owner_profile_id) REFERENCES creator_workspaces(id,owner_profile_id) ON DELETE RESTRICT
);
CREATE TABLE creator_portfolio_items (
 id TEXT PRIMARY KEY CHECK(id ~ '^portfolio-item:[a-f0-9]{64}$'),
 portfolio_id TEXT NOT NULL REFERENCES creator_portfolios(id) ON DELETE CASCADE,
 kind VARCHAR(40) NOT NULL CHECK(kind IN ('INSTAGRAM_IMAGE','INSTAGRAM_REEL','INSTAGRAM_CAROUSEL','EXTERNAL','UGC')),
 destination VARCHAR(4096) NOT NULL CHECK(destination LIKE 'https://%' AND destination !~* '[?&](access_token|signature|expires|x-amz-signature)='),
 title VARCHAR(160) NOT NULL CHECK(length(title)>0),
 creator_context VARCHAR(300), brand_label VARCHAR(160), work_date TIMESTAMP(3),
 state VARCHAR(16) NOT NULL CHECK(state IN ('INCLUDED','REMOVED')),
 sources TEXT[] NOT NULL CHECK(cardinality(sources) BETWEEN 1 AND 3 AND sources <@ ARRAY['INSTAGRAM','CREATOR_SHOP','CREATOR_PROVIDED']::TEXT[]),
 provenance JSONB NOT NULL CHECK(jsonb_typeof(provenance)='array' AND jsonb_array_length(provenance) BETWEEN 1 AND 32),
 last_revision INTEGER NOT NULL CHECK(last_revision>0),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP(3) NOT NULL,
 UNIQUE(portfolio_id,id)
);
CREATE INDEX creator_portfolio_items_portfolio_id_state_work_date_id_idx ON creator_portfolio_items(portfolio_id,state,work_date,id);
CREATE INDEX creator_portfolio_items_sources_idx ON creator_portfolio_items USING GIN(sources);
CREATE TABLE creator_portfolio_aliases (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL, item_id TEXT NOT NULL,
 alias VARCHAR(500) NOT NULL,
 FOREIGN KEY(portfolio_id,item_id) REFERENCES creator_portfolio_items(portfolio_id,id) ON DELETE CASCADE,
 UNIQUE(portfolio_id,alias)
);
CREATE TABLE creator_portfolio_revisions (
 id TEXT PRIMARY KEY,
 portfolio_id TEXT NOT NULL REFERENCES creator_portfolios(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL CHECK(revision>0),
 previous_revision INTEGER NOT NULL CHECK(previous_revision>=0 AND revision=previous_revision+1),
 snapshot JSONB NOT NULL CHECK(jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=262144),
 actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 actor_membership_id TEXT NOT NULL REFERENCES creator_workspace_members(id) ON DELETE RESTRICT,
 actor_role "CreatorTeamRole" NOT NULL,
 origin VARCHAR(24) NOT NULL CHECK(origin IN ('MANUAL','SOURCE_ADAPT')),
 idempotency_key VARCHAR(200) NOT NULL,
 command_hash VARCHAR(64) NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(portfolio_id,revision), UNIQUE(portfolio_id,idempotency_key),
 CHECK(origin<>'MANUAL' OR actor_role IN ('OWNER','MANAGER'))
);
ALTER TABLE creator_portfolios ADD CONSTRAINT creator_portfolio_current_revision_fk
 FOREIGN KEY(id,current_revision) REFERENCES creator_portfolio_revisions(portfolio_id,revision) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE creator_portfolio_items ADD CONSTRAINT creator_portfolio_item_revision_fk
 FOREIGN KEY(portfolio_id,last_revision) REFERENCES creator_portfolio_revisions(portfolio_id,revision) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION guard_creator_portfolio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.current_revision<>1 THEN RAISE EXCEPTION 'PORTFOLIO_INITIAL_REVISION'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.owner_profile_id<>OLD.owner_profile_id OR NEW.current_revision<>OLD.current_revision+1) THEN RAISE EXCEPTION 'PORTFOLIO_MONOTONIC_IDENTITY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_portfolio_guard BEFORE INSERT OR UPDATE ON creator_portfolios FOR EACH ROW EXECUTE FUNCTION guard_creator_portfolio();
CREATE FUNCTION guard_creator_portfolio_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND pg_trigger_depth()>1 AND NOT EXISTS(SELECT 1 FROM creator_portfolios WHERE id=OLD.portfolio_id) THEN RETURN OLD; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'PORTFOLIO_AUDIT_IMMUTABLE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_portfolios p JOIN creator_workspace_members m ON m.workspace_id=p.workspace_id JOIN users u ON u.id=m.user_id
 WHERE p.id=NEW.portfolio_id AND m.id=NEW.actor_membership_id AND m.user_id=NEW.actor_user_id AND m.security_role_token=NEW.actor_role AND m.is_active_active AND u.auth_state='ACTIVE') THEN RAISE EXCEPTION 'PORTFOLIO_ACTOR_MISMATCH'; END IF;
 IF NEW.previous_revision>0 AND NOT EXISTS(SELECT 1 FROM creator_portfolio_revisions WHERE portfolio_id=NEW.portfolio_id AND revision=NEW.previous_revision) THEN RAISE EXCEPTION 'PORTFOLIO_REVISION_GAP'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER creator_portfolio_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON creator_portfolio_revisions FOR EACH ROW EXECUTE FUNCTION guard_creator_portfolio_revision();
