-- P1 correction 2: legacy Brand composite keys contain nullable brand_id for
-- Creator rows. Add owner-scope identities and fail-closed lineage checks so
-- NULL semantics cannot permit cross-Creator substitution.

CREATE UNIQUE INDEX "uq_de_resource_owner_identity"
  ON "data_extraction_resources"("owner_scope_id", "source_class", "canonical_resource_key_hash");
CREATE UNIQUE INDEX "uq_de_capture_owner_request"
  ON "data_extraction_captures"("owner_scope_id", "acquisition_request_key");
CREATE UNIQUE INDEX "uq_de_capture_owner_resource"
  ON "data_extraction_captures"("owner_scope_id", "capture_ref", "resource_ref");
CREATE UNIQUE INDEX "uq_de_capexec_owner_request"
  ON "data_extraction_capability_executions"("owner_scope_id", "request_key");
CREATE UNIQUE INDEX "uq_de_capexec_owner_capability"
  ON "data_extraction_capability_executions"("owner_scope_id", "capability_execution_ref", "capability_id");
CREATE UNIQUE INDEX "uq_de_evidence_owner_capability"
  ON "data_extraction_evidence_items"("owner_scope_id", "evidence_ref", "capability_id");
CREATE UNIQUE INDEX "uq_de_evidence_owner_idempotency"
  ON "data_extraction_evidence_items"("owner_scope_id", "capture_ref", "capability_id", "normalization_contract_version", "item_fingerprint");
CREATE UNIQUE INDEX "uq_de_observation_owner_capability"
  ON "data_extraction_semantic_observations"("owner_scope_id", "semantic_observation_key", "capability_id");

CREATE UNIQUE INDEX "uq_intelligence_subject_owner_id"
  ON "intelligence_subjects"("owner_scope_id", "subject_id");
CREATE UNIQUE INDEX "uq_intelligence_object_owner_id"
  ON "intelligence_object_generations"("owner_scope_id", "object_generation_id");
CREATE UNIQUE INDEX "uq_intelligence_object_owner_address"
  ON "intelligence_object_generations"("owner_scope_id", "subject_id", "object_semantic_id", "object_generation_id");
CREATE UNIQUE INDEX "uq_intelligence_component_owner_id"
  ON "intelligence_component_generations"("owner_scope_id", "component_generation_id");
CREATE UNIQUE INDEX "uq_intelligence_component_owner_address"
  ON "intelligence_component_generations"("owner_scope_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path", "component_generation_id");
CREATE UNIQUE INDEX "uq_intelligence_current_owner_address"
  ON "intelligence_current_components"("owner_scope_id", "subject_id", "object_semantic_id", "path_scheme_version", "component_semantic_path");
CREATE UNIQUE INDEX "uq_intelligence_action_owner_request"
  ON "intelligence_actions"("owner_scope_id", "subject_id", "action_type", "request_idempotency_key");

