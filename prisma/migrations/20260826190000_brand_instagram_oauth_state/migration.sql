-- Dedicated, one-time Instagram Settings OAuth attempts. No raw state or tokens.
CREATE TABLE "brand_instagram_oauth_states" (
    "id" TEXT NOT NULL,
    "brand_profile_id" TEXT NOT NULL,
    "initiated_by_user_id" TEXT NOT NULL,
    "state_hash" VARCHAR(64) NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_instagram_oauth_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "brand_instagram_oauth_states_state_hash_key" ON "brand_instagram_oauth_states"("state_hash");
CREATE INDEX "brand_instagram_oauth_states_expires_at_consumed_at_idx" ON "brand_instagram_oauth_states"("expires_at", "consumed_at");
CREATE INDEX "brand_instagram_oauth_states_brand_profile_id_idx" ON "brand_instagram_oauth_states"("brand_profile_id");
CREATE INDEX "brand_instagram_oauth_states_initiated_by_user_id_idx" ON "brand_instagram_oauth_states"("initiated_by_user_id");
ALTER TABLE "brand_instagram_oauth_states" ADD CONSTRAINT "brand_instagram_oauth_states_brand_profile_id_fkey" FOREIGN KEY ("brand_profile_id") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "brand_instagram_oauth_states" ADD CONSTRAINT "brand_instagram_oauth_states_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep a reconnect's mismatched credentials separate from an active identity.
-- Existing encrypted credentials are not rewritten or copied.
ALTER TABLE "brand_integrations"
    ADD COLUMN "pending_access_token_encrypted" TEXT,
    ADD COLUMN "pending_granted_scopes" "BrandIntegrationScope"[] DEFAULT ARRAY[]::"BrandIntegrationScope"[],
    ADD COLUMN "pending_token_expires_at" TIMESTAMP(3);
