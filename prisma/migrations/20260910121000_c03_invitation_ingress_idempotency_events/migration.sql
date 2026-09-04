BEGIN;

CREATE TYPE "CampaignOpportunityEntrySurface" AS ENUM (
  'DIRECT_CAMPAIGN_LINK',
  'TRACKED_CAMPAIGN_SHARE',
  'BRAND_INVITATION',
  'CREATOR_OPPORTUNITIES'
);

CREATE TYPE "CampaignOpportunityEntryAuthorityKind" AS ENUM (
  'DIRECT',
  'SHARE',
  'INVITATION'
);

CREATE TYPE "CampaignIngressTouchKind" AS ENUM (
  'QUALIFIED_INGRESS',
  'APPLICATION_CONVERSION'
);

CREATE TYPE "ApplicationCommandType" AS ENUM (
  'SUBMIT',
  'WITHDRAW',
  'APPROVE',
  'REJECT'
);

CREATE TYPE "ApplicationDomainEventName" AS ENUM (
  'application.submitted',
  'application.approved',
  'application.rejected',
  'application.withdrawn',
  'application.expired'
);

CREATE TYPE "ApplicationEventActorClass" AS ENUM (
  'CREATOR_TEAM_USER',
  'BRAND_USER',
  'SYSTEM'
);

ALTER TABLE "uce_campaign_shares"
  ADD CONSTRAINT "uce_campaign_shares_campaign_id_id_key"
  UNIQUE ("campaign_id", "id");

ALTER TABLE "creator_entry_continuations"
  ADD COLUMN "context_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "entry_surface" "CampaignOpportunityEntrySurface" NOT NULL DEFAULT 'DIRECT_CAMPAIGN_LINK',
  ADD COLUMN "entry_authority_kind" "CampaignOpportunityEntryAuthorityKind" NOT NULL DEFAULT 'DIRECT',
  ADD COLUMN "campaign_share_id" TEXT,
  ADD COLUMN "campaign_invitation_id" TEXT,
  ADD COLUMN "first_qualified_touch_id" TEXT,
  ADD COLUMN "bound_creator_workspace_id" TEXT,
  ADD COLUMN "bound_creator_profile_id" TEXT;

CREATE TABLE "campaign_opportunity_invitations" (
  "id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "token_digest" CHAR(64) NOT NULL,
  "intended_creator_profile_id" TEXT,
  "intended_native_instagram_id_hmac" CHAR(64),
  "intended_verified_email_hmac" CHAR(64),
  "bound_creator_profile_id" TEXT,
  "bound_creator_workspace_id" TEXT,
  "issued_by_actor_user_id" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revoked_by_actor_user_id" TEXT,
  "binding_version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "campaign_opportunity_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_opportunity_invitations_intended_subject_check" CHECK (
    "intended_creator_profile_id" IS NOT NULL
    OR "intended_native_instagram_id_hmac" IS NOT NULL
    OR "intended_verified_email_hmac" IS NOT NULL
  ),
  CONSTRAINT "campaign_opportunity_invitations_digest_check" CHECK (
    "token_digest" ~ '^[0-9a-f]{64}$'
    AND (
      "intended_native_instagram_id_hmac" IS NULL
      OR "intended_native_instagram_id_hmac" ~ '^[0-9a-f]{64}$'
    )
    AND (
      "intended_verified_email_hmac" IS NULL
      OR "intended_verified_email_hmac" ~ '^[0-9a-f]{64}$'
    )
  ),
  CONSTRAINT "campaign_opportunity_invitations_lifetime_check" CHECK (
    "expires_at" > "issued_at"
  ),
  CONSTRAINT "campaign_opportunity_invitations_binding_check" CHECK (
    (
      "binding_version" = 0
      AND "bound_creator_profile_id" IS NULL
      AND "bound_creator_workspace_id" IS NULL
    ) OR (
      "binding_version" = 1
      AND "bound_creator_profile_id" IS NOT NULL
      AND "bound_creator_workspace_id" IS NOT NULL
    )
  ),
  CONSTRAINT "campaign_opportunity_invitations_revocation_check" CHECK (
    ("revoked_at" IS NULL AND "revoked_by_actor_user_id" IS NULL)
    OR ("revoked_at" IS NOT NULL AND "revoked_by_actor_user_id" IS NOT NULL)
  ),
  CONSTRAINT "campaign_opportunity_invitations_campaign_id_id_key"
    UNIQUE ("campaign_id", "id")
);

