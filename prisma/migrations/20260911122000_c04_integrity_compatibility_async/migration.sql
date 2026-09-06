-- C-04 M3: integrity/compatibility fences plus durable asynchronous support.

CREATE TYPE "CollaborationOutboxState" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "collaboration_events"
  ADD COLUMN "actor_membership_id" TEXT,
  ADD COLUMN "actor_role" "CreatorTeamRole",
  ADD COLUMN "actor_workspace_id" TEXT,
  ADD COLUMN "actor_organization_id" TEXT,
  ADD COLUMN "subject_creator_profile_id" TEXT;

ALTER TABLE "collaboration_messages"
  ADD COLUMN "sender_membership_id" TEXT,
  ADD COLUMN "sender_role" "CreatorTeamRole",
  ADD COLUMN "sender_workspace_id" TEXT,
  ADD COLUMN "subject_creator_profile_id" TEXT,
  ADD COLUMN "source_event_id" TEXT;

CREATE UNIQUE INDEX "collaboration_messages_source_event_id_key" ON "collaboration_messages"("source_event_id");

CREATE TABLE "collaboration_projection_outbox" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "projection_type" VARCHAR(80) NOT NULL,
  "state" "CollaborationOutboxState" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(100),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "collaboration_projection_outbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "collaboration_trusted_confirmations" (
  "id" TEXT NOT NULL,
  "collaboration_id" TEXT NOT NULL,
  "confirmation_id" TEXT NOT NULL,
  "confirmation_type" VARCHAR(80) NOT NULL,
  "body_digest" CHAR(64) NOT NULL,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaboration_trusted_confirmations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "collaboration_trusted_confirmations_digest_check" CHECK ("body_digest" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "collaboration_projection_outbox_event_id_projection_type_key" ON "collaboration_projection_outbox"("event_id", "projection_type");
CREATE INDEX "collaboration_projection_outbox_state_available_at_idx" ON "collaboration_projection_outbox"("state", "available_at");
CREATE UNIQUE INDEX "collaboration_trusted_confirmations_confirmation_type_confirmation_id_key" ON "collaboration_trusted_confirmations"("confirmation_type", "confirmation_id");
CREATE INDEX "collaboration_trusted_confirmations_collaboration_id_applied_at_idx" ON "collaboration_trusted_confirmations"("collaboration_id", "applied_at");

ALTER TABLE "collaboration_projection_outbox" ADD CONSTRAINT "collaboration_projection_outbox_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_projection_outbox" ADD CONSTRAINT "collaboration_projection_outbox_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "collaboration_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collaboration_trusted_confirmations" ADD CONSTRAINT "collaboration_trusted_confirmations_collaboration_id_fkey" FOREIGN KEY ("collaboration_id") REFERENCES "collaborations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_creator_actor_context_check" CHECK (
  "actor_class" <> 'CREATOR'
  OR (
    "actor_user_id" IS NOT NULL
    AND "actor_membership_id" IS NOT NULL
    AND "actor_role" IS NOT NULL
    AND "actor_workspace_id" IS NOT NULL
    AND "subject_creator_profile_id" IS NOT NULL
  )
);

ALTER TABLE "collaboration_events" ADD CONSTRAINT "collaboration_events_destination_pii_absent_check" CHECK (
  "payload" IS NULL OR "payload"::text !~* 'recipient[_A-Za-z]*name|address[_A-Za-z]*line|postal[_A-Za-z]*code|phone[_A-Za-z]*(number|e164)|delivery[_A-Za-z]*instructions'
);

CREATE OR REPLACE FUNCTION c04_require_canonical_collaboration_lineage()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."authority_version" = 'CANONICAL_V1' THEN
    IF NEW."source_application_id" IS NULL
       OR NEW."creator_profile_id" IS NULL
       OR NEW."creator_workspace_id" IS NULL
       OR NEW."campaign_asset_id" IS NULL THEN
      RAISE EXCEPTION 'C04_CANONICAL_LINEAGE_REQUIRED' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "collaboration_execution_snapshots" s WHERE s."collaboration_id" = NEW."id")
       OR NOT EXISTS (SELECT 1 FROM "collaboration_commercial_agreements" a WHERE a."collaboration_id" = NEW."id")
       OR NOT EXISTS (SELECT 1 FROM "collaboration_fulfillments" f WHERE f."collaboration_id" = NEW."id") THEN
      RAISE EXCEPTION 'C04_CANONICAL_EXECUTION_FOUNDATION_REQUIRED' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER "c04_canonical_collaboration_lineage_guard"
AFTER INSERT OR UPDATE ON "collaborations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION c04_require_canonical_collaboration_lineage();

CREATE OR REPLACE FUNCTION c04_prevent_destination_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'C04_DELIVERY_DESTINATION_IMMUTABLE' USING ERRCODE = '23001';
END;
$$;

CREATE TRIGGER "c04_delivery_destination_immutable_guard"
BEFORE UPDATE OR DELETE ON "collaboration_delivery_destinations"
FOR EACH ROW EXECUTE FUNCTION c04_prevent_destination_mutation();

CREATE OR REPLACE FUNCTION c04_prevent_canonical_legacy_write()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_collaboration_id text;
BEGIN
  target_collaboration_id := COALESCE(NEW."collaboration_id", OLD."collaboration_id");
  IF EXISTS (
    SELECT 1 FROM "collaborations" c
    WHERE c."id" = target_collaboration_id
      AND c."authority_version" = 'CANONICAL_V1'
  ) THEN
    RAISE EXCEPTION 'C04_CANONICAL_LEGACY_WRITE_RETIRED' USING ERRCODE = '23001';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "c04_commercial_legacy_write_guard" BEFORE INSERT OR UPDATE OR DELETE ON "collaboration_commercials" FOR EACH ROW EXECUTE FUNCTION c04_prevent_canonical_legacy_write();
CREATE TRIGGER "c04_logistics_legacy_write_guard" BEFORE INSERT OR UPDATE OR DELETE ON "collaboration_logistics" FOR EACH ROW EXECUTE FUNCTION c04_prevent_canonical_legacy_write();
CREATE TRIGGER "c04_media_legacy_write_guard" BEFORE INSERT OR UPDATE OR DELETE ON "collaboration_media" FOR EACH ROW EXECUTE FUNCTION c04_prevent_canonical_legacy_write();
CREATE TRIGGER "c04_finalization_legacy_write_guard" BEFORE INSERT OR UPDATE OR DELETE ON "collaboration_finalization" FOR EACH ROW EXECUTE FUNCTION c04_prevent_canonical_legacy_write();