CREATE OR REPLACE FUNCTION "enforce_intelligence_owner_lineage"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'data_extraction_captures' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_resources r WHERE r.owner_scope_id = NEW.owner_scope_id AND r.resource_ref = NEW.resource_ref) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_RESOURCE_LINEAGE_MISMATCH';
    END IF;
    IF NEW.capability_execution_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data_extraction_capability_executions e WHERE e.owner_scope_id = NEW.owner_scope_id AND e.capability_execution_ref = NEW.capability_execution_ref) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_CAPABILITY_LINEAGE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_content_artifacts' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_captures c WHERE c.owner_scope_id = NEW.owner_scope_id AND c.capture_ref = NEW.capture_ref) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_CAPTURE_LINEAGE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_capability_resources' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_capability_executions e WHERE e.owner_scope_id = NEW.owner_scope_id AND e.capability_execution_ref = NEW.capability_execution_ref AND e.capability_id = NEW.capability_id)
       OR NOT EXISTS (SELECT 1 FROM data_extraction_resources r WHERE r.owner_scope_id = NEW.owner_scope_id AND r.resource_ref = NEW.resource_ref) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_CAPABILITY_RESOURCE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_evidence_items' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_resources r WHERE r.owner_scope_id = NEW.owner_scope_id AND r.resource_ref = NEW.resource_ref)
       OR NOT EXISTS (SELECT 1 FROM data_extraction_captures c WHERE c.owner_scope_id = NEW.owner_scope_id AND c.capture_ref = NEW.capture_ref AND c.resource_ref = NEW.resource_ref)
       OR (NEW.content_artifact_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data_extraction_content_artifacts a WHERE a.owner_scope_id = NEW.owner_scope_id AND a.content_artifact_ref = NEW.content_artifact_ref)) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_EVIDENCE_LINEAGE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_capability_evidence' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_capability_executions e WHERE e.owner_scope_id = NEW.owner_scope_id AND e.capability_execution_ref = NEW.capability_execution_ref AND e.capability_id = NEW.capability_id)
       OR NOT EXISTS (SELECT 1 FROM data_extraction_evidence_items i WHERE i.owner_scope_id = NEW.owner_scope_id AND i.evidence_ref = NEW.evidence_ref AND i.capability_id = NEW.capability_id) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_CAPABILITY_EVIDENCE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_observation_support' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_semantic_observations o WHERE o.owner_scope_id = NEW.owner_scope_id AND o.semantic_observation_key = NEW.semantic_observation_key AND o.capability_id = NEW.capability_id)
       OR NOT EXISTS (SELECT 1 FROM data_extraction_evidence_items i WHERE i.owner_scope_id = NEW.owner_scope_id AND i.evidence_ref = NEW.evidence_ref AND i.capability_id = NEW.capability_id) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_OBSERVATION_SUPPORT_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_observation_relations' THEN
    IF NOT EXISTS (SELECT 1 FROM data_extraction_semantic_observations o WHERE o.owner_scope_id = NEW.owner_scope_id AND o.semantic_observation_key = NEW.source_observation_key AND o.capability_id = NEW.capability_id)
       OR NOT EXISTS (SELECT 1 FROM data_extraction_semantic_observations o WHERE o.owner_scope_id = NEW.owner_scope_id AND o.semantic_observation_key = NEW.target_observation_key AND o.capability_id = NEW.capability_id) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_OBSERVATION_RELATION_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_freshness_assessments' THEN
    IF NEW.prior_capture_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data_extraction_captures c WHERE c.owner_scope_id = NEW.owner_scope_id AND c.capture_ref = NEW.prior_capture_ref) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_FRESHNESS_CAPTURE_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'data_extraction_provider_execution_links' THEN
    IF (NEW.capture_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data_extraction_captures c WHERE c.owner_scope_id = NEW.owner_scope_id AND c.capture_ref = NEW.capture_ref))
       OR (NEW.capability_execution_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM data_extraction_capability_executions e WHERE e.owner_scope_id = NEW.owner_scope_id AND e.capability_execution_ref = NEW.capability_execution_ref)) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_PROVIDER_EXECUTION_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'intelligence_object_generations' THEN
    IF NOT EXISTS (SELECT 1 FROM intelligence_subjects s WHERE s.owner_scope_id = NEW.owner_scope_id AND s.subject_id = NEW.subject_id) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_INTELLIGENCE_SUBJECT_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'intelligence_component_generations' THEN
    IF NOT EXISTS (SELECT 1 FROM intelligence_object_generations g WHERE g.owner_scope_id = NEW.owner_scope_id AND g.object_generation_id = NEW.object_generation_id AND g.subject_id = NEW.subject_id AND g.object_semantic_id = NEW.object_semantic_id) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_OBJECT_GENERATION_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'intelligence_current_components' THEN
    IF NOT EXISTS (SELECT 1 FROM intelligence_component_generations g WHERE g.owner_scope_id = NEW.owner_scope_id AND g.component_generation_id = NEW.current_component_generation_id AND g.subject_id = NEW.subject_id AND g.object_semantic_id = NEW.object_semantic_id AND g.path_scheme_version = NEW.path_scheme_version AND g.component_semantic_path = NEW.component_semantic_path) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_CURRENT_GENERATION_MISMATCH';
    END IF;
  ELSIF TG_TABLE_NAME = 'intelligence_evidence_references' THEN
    IF NOT EXISTS (SELECT 1 FROM intelligence_object_generations g WHERE g.owner_scope_id = NEW.owner_scope_id AND g.object_generation_id = NEW.object_generation_id)
       OR NOT EXISTS (SELECT 1 FROM data_extraction_evidence_items e WHERE e.owner_scope_id = NEW.owner_scope_id AND e.evidence_ref = NEW.evidence_ref AND e.capability_id = NEW.capability_id AND e.capture_ref = NEW.capture_id) THEN
      RAISE EXCEPTION 'OWNER_SCOPE_INTELLIGENCE_EVIDENCE_MISMATCH';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "trg_de_capture_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_captures" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_artifact_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_content_artifacts" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_capresource_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_capability_resources" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_evidence_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_evidence_items" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_capevidence_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_capability_evidence" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_support_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_observation_support" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_relation_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_observation_relations" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_freshness_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_freshness_assessments" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_de_provider_link_owner_lineage" BEFORE INSERT OR UPDATE ON "data_extraction_provider_execution_links" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_intelligence_object_owner_lineage" BEFORE INSERT OR UPDATE ON "intelligence_object_generations" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_intelligence_component_owner_lineage" BEFORE INSERT OR UPDATE ON "intelligence_component_generations" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_intelligence_current_owner_lineage" BEFORE INSERT OR UPDATE ON "intelligence_current_components" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
CREATE TRIGGER "trg_intelligence_evidence_owner_lineage" BEFORE INSERT OR UPDATE ON "intelligence_evidence_references" FOR EACH ROW EXECUTE FUNCTION "enforce_intelligence_owner_lineage"();
