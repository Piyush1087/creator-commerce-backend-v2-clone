-- Creator deferred features: Google auth, public media-kit slug

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_subject_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_google_subject_id_key"
  ON "users"("google_subject_id")
  WHERE "google_subject_id" IS NOT NULL;

ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "public_slug" TEXT;
ALTER TABLE "creator_profiles" ADD COLUMN IF NOT EXISTS "is_media_kit_public" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS "creator_profiles_public_slug_key"
  ON "creator_profiles"("public_slug")
  WHERE "public_slug" IS NOT NULL;
