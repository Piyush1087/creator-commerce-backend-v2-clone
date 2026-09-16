CREATE TYPE "CreatorMediaKitLifecycle" AS ENUM ('DRAFT', 'LIVE');
CREATE TYPE "CreatorMediaKitEventType" AS ENUM (
  'KIT_VIEW',
  'PUBLIC_THUMBNAIL_SOURCE_OPENED',
  'WORK_WITH_CREATOR_CLICK',
  'REVEAL_EMAIL_ID_CLICK',
  'MEDIA_KIT_PDF_DOWNLOAD'
);

CREATE TABLE "creator_media_kits" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "owner_profile_id" TEXT NOT NULL,
  "public_id" VARCHAR(64) NOT NULL,
  "lifecycle" "CreatorMediaKitLifecycle" NOT NULL DEFAULT 'DRAFT',
  "current_revision" INTEGER NOT NULL DEFAULT 0,
  "show_audience" BOOLEAN NOT NULL DEFAULT true,
  "show_content" BOOLEAN NOT NULL DEFAULT true,
  "show_portfolio" BOOLEAN NOT NULL DEFAULT true,
  "show_rate_card" BOOLEAN NOT NULL DEFAULT true,
  "public_visuals" JSONB NOT NULL DEFAULT '[]',
  "featured_portfolio_item_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "published_at" TIMESTAMP(3),
  "published_by_user_id" TEXT,
  "unpublished_at" TIMESTAMP(3),
  "unpublished_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "creator_media_kits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "creator_media_kits_workspace_id_owner_profile_id_fkey"
    FOREIGN KEY ("workspace_id", "owner_profile_id")
    REFERENCES "creator_workspaces"("id", "owner_profile_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "creator_media_kits_owner_profile_id_fkey"
    FOREIGN KEY ("owner_profile_id")
    REFERENCES "creator_profiles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "creator_media_kits_workspace_id_key"
  ON "creator_media_kits"("workspace_id");
CREATE UNIQUE INDEX "creator_media_kits_owner_profile_id_key"
  ON "creator_media_kits"("owner_profile_id");
CREATE UNIQUE INDEX "creator_media_kits_public_id_key"
  ON "creator_media_kits"("public_id");
CREATE UNIQUE INDEX "creator_media_kits_workspace_id_owner_profile_id_key"
  ON "creator_media_kits"("workspace_id", "owner_profile_id");
CREATE INDEX "creator_media_kits_lifecycle_public_id_idx"
  ON "creator_media_kits"("lifecycle", "public_id");

CREATE TABLE "creator_media_kit_revisions" (
  "id" TEXT NOT NULL,
  "media_kit_id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "previous_revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "actor_membership_id" TEXT NOT NULL,
  "actor_role" "CreatorTeamRole" NOT NULL,
  "intent" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "command_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creator_media_kit_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "creator_media_kit_revisions_media_kit_id_fkey"
    FOREIGN KEY ("media_kit_id") REFERENCES "creator_media_kits"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "creator_media_kit_revisions_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "creator_media_kit_revisions_actor_membership_id_fkey"
    FOREIGN KEY ("actor_membership_id") REFERENCES "creator_workspace_members"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "creator_media_kit_revision_monotonic_check"
    CHECK ("revision" = "previous_revision" + 1)
);

CREATE UNIQUE INDEX "creator_media_kit_revisions_media_kit_id_revision_key"
  ON "creator_media_kit_revisions"("media_kit_id", "revision");
CREATE UNIQUE INDEX "creator_media_kit_revisions_media_kit_id_idempotency_key_key"
  ON "creator_media_kit_revisions"("media_kit_id", "idempotency_key");

CREATE TABLE "creator_media_kit_events" (
  "id" TEXT NOT NULL,
  "media_kit_id" TEXT NOT NULL,
  "event_type" "CreatorMediaKitEventType" NOT NULL,
  "kit_revision" INTEGER NOT NULL,
  "recognized_brand_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "creator_media_kit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "creator_media_kit_events_media_kit_id_fkey"
    FOREIGN KEY ("media_kit_id") REFERENCES "creator_media_kits"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "creator_media_kit_events_media_kit_id_event_type_created_at_idx"
  ON "creator_media_kit_events"("media_kit_id", "event_type", "created_at");
