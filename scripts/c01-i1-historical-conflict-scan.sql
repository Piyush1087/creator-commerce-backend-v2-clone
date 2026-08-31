-- C01-I1 historical conflict register. Execute only against an explicitly authorized
-- historical database. Each statement is read-only and returns reconciliation evidence.

SELECT 'C01-DATA-01_NORMALIZED_EMAIL_COLLISION' AS issue_code,
       lower(normalize(btrim("email"), NFC)) AS evidence_key,
       count(*) AS evidence_count
FROM "users"
GROUP BY lower(normalize(btrim("email"), NFC))
HAVING count(*) > 1;

SELECT 'C01-DATA-02_BRAND_CROSS_ORGANIZATION_MEMBERSHIP' AS issue_code,
       btm."user_id" AS evidence_key,
       count(DISTINCT bp."organization_id") AS evidence_count
FROM "brand_team_members" btm
JOIN "brand_profiles" bp ON bp."id" = btm."brand_id"
WHERE btm."is_active" = true
GROUP BY btm."user_id"
HAVING count(DISTINCT bp."organization_id") > 1;

SELECT 'C01-DATA-03_BRAND_CREATOR_DUAL_CONTEXT' AS issue_code,
       u."id" AS evidence_key,
       count(*) AS evidence_count
FROM "users" u
JOIN "creator_profiles" cp ON cp."user_id" = u."id"
JOIN "brand_team_members" btm ON btm."user_id" = u."id" AND btm."is_active" = true
GROUP BY u."id";

SELECT 'C01-DATA-04_CREATOR_WITHOUT_ORGANIZATION_CONTEXT' AS issue_code,
       u."id" AS evidence_key,
       count(*) AS evidence_count
FROM "users" u
JOIN "creator_profiles" cp ON cp."user_id" = u."id"
WHERE u."role" = 'CREATOR'
  AND u."auth_state" = 'ACTIVE'
  AND u."organization_id" IS NULL
GROUP BY u."id";

SELECT 'C01-DATA-05_MULTIPLE_CREATOR_OWNER_WORKSPACES' AS issue_code,
       "owner_profile_id" AS evidence_key,
       count(*) AS evidence_count
FROM "creator_workspaces"
GROUP BY "owner_profile_id"
HAVING count(*) > 1;

SELECT 'C01-DATA-06_CREATOR_MEMBER_EMAIL_ORGANIZATION_COLLISION' AS issue_code,
       lower(btrim(cwm."associated_email")) AS evidence_key,
       count(DISTINCT cw."owner_profile_id") AS evidence_count
FROM "creator_workspace_members" cwm
JOIN "creator_workspaces" cw ON cw."id" = cwm."workspace_id"
WHERE cwm."is_active_active" = true
GROUP BY lower(btrim(cwm."associated_email"))
HAVING count(DISTINCT cw."owner_profile_id") > 1;

SELECT 'C01-DATA-07_CREATOR_MEMBER_WITHOUT_CANONICAL_USER' AS issue_code,
       cwm."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_workspace_members" cwm
LEFT JOIN "creator_profiles" cp ON cp."id" = cwm."assigned_profile_id"
LEFT JOIN "users" u ON u."id" = cp."user_id"
WHERE cwm."is_active_active" = true
  AND (cwm."assigned_profile_id" IS NULL OR u."id" IS NULL);

SELECT 'C01-DATA-08_DUPLICATE_PROVIDER_IDENTITY' AS issue_code,
       "platform_network"::text || ':' || "native_platform_user_id" AS evidence_key,
       count(*) AS evidence_count
FROM "creator_social_integrations"
GROUP BY "platform_network", "native_platform_user_id"
HAVING count(*) > 1;

SELECT 'C01-DATA-09_LEGACY_ONBOARDING_CONTRADICTION' AS issue_code,
       u."id" AS evidence_key,
       count(*) AS evidence_count
FROM "users" u
LEFT JOIN "creator_profiles" cp ON cp."user_id" = u."id"
LEFT JOIN "creator_onboarding_tracks" cot ON cot."user_id" = u."id"
WHERE (u."auth_state" = 'PROVISIONAL' AND cp."id" IS NOT NULL)
   OR (u."auth_state" = 'ACTIVE' AND u."role" = 'CREATOR' AND cp."id" IS NULL)
   OR (cot."status" = 'OTP_VERIFIED' AND u."auth_state" <> 'ACTIVE')
GROUP BY u."id";

SELECT 'C01-DATA-10_LEGACY_OTP_STATE' AS issue_code,
       "id" AS evidence_key,
       1 AS evidence_count
FROM "verification_codes"
WHERE "is_used" = false;

SELECT 'C01-DATA-11_ORPHAN_INCONSISTENT_PROVIDER_RECORD' AS issue_code,
       csi."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_social_integrations" csi
LEFT JOIN "creator_profiles" cp ON cp."id" = csi."creator_profile_id"
WHERE cp."id" IS NULL
   OR btrim(csi."native_platform_user_id") = ''
   OR btrim(csi."channel_handle_string") = '';

SELECT 'C01-SUPPLEMENT_NORMALIZED_EMAIL_DRIFT' AS issue_code,
       "id" AS evidence_key,
       1 AS evidence_count
FROM "users"
WHERE "normalized_email" IS DISTINCT FROM lower(normalize(btrim("email"), NFC));

SELECT 'C01-SUPPLEMENT_ASSIGNED_PROFILE_EMAIL_MISMATCH' AS issue_code,
       cwm."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_workspace_members" cwm
JOIN "creator_profiles" cp ON cp."id" = cwm."assigned_profile_id"
JOIN "users" u ON u."id" = cp."user_id"
WHERE lower(btrim(cwm."associated_email")) <> u."normalized_email";

SELECT 'C01-SUPPLEMENT_OWNER_SEAT_INCONSISTENCY' AS issue_code,
       cw."id" AS evidence_key,
       count(cwm."id") AS evidence_count
FROM "creator_workspaces" cw
LEFT JOIN "creator_workspace_members" cwm
  ON cwm."workspace_id" = cw."id"
 AND cwm."security_role_token" = 'OWNER'
 AND cwm."is_active_active" = true
GROUP BY cw."id", cw."owner_profile_id"
HAVING count(cwm."id") <> 1
    OR bool_or(cwm."assigned_profile_id" IS DISTINCT FROM cw."owner_profile_id");

SELECT 'C01-SUPPLEMENT_AUTH_STATE_CONTRADICTION' AS issue_code,
       u."id" AS evidence_key,
       1 AS evidence_count
FROM "users" u
WHERE (u."auth_state" = 'ACTIVE' AND u."email_verified_at" IS NULL)
   OR (u."auth_state" = 'PROVISIONAL' AND u."role" = 'CREATOR' AND u."organization_id" IS NOT NULL);

SELECT 'C01-SUPPLEMENT_VERIFIED_BRAND_MISSING_ORGANIZATION_OWNER' AS issue_code,
       bp."id" AS evidence_key,
       count(btm."membership_id") AS evidence_count
FROM "brand_profiles" bp
LEFT JOIN "brand_team_members" btm
  ON btm."brand_id" = bp."id"
 AND btm."role" = 'BRAND_OWNER'
 AND btm."is_active" = true
WHERE bp."is_verified" = true
GROUP BY bp."id", bp."organization_id"
HAVING bp."organization_id" IS NULL OR count(btm."membership_id") <> 1;
