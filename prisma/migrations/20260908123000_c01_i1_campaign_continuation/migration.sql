CREATE TYPE "CreatorEntryContinuationIntent" AS ENUM ('CAMPAIGN_APPLY');

CREATE TABLE "creator_entry_continuations" (
  "id" TEXT NOT NULL,
  "token_digest" CHAR(64) NOT NULL,
  "intent" "CreatorEntryContinuationIntent" NOT NULL DEFAULT 'CAMPAIGN_APPLY',
  "campaign_id" TEXT NOT NULL,
  "bound_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  CONSTRAINT "creator_entry_continuations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "creator_entry_continuations_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "creator_entry_continuations_token_digest_key"
  ON "creator_entry_continuations"("token_digest");
CREATE INDEX "creator_entry_continuations_campaign_id_idx"
  ON "creator_entry_continuations"("campaign_id");
CREATE INDEX "creator_entry_continuations_bound_user_id_idx"
  ON "creator_entry_continuations"("bound_user_id");
CREATE INDEX "creator_entry_continuations_expires_at_consumed_at_idx"
  ON "creator_entry_continuations"("expires_at", "consumed_at");

ALTER TABLE "creator_entry_continuations"
  ADD CONSTRAINT "creator_entry_continuations_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "uce_campaigns"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "creator_entry_continuations_bound_user_id_fkey"
  FOREIGN KEY ("bound_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "c01_creator_entry_continuation_immutable_authority"() RETURNS trigger AS $$
BEGIN
  IF NEW."token_digest" IS DISTINCT FROM OLD."token_digest"
    OR NEW."intent" IS DISTINCT FROM OLD."intent"
    OR NEW."campaign_id" IS DISTINCT FROM OLD."campaign_id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR (
      OLD."bound_user_id" IS NOT NULL
      AND NEW."bound_user_id" IS DISTINCT FROM OLD."bound_user_id"
    )
  THEN
    RAISE EXCEPTION 'C01_CREATOR_ENTRY_CONTINUATION_AUTHORITY_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "c01_creator_entry_continuation_authority_guard"
BEFORE UPDATE OF "token_digest", "intent", "campaign_id", "created_at", "bound_user_id"
ON "creator_entry_continuations"
FOR EACH ROW EXECUTE FUNCTION "c01_creator_entry_continuation_immutable_authority"();
