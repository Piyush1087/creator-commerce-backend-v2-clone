-- Creator marketplace: visibility/application scopes, mock social metrics, invite tokens



CREATE TYPE "UceVisibilityScope" AS ENUM ('EVERYONE', 'ELIGIBLE_ONLY', 'INVITED_ONLY');



CREATE TYPE "UceApplicationScope" AS ENUM (

  'EVERYONE',

  'ELIGIBLE_ONLY',

  'INVITED_ONLY',

  'DIRECT_BYPASS',

  'BLENDED_SMART_FUNNEL',

  'VETTED_STEALTH'

);



ALTER TABLE "uce_campaign_targeting"

  ADD COLUMN "visibility_scopes" "UceVisibilityScope"[] NOT NULL DEFAULT ARRAY['EVERYONE']::"UceVisibilityScope"[],

  ADD COLUMN "application_scope" "UceApplicationScope" NOT NULL DEFAULT 'EVERYONE';



ALTER TABLE "creator_profiles"

  ADD COLUMN "tiktok_handle" VARCHAR(100),

  ADD COLUMN "primary_region" VARCHAR(10) NOT NULL DEFAULT 'US',

  ADD COLUMN "follower_count" INTEGER NOT NULL DEFAULT 0,

  ADD COLUMN "audience_demographics_matrix" JSONB NOT NULL DEFAULT '{}';



ALTER TABLE "uce_campaign_collaborations"

  ADD COLUMN "invitation_token" VARCHAR(64),

  ADD COLUMN "invitation_source_channel" VARCHAR(50);



CREATE UNIQUE INDEX "uce_campaign_collaborations_invitation_token_key"

  ON "uce_campaign_collaborations" ("invitation_token")

  WHERE "invitation_token" IS NOT NULL;



CREATE INDEX "idx_creator_profiles_eligibility_lookup"

  ON "creator_profiles" ("primary_region", "follower_count");