CREATE UNIQUE INDEX "campaign_opportunity_invitations_token_digest_key"
  ON "campaign_opportunity_invitations"("token_digest");
CREATE INDEX "campaign_opportunity_invitations_campaign_id_expires_at_idx"
  ON "campaign_opportunity_invitations"("campaign_id", "expires_at");
CREATE INDEX "campaign_opportunity_invitations_intended_creator_profile_id_idx"
  ON "campaign_opportunity_invitations"("intended_creator_profile_id");
CREATE INDEX "campaign_opportunity_invitations_bound_workspace_profile_idx"
  ON "campaign_opportunity_invitations"(
    "bound_creator_workspace_id", "bound_creator_profile_id"
  );

ALTER TABLE "campaign_opportunity_invitations"
  ADD CONSTRAINT "campaign_opportunity_invitations_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_opportunity_invitations_intended_profile_id_fkey"
    FOREIGN KEY ("intended_creator_profile_id") REFERENCES "creator_profiles"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_opportunity_invitations_bound_workspace_owner_fkey"
    FOREIGN KEY ("bound_creator_workspace_id", "bound_creator_profile_id")
    REFERENCES "creator_workspaces"("id", "owner_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_opportunity_invitations_issuer_user_id_fkey"
    FOREIGN KEY ("issued_by_actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_opportunity_invitations_revoker_user_id_fkey"
    FOREIGN KEY ("revoked_by_actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "campaign_ingress_touches" (
  "id" TEXT NOT NULL,
  "kind" "CampaignIngressTouchKind" NOT NULL,
  "reference_digest" CHAR(64),
  "campaign_id" TEXT NOT NULL,
  "entry_surface" "CampaignOpportunityEntrySurface" NOT NULL,
  "entry_authority_kind" "CampaignOpportunityEntryAuthorityKind" NOT NULL,
  "campaign_share_id" TEXT,
  "campaign_invitation_id" TEXT,
  "bound_creator_profile_id" TEXT,
  "bound_creator_workspace_id" TEXT,
  "utm_source" VARCHAR(100),
  "utm_medium" VARCHAR(100),
  "utm_campaign" VARCHAR(100),
  "utm_content" VARCHAR(200),
  "utm_term" VARCHAR(200),
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bound_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "campaign_ingress_touches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaign_ingress_touches_reference_shape_check" CHECK (
    (
      "kind" = 'QUALIFIED_INGRESS'::"CampaignIngressTouchKind"
      AND "reference_digest" ~ '^[0-9a-f]{64}$'
    ) OR (
      "kind" = 'APPLICATION_CONVERSION'::"CampaignIngressTouchKind"
      AND "reference_digest" IS NULL
    )
  ),
  CONSTRAINT "campaign_ingress_touches_authority_shape_check" CHECK (
    (
      "entry_authority_kind" = 'DIRECT'::"CampaignOpportunityEntryAuthorityKind"
      AND "entry_surface" IN (
        'DIRECT_CAMPAIGN_LINK'::"CampaignOpportunityEntrySurface",
        'CREATOR_OPPORTUNITIES'::"CampaignOpportunityEntrySurface"
      )
      AND "campaign_share_id" IS NULL
      AND "campaign_invitation_id" IS NULL
    ) OR (
      "entry_authority_kind" = 'SHARE'::"CampaignOpportunityEntryAuthorityKind"
      AND "entry_surface" = 'TRACKED_CAMPAIGN_SHARE'::"CampaignOpportunityEntrySurface"
      AND "campaign_share_id" IS NOT NULL
      AND "campaign_invitation_id" IS NULL
    ) OR (
      "entry_authority_kind" = 'INVITATION'::"CampaignOpportunityEntryAuthorityKind"
      AND "entry_surface" = 'BRAND_INVITATION'::"CampaignOpportunityEntrySurface"
      AND "campaign_share_id" IS NULL
      AND "campaign_invitation_id" IS NOT NULL
    )
  ),
  CONSTRAINT "campaign_ingress_touches_binding_check" CHECK (
    (
      "bound_creator_profile_id" IS NULL
      AND "bound_creator_workspace_id" IS NULL
      AND "bound_at" IS NULL
    ) OR (
      "bound_creator_profile_id" IS NOT NULL
      AND "bound_creator_workspace_id" IS NOT NULL
      AND "bound_at" IS NOT NULL
    )
  ),
  CONSTRAINT "campaign_ingress_touches_utm_control_check" CHECK (
    ("utm_source" IS NULL OR "utm_source" !~ '[[:cntrl:]]')
    AND ("utm_medium" IS NULL OR "utm_medium" !~ '[[:cntrl:]]')
    AND ("utm_campaign" IS NULL OR "utm_campaign" !~ '[[:cntrl:]]')
    AND ("utm_content" IS NULL OR "utm_content" !~ '[[:cntrl:]]')
    AND ("utm_term" IS NULL OR "utm_term" !~ '[[:cntrl:]]')
  ),
  CONSTRAINT "campaign_ingress_touches_campaign_id_id_key"
    UNIQUE ("campaign_id", "id")
);

CREATE UNIQUE INDEX "campaign_ingress_touches_reference_digest_key"
  ON "campaign_ingress_touches"("reference_digest");
CREATE INDEX "campaign_ingress_touches_campaign_id_occurred_at_idx"
  ON "campaign_ingress_touches"("campaign_id", "occurred_at");
CREATE INDEX "campaign_ingress_touches_campaign_share_id_idx"
  ON "campaign_ingress_touches"("campaign_share_id");
CREATE INDEX "campaign_ingress_touches_campaign_invitation_id_idx"
  ON "campaign_ingress_touches"("campaign_invitation_id");
CREATE INDEX "campaign_ingress_touches_bound_workspace_profile_idx"
  ON "campaign_ingress_touches"(
    "bound_creator_workspace_id", "bound_creator_profile_id"
  );

ALTER TABLE "campaign_ingress_touches"
  ADD CONSTRAINT "campaign_ingress_touches_campaign_id_fkey"
    FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_ingress_touches_campaign_share_fkey"
    FOREIGN KEY ("campaign_id", "campaign_share_id")
    REFERENCES "uce_campaign_shares"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_ingress_touches_invitation_fkey"
    FOREIGN KEY ("campaign_id", "campaign_invitation_id")
    REFERENCES "campaign_opportunity_invitations"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "campaign_ingress_touches_bound_workspace_owner_fkey"
    FOREIGN KEY ("bound_creator_workspace_id", "bound_creator_profile_id")
    REFERENCES "creator_workspaces"("id", "owner_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "application_domain_events" (
  "id" TEXT NOT NULL,
  "transition_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "application_version" INTEGER NOT NULL,
  "event_name" "ApplicationDomainEventName" NOT NULL,
  "event_version" INTEGER NOT NULL DEFAULT 1,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "from_status" "UceApplicationStatus",
  "to_status" "UceApplicationStatus" NOT NULL,
  "actor_class" "ApplicationEventActorClass" NOT NULL,
  "actor_user_id" TEXT,
  "actor_membership_id" TEXT,
  "actor_role" "CreatorTeamRole",
  "subject_creator_profile_id" TEXT NOT NULL,
  "subject_creator_workspace_id" TEXT NOT NULL,
  "brand_profile_id" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "canonical_campaign_asset_id" TEXT NOT NULL,
  "canonical_brief_id" TEXT NOT NULL,
  "approved_collaboration_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_domain_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_domain_events_version_check" CHECK (
    "application_version" >= 1 AND "event_version" = 1
  ),
  CONSTRAINT "application_domain_events_shape_check" CHECK (
    (
      "event_name" = 'application.submitted'::"ApplicationDomainEventName"
      AND "application_version" = 1
      AND "from_status" IS NULL
      AND "to_status" = 'PENDING'::"UceApplicationStatus"
      AND "actor_class" = 'CREATOR_TEAM_USER'::"ApplicationEventActorClass"
      AND "actor_user_id" IS NOT NULL
      AND "actor_membership_id" IS NOT NULL
      AND "actor_role" IS NOT NULL
    ) OR (
      "event_name" = 'application.approved'::"ApplicationDomainEventName"
      AND "from_status" = 'PENDING'::"UceApplicationStatus"
      AND "to_status" = 'APPROVED'::"UceApplicationStatus"
      AND "actor_class" = 'BRAND_USER'::"ApplicationEventActorClass"
      AND "actor_user_id" IS NOT NULL
      AND "actor_membership_id" IS NULL
      AND "actor_role" IS NULL
    ) OR (
      "event_name" = 'application.rejected'::"ApplicationDomainEventName"
      AND "from_status" = 'PENDING'::"UceApplicationStatus"
      AND "to_status" = 'REJECTED'::"UceApplicationStatus"
      AND "actor_class" = 'BRAND_USER'::"ApplicationEventActorClass"
      AND "actor_user_id" IS NOT NULL
      AND "actor_membership_id" IS NULL
      AND "actor_role" IS NULL
    ) OR (
      "event_name" = 'application.withdrawn'::"ApplicationDomainEventName"
      AND "from_status" = 'PENDING'::"UceApplicationStatus"
      AND "to_status" = 'WITHDRAWN'::"UceApplicationStatus"
      AND "actor_class" = 'CREATOR_TEAM_USER'::"ApplicationEventActorClass"
      AND "actor_user_id" IS NOT NULL
      AND "actor_membership_id" IS NOT NULL
      AND "actor_role" IS NOT NULL
    ) OR (
      "event_name" = 'application.expired'::"ApplicationDomainEventName"
      AND "from_status" = 'PENDING'::"UceApplicationStatus"
      AND "to_status" = 'EXPIRED'::"UceApplicationStatus"
      AND "actor_class" = 'SYSTEM'::"ApplicationEventActorClass"
      AND "actor_user_id" IS NULL
      AND "actor_membership_id" IS NULL
      AND "actor_role" IS NULL
    )
  )
);

CREATE UNIQUE INDEX "application_domain_events_transition_id_key"
  ON "application_domain_events"("transition_id");
CREATE UNIQUE INDEX "application_domain_events_application_version_key"
  ON "application_domain_events"("application_id", "application_version");
CREATE INDEX "application_domain_events_application_id_occurred_at_idx"
  ON "application_domain_events"("application_id", "occurred_at");
CREATE INDEX "application_domain_events_campaign_id_occurred_at_idx"
  ON "application_domain_events"("campaign_id", "occurred_at");
CREATE INDEX "application_domain_events_subject_workspace_occurred_at_idx"
  ON "application_domain_events"("subject_creator_workspace_id", "occurred_at");
CREATE INDEX "application_domain_events_brand_profile_id_occurred_at_idx"
  ON "application_domain_events"("brand_profile_id", "occurred_at");
CREATE INDEX "application_domain_events_actor_membership_id_idx"
  ON "application_domain_events"("actor_membership_id");

ALTER TABLE "application_domain_events"
  ADD CONSTRAINT "application_domain_events_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "uce_applications"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_actor_membership_id_fkey"
    FOREIGN KEY ("actor_membership_id") REFERENCES "creator_workspace_members"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_subject_workspace_owner_fkey"
    FOREIGN KEY ("subject_creator_workspace_id", "subject_creator_profile_id")
    REFERENCES "creator_workspaces"("id", "owner_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_brand_profile_id_fkey"
    FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_campaign_brand_fkey"
    FOREIGN KEY ("campaign_id", "brand_profile_id")
    REFERENCES "uce_campaigns"("id", "brand_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_campaign_asset_fkey"
    FOREIGN KEY ("campaign_id", "canonical_campaign_asset_id")
    REFERENCES "uce_campaign_assets"("campaign_id", "campaign_asset_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_domain_events_asset_brief_fkey"
    FOREIGN KEY ("canonical_campaign_asset_id", "canonical_brief_id")
    REFERENCES "campaign_briefs"("campaign_asset_id", "brief_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE "application_command_receipts" (
  "id" TEXT NOT NULL,
  "command_type" "ApplicationCommandType" NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "authority_subject_id" TEXT NOT NULL,
  "idempotency_key_digest" CHAR(64) NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "application_id" TEXT NOT NULL,
  "transition_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_command_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_command_receipts_digest_check" CHECK (
    "idempotency_key_digest" ~ '^[0-9a-f]{64}$'
    AND "request_fingerprint" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "application_command_receipts_scope_key"
  ON "application_command_receipts"(
    "command_type", "actor_user_id", "authority_subject_id",
    "idempotency_key_digest"
  );
CREATE UNIQUE INDEX "application_command_receipts_transition_id_key"
  ON "application_command_receipts"("transition_id");
CREATE INDEX "application_command_receipts_application_id_created_at_idx"
  ON "application_command_receipts"("application_id", "created_at");

ALTER TABLE "application_command_receipts"
  ADD CONSTRAINT "application_command_receipts_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_command_receipts_application_id_fkey"
    FOREIGN KEY ("application_id") REFERENCES "uce_applications"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "application_command_receipts_transition_id_fkey"
    FOREIGN KEY ("transition_id") REFERENCES "application_domain_events"("transition_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "creator_entry_continuations"
  ADD CONSTRAINT "creator_entry_continuations_token_digest_shape_check" CHECK (
    "token_digest" ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "creator_entry_continuations_context_version_check" CHECK (
    "context_version" = 1
  ),
  ADD CONSTRAINT "creator_entry_continuations_entry_authority_shape_check" CHECK (
    (
      "entry_authority_kind" = 'DIRECT'::"CampaignOpportunityEntryAuthorityKind"
      AND "entry_surface" IN (
        'DIRECT_CAMPAIGN_LINK'::"CampaignOpportunityEntrySurface",
        'CREATOR_OPPORTUNITIES'::"CampaignOpportunityEntrySurface"
      )
      AND "campaign_share_id" IS NULL
      AND "campaign_invitation_id" IS NULL
    ) OR (
      "entry_authority_kind" = 'SHARE'::"CampaignOpportunityEntryAuthorityKind"
      AND "entry_surface" = 'TRACKED_CAMPAIGN_SHARE'::"CampaignOpportunityEntrySurface"
      AND "campaign_share_id" IS NOT NULL
      AND "campaign_invitation_id" IS NULL
    ) OR (
      "entry_authority_kind" = 'INVITATION'::"CampaignOpportunityEntryAuthorityKind"
      AND "entry_surface" = 'BRAND_INVITATION'::"CampaignOpportunityEntrySurface"
      AND "campaign_share_id" IS NULL
      AND "campaign_invitation_id" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "creator_entry_continuations_subject_binding_check" CHECK (
    (
      "bound_creator_workspace_id" IS NULL
      AND "bound_creator_profile_id" IS NULL
    ) OR (
      "bound_creator_workspace_id" IS NOT NULL
      AND "bound_creator_profile_id" IS NOT NULL
    )
  );

ALTER TABLE "creator_entry_continuations"
  ADD CONSTRAINT "creator_entry_continuations_campaign_share_fkey"
    FOREIGN KEY ("campaign_id", "campaign_share_id")
    REFERENCES "uce_campaign_shares"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "creator_entry_continuations_invitation_fkey"
    FOREIGN KEY ("campaign_id", "campaign_invitation_id")
    REFERENCES "campaign_opportunity_invitations"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "creator_entry_continuations_first_touch_fkey"
    FOREIGN KEY ("campaign_id", "first_qualified_touch_id")
    REFERENCES "campaign_ingress_touches"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "creator_entry_continuations_bound_workspace_owner_fkey"
    FOREIGN KEY ("bound_creator_workspace_id", "bound_creator_profile_id")
    REFERENCES "creator_workspaces"("id", "owner_profile_id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX "creator_entry_continuations_campaign_share_id_idx"
  ON "creator_entry_continuations"("campaign_share_id");
CREATE INDEX "creator_entry_continuations_campaign_invitation_id_idx"
  ON "creator_entry_continuations"("campaign_invitation_id");
CREATE INDEX "creator_entry_continuations_first_qualified_touch_id_idx"
  ON "creator_entry_continuations"("first_qualified_touch_id");
CREATE INDEX "creator_entry_continuations_bound_workspace_profile_idx"
  ON "creator_entry_continuations"(
    "bound_creator_workspace_id", "bound_creator_profile_id"
  );

ALTER TABLE "uce_applications"
  ADD CONSTRAINT "uce_applications_campaign_invitation_fkey"
    FOREIGN KEY ("campaign_id", "campaign_invitation_id")
    REFERENCES "campaign_opportunity_invitations"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_first_qualified_touch_fkey"
    FOREIGN KEY ("campaign_id", "first_qualified_touch_id")
    REFERENCES "campaign_ingress_touches"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "uce_applications_conversion_touch_fkey"
    FOREIGN KEY ("campaign_id", "conversion_touch_id")
    REFERENCES "campaign_ingress_touches"("campaign_id", "id")
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION "c03_campaign_invitation_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'C03_INVITATION_DELETE_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id"
    OR NEW."token_digest" IS DISTINCT FROM OLD."token_digest"
    OR NEW."intended_creator_profile_id" IS DISTINCT FROM OLD."intended_creator_profile_id"
    OR NEW."intended_native_instagram_id_hmac" IS DISTINCT FROM OLD."intended_native_instagram_id_hmac"
    OR NEW."intended_verified_email_hmac" IS DISTINCT FROM OLD."intended_verified_email_hmac"
    OR NEW."issued_by_actor_user_id" IS DISTINCT FROM OLD."issued_by_actor_user_id"
    OR NEW."issued_at" IS DISTINCT FROM OLD."issued_at"
    OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"
  THEN
    RAISE EXCEPTION 'C03_INVITATION_AUTHORITY_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."binding_version" = 0 THEN
    IF NOT (
      (
        NEW."binding_version" = 0
        AND NEW."bound_creator_profile_id" IS NULL
        AND NEW."bound_creator_workspace_id" IS NULL
      ) OR (
        NEW."binding_version" = 1
        AND NEW."bound_creator_profile_id" IS NOT NULL
        AND NEW."bound_creator_workspace_id" IS NOT NULL
      )
    ) THEN
      RAISE EXCEPTION 'C03_INVITATION_BINDING_INVALID'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."binding_version" IS DISTINCT FROM OLD."binding_version"
    OR NEW."bound_creator_profile_id" IS DISTINCT FROM OLD."bound_creator_profile_id"
    OR NEW."bound_creator_workspace_id" IS DISTINCT FROM OLD."bound_creator_workspace_id"
  THEN
    RAISE EXCEPTION 'C03_INVITATION_REBIND_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."revoked_at" IS NOT NULL
    AND (
      NEW."revoked_at" IS DISTINCT FROM OLD."revoked_at"
      OR NEW."revoked_by_actor_user_id" IS DISTINCT FROM OLD."revoked_by_actor_user_id"
    )
  THEN
    RAISE EXCEPTION 'C03_INVITATION_REVOCATION_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_campaign_invitation_update_guard"
BEFORE UPDATE ON "campaign_opportunity_invitations"
FOR EACH ROW EXECUTE FUNCTION "c03_campaign_invitation_guard"();

CREATE TRIGGER "c03_campaign_invitation_delete_guard"
BEFORE DELETE ON "campaign_opportunity_invitations"
FOR EACH ROW EXECUTE FUNCTION "c03_campaign_invitation_guard"();

CREATE OR REPLACE FUNCTION "c03_campaign_ingress_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'C03_INGRESS_DELETE_FORBIDDEN'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."reference_digest" IS DISTINCT FROM OLD."reference_digest"
    OR NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id"
    OR NEW."entry_surface" IS DISTINCT FROM OLD."entry_surface"
    OR NEW."entry_authority_kind" IS DISTINCT FROM OLD."entry_authority_kind"
    OR NEW."campaign_share_id" IS DISTINCT FROM OLD."campaign_share_id"
    OR NEW."campaign_invitation_id" IS DISTINCT FROM OLD."campaign_invitation_id"
    OR NEW."utm_source" IS DISTINCT FROM OLD."utm_source"
    OR NEW."utm_medium" IS DISTINCT FROM OLD."utm_medium"
    OR NEW."utm_campaign" IS DISTINCT FROM OLD."utm_campaign"
    OR NEW."utm_content" IS DISTINCT FROM OLD."utm_content"
    OR NEW."utm_term" IS DISTINCT FROM OLD."utm_term"
    OR NEW."occurred_at" IS DISTINCT FROM OLD."occurred_at"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
  THEN
    RAISE EXCEPTION 'C03_INGRESS_PROVENANCE_IMMUTABLE'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."bound_creator_profile_id" IS NOT NULL
    OR OLD."bound_creator_workspace_id" IS NOT NULL
    OR OLD."bound_at" IS NOT NULL
  THEN
    IF NEW."bound_creator_profile_id" IS DISTINCT FROM OLD."bound_creator_profile_id"
      OR NEW."bound_creator_workspace_id" IS DISTINCT FROM OLD."bound_creator_workspace_id"
      OR NEW."bound_at" IS DISTINCT FROM OLD."bound_at"
    THEN
      RAISE EXCEPTION 'C03_INGRESS_REBIND_FORBIDDEN'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_campaign_ingress_update_guard"
BEFORE UPDATE ON "campaign_ingress_touches"
FOR EACH ROW EXECUTE FUNCTION "c03_campaign_ingress_guard"();

CREATE TRIGGER "c03_campaign_ingress_delete_guard"
BEFORE DELETE ON "campaign_ingress_touches"
FOR EACH ROW EXECUTE FUNCTION "c03_campaign_ingress_guard"();

DROP TRIGGER "c01_creator_entry_continuation_authority_guard"
  ON "creator_entry_continuations";

CREATE OR REPLACE FUNCTION "c01_creator_entry_continuation_immutable_authority"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."token_digest" IS DISTINCT FROM OLD."token_digest"
    OR NEW."intent" IS DISTINCT FROM OLD."intent"
    OR NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
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

CREATE OR REPLACE FUNCTION "c03_application_event_insert_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  application_row "uce_applications"%ROWTYPE;
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_application_event_insert_guard"
BEFORE INSERT ON "application_domain_events"
FOR EACH ROW EXECUTE FUNCTION "c03_application_event_insert_guard"();

CREATE OR REPLACE FUNCTION "c03_application_event_append_only_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'C03_APPLICATION_EVENT_APPEND_ONLY'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "c03_application_event_update_guard"
BEFORE UPDATE ON "application_domain_events"
FOR EACH ROW EXECUTE FUNCTION "c03_application_event_append_only_guard"();

CREATE TRIGGER "c03_application_event_delete_guard"
BEFORE DELETE ON "application_domain_events"
FOR EACH ROW EXECUTE FUNCTION "c03_application_event_append_only_guard"();

CREATE OR REPLACE FUNCTION "c03_application_receipt_insert_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  application_row "uce_applications"%ROWTYPE;
  event_row "application_domain_events"%ROWTYPE;
  expected_subject_id TEXT;
  expected_event_name "ApplicationDomainEventName";
BEGIN
  SELECT * INTO application_row
  FROM "uce_applications"
  WHERE "id" = NEW."application_id";

  SELECT * INTO event_row
  FROM "application_domain_events"
  WHERE "transition_id" = NEW."transition_id";

  IF application_row."authority_version" <> 'C03_CANONICAL'::"UceApplicationAuthorityVersion"
    OR event_row."application_id" IS DISTINCT FROM NEW."application_id"
  THEN
    RAISE EXCEPTION 'C03_RECEIPT_APPLICATION_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."command_type" IN (
    'SUBMIT'::"ApplicationCommandType",
    'WITHDRAW'::"ApplicationCommandType"
  ) THEN
    expected_subject_id := application_row."subject_creator_profile_id";
  ELSE
    expected_subject_id := application_row."brand_profile_id";
  END IF;

  expected_event_name := CASE NEW."command_type"
    WHEN 'SUBMIT'::"ApplicationCommandType" THEN 'application.submitted'::"ApplicationDomainEventName"
    WHEN 'WITHDRAW'::"ApplicationCommandType" THEN 'application.withdrawn'::"ApplicationDomainEventName"
    WHEN 'APPROVE'::"ApplicationCommandType" THEN 'application.approved'::"ApplicationDomainEventName"
    WHEN 'REJECT'::"ApplicationCommandType" THEN 'application.rejected'::"ApplicationDomainEventName"
  END;

  IF NEW."authority_subject_id" IS DISTINCT FROM expected_subject_id
    OR event_row."event_name" IS DISTINCT FROM expected_event_name
  THEN
    RAISE EXCEPTION 'C03_RECEIPT_AUTHORITY_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "c03_application_receipt_insert_guard"
BEFORE INSERT ON "application_command_receipts"
FOR EACH ROW EXECUTE FUNCTION "c03_application_receipt_insert_guard"();

CREATE OR REPLACE FUNCTION "c03_application_receipt_append_only_guard"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'C03_APPLICATION_RECEIPT_APPEND_ONLY'
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "c03_application_receipt_update_guard"
BEFORE UPDATE ON "application_command_receipts"
FOR EACH ROW EXECUTE FUNCTION "c03_application_receipt_append_only_guard"();

CREATE TRIGGER "c03_application_receipt_delete_guard"
BEFORE DELETE ON "application_command_receipts"
FOR EACH ROW EXECUTE FUNCTION "c03_application_receipt_append_only_guard"();

COMMIT;
