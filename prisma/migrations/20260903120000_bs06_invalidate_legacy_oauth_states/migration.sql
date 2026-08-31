-- OAuth attempts issued before BS-06 did not carry authoritative intent, role,
-- generation, or expected-account facts. Burn only outstanding attempts while
-- retaining previously consumed rows for audit history.
UPDATE "brand_instagram_oauth_states"
SET "consumed_at" = CURRENT_TIMESTAMP
WHERE "consumed_at" IS NULL;
