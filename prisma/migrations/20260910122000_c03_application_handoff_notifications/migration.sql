BEGIN;

-- Preflight: accepted 78-migration fixture, explicit Brand scopes and preserved
-- legacy Collaboration/Brief/Product/history rows. No lineage is inferred.
CREATE TYPE "CollaborationHandoffCommercialState" AS ENUM ('FIXED_AGREED', 'AWAITING_CREATOR_PROPOSAL');
ALTER TABLE collaborations
  ADD COLUMN source_application_id TEXT,
  ADD COLUMN handoff_commercial_state "CollaborationHandoffCommercialState",
  ALTER COLUMN brief_id DROP NOT NULL,
  ADD CONSTRAINT collaborations_source_application_id_fkey FOREIGN KEY (source_application_id) REFERENCES uce_applications(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX collaborations_source_application_id_key ON collaborations(source_application_id);
DROP INDEX collaborations_campaign_id_creator_id_key;
CREATE INDEX collaborations_campaign_id_creator_id_idx ON collaborations(campaign_id, creator_id);
CREATE UNIQUE INDEX collaborations_legacy_campaign_creator_key ON collaborations(campaign_id, creator_id) WHERE source_application_id IS NULL;
ALTER TABLE application_domain_events ADD CONSTRAINT application_domain_events_approved_collaboration_id_fkey FOREIGN KEY (approved_collaboration_id) REFERENCES collaborations(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION c03_collaboration_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a uce_applications%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.source_application_id IS DISTINCT FROM OLD.source_application_id THEN
    RAISE EXCEPTION 'C03_COLLABORATION_SOURCE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  IF NEW.source_application_id IS NULL THEN
    IF NEW.brief_id IS NULL OR NEW.handoff_commercial_state IS NOT NULL THEN
      RAISE EXCEPTION 'C03_LEGACY_COLLABORATION_IDENTITY_INVALID' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO a FROM uce_applications WHERE id = NEW.source_application_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'C03_APPLICATION_NOT_FOUND' USING ERRCODE = '23503'; END IF;
  IF a.authority_version <> 'C03_CANONICAL' OR a.status <> 'APPROVED' OR
     a.campaign_id IS DISTINCT FROM NEW.campaign_id OR a.brand_profile_id IS DISTINCT FROM NEW.brand_id OR
     NOT EXISTS (SELECT 1 FROM creator_profiles p JOIN creator_workspaces w ON w.owner_profile_id = p.id
       WHERE p.id = a.subject_creator_profile_id AND w.id = a.subject_creator_workspace_id AND p.user_id = NEW.creator_id) OR
     NEW.brief_id IS NOT NULL OR NEW.product_id IS NOT NULL OR NEW.uce_pipeline_collaboration_id IS NOT NULL OR
     NEW.handoff_commercial_state IS NULL THEN
    RAISE EXCEPTION 'C03_COLLABORATION_SOURCE_INVALID' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER c03_collaboration_source_guard BEFORE INSERT OR UPDATE ON collaborations FOR EACH ROW EXECUTE FUNCTION c03_collaboration_source_guard();

CREATE FUNCTION c03_approved_event_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_name = 'application.approved' THEN
    IF NEW.approved_collaboration_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM collaborations c WHERE c.id = NEW.approved_collaboration_id AND c.source_application_id = NEW.application_id
    ) THEN RAISE EXCEPTION 'C03_APPROVED_EVENT_COLLABORATION_REQUIRED' USING ERRCODE = '23514'; END IF;
  ELSIF NEW.approved_collaboration_id IS NOT NULL THEN
    RAISE EXCEPTION 'C03_NON_APPROVAL_COLLABORATION_LINK' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER c03_approved_event_link_guard BEFORE INSERT ON application_domain_events FOR EACH ROW EXECUTE FUNCTION c03_approved_event_link_guard();

-- Existing deferred matching-event guard plus the approval event link guard
-- guarantee that a canonical APPROVED Application cannot commit without its
-- unique Collaboration. The event FK also prevents deleting that Collaboration.

ALTER TABLE notifications ALTER COLUMN workspace_id DROP NOT NULL,
  ADD COLUMN creator_workspace_id TEXT,
  ADD CONSTRAINT notifications_creator_workspace_id_fkey FOREIGN KEY (creator_workspace_id) REFERENCES creator_workspaces(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT notifications_exactly_one_scope CHECK (num_nonnulls(workspace_id, creator_workspace_id) = 1);
ALTER TABLE notification_jobs ALTER COLUMN workspace_id DROP NOT NULL,
  ADD COLUMN creator_workspace_id TEXT,
  ADD CONSTRAINT notification_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES brand_profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT notification_jobs_creator_workspace_id_fkey FOREIGN KEY (creator_workspace_id) REFERENCES creator_workspaces(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT notification_jobs_exactly_one_scope CHECK (num_nonnulls(workspace_id, creator_workspace_id) = 1);
-- PostgreSQL NULL-distinct uniqueness preserves existing Brand semantic keys;
-- the parallel Creator key applies to the other arm of the exactly-one scope.
CREATE UNIQUE INDEX notifications_creator_scope_semantic_key ON notifications(creator_workspace_id, event_type, semantic_event_key);
CREATE INDEX notifications_creator_workspace_id_created_at_idx ON notifications(creator_workspace_id, created_at);
CREATE UNIQUE INDEX notification_jobs_creator_scope_semantic_key ON notification_jobs(creator_workspace_id, event_type, semantic_event_key);
COMMIT;
