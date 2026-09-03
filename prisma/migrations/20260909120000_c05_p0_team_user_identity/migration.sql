-- C-05 P0 adds direct authenticated User identity without assigning legacy rows.
-- Historical memberships remain unresolved and unauthorized until a later,
-- evidence-backed reconciliation can identify the User unambiguously.
ALTER TABLE "creator_workspace_members"
ADD COLUMN "user_id" TEXT;

CREATE INDEX "creator_workspace_members_user_id_is_active_idx"
ON "creator_workspace_members"("user_id", "is_active_active");

CREATE UNIQUE INDEX "creator_workspace_members_active_workspace_user_key"
ON "creator_workspace_members"("workspace_id", "user_id")
WHERE "user_id" IS NOT NULL AND "is_active_active" = true;

ALTER TABLE "creator_workspace_members"
ADD CONSTRAINT "creator_workspace_members_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
