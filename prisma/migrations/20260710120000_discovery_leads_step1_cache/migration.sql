-- Step 1 landing page cache columns (change doc v2.1)
ALTER TABLE "discovery_leads"
ADD COLUMN IF NOT EXISTS "temporary_payload" JSONB,
ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "signup_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "classification_evidence" VARCHAR(250);

CREATE INDEX IF NOT EXISTS "idx_discovery_cache_lookup"
ON "discovery_leads" ("normalized_url", "signup_completed", "expires_at");
