-- C01-I1 historical conflict register. Execute only against an explicitly authorized
-- historical database. Each statement is read-only and returns reconciliation evidence.

SELECT 'C01-DATA-01_NORMALIZED_EMAIL_COLLISION' AS issue_code,
       lower(normalize(btrim("email"), NFC)) AS evidence_key,
       count(*) AS evidence_count
FROM "users"
GROUP BY lower(normalize(btrim("email"), NFC))
HAVING count(*) > 1;

SELECT 'C01-DATA-02_BRAND_CROSS_ORGANIZATION_MEMBERSHIP' AS issue_code,
       btm."membership_id" AS evidence_key,
       1 AS evidence_count
FROM "brand_team_members" btm
JOIN "brand_profiles" bp ON bp."id" = btm."brand_id"
JOIN "users" u ON u."id" = btm."user_id"
WHERE btm."is_active" = true
  AND (
    u."organization_id" IS NULL
    OR bp."organization_id" IS NULL
    OR u."organization_id" IS DISTINCT FROM bp."organization_id"
  );

SELECT 'C01-DATA-03_BRAND_CREATOR_DUAL_CONTEXT' AS issue_code,
       u."id" AS evidence_key,
       1 AS evidence_count
FROM "users" u
JOIN "creator_profiles" cp ON cp."user_id" = u."id"
WHERE u."role" = 'BRAND'
   OR EXISTS (
     SELECT 1 FROM "brand_team_members" btm
     WHERE btm."user_id" = u."id" AND btm."is_active" = true
   )
   OR EXISTS (
     SELECT 1 FROM "brand_profiles" bp
     WHERE bp."organization_id" = u."organization_id"
   );

SELECT 'C01-DATA-04_CREATOR_WITHOUT_ORGANIZATION_CONTEXT' AS issue_code,
       u."id" AS evidence_key,
       count(*) AS evidence_count
FROM "users" u
JOIN "creator_profiles" cp ON cp."user_id" = u."id"
WHERE u."role" = 'CREATOR'
  AND u."auth_state" = 'ACTIVE'
  AND u."organization_id" IS NULL
GROUP BY u."id";

SELECT 'C01-DATA-04_PROVISIONAL_CREATOR_COMPATIBILITY_CONTEXT' AS issue_code,
       u."id" AS evidence_key,
       1 AS evidence_count
FROM "users" u
JOIN "creator_profiles" cp ON cp."user_id" = u."id"
WHERE u."role" = 'CREATOR'
  AND u."auth_state" = 'PROVISIONAL'
  AND u."organization_id" IS NULL;

SELECT 'C01-DATA-05_MULTIPLE_CREATOR_OWNER_WORKSPACES' AS issue_code,
       "owner_profile_id" AS evidence_key,
       count(*) AS evidence_count
FROM "creator_workspaces"
GROUP BY "owner_profile_id"
HAVING count(*) > 1;

SELECT 'C01-DATA-06_CREATOR_MEMBER_EMAIL_ORGANIZATION_COLLISION' AS issue_code,
       cwm."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_workspace_members" cwm
JOIN "creator_workspaces" cw ON cw."id" = cwm."workspace_id"
JOIN "creator_profiles" owner_cp ON owner_cp."id" = cw."owner_profile_id"
JOIN "users" owner_u ON owner_u."id" = owner_cp."user_id"
JOIN "users" matched_u
  ON matched_u."normalized_email" = lower(normalize(btrim(cwm."associated_email"), NFC))
WHERE cwm."is_active_active" = true
  AND (
    owner_u."organization_id" IS NULL
    OR matched_u."organization_id" IS DISTINCT FROM owner_u."organization_id"
  );

SELECT 'C01-DATA-07_CREATOR_MEMBER_WITHOUT_CANONICAL_USER' AS issue_code,
       cwm."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_workspace_members" cwm
WHERE cwm."is_active_active" = true
  AND NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."normalized_email" = lower(normalize(btrim(cwm."associated_email"), NFC))
  );

SELECT 'C01-DATA-08_DUPLICATE_PROVIDER_IDENTITY' AS issue_code,
       "platform_network"::text || ':' || "native_platform_user_id" AS evidence_key,
       count(*) AS evidence_count
FROM "creator_social_integrations"
GROUP BY "platform_network", "native_platform_user_id"
HAVING count(*) > 1;

SELECT 'C01-DATA-09_LEGACY_ONBOARDING_CONTRADICTION' AS issue_code,
       cot."id" || ':' || contradiction.reason AS evidence_key,
       1 AS evidence_count
FROM "creator_onboarding_tracks" cot
LEFT JOIN "users" u ON u."id" = cot."user_id"
LEFT JOIN "creator_profiles" cp ON cp."user_id" = cot."user_id"
LEFT JOIN "creator_social_integrations" csi
  ON csi."creator_profile_id" = cp."id"
 AND csi."platform_network" = 'INSTAGRAM'
CROSS JOIN LATERAL (
  SELECT reason
  FROM (VALUES
    (
      'PROVIDER_SUCCESS_WITHOUT_INTEGRATION',
      cot."status" IN ('META_OAUTH_SUCCESS', 'AI_ENGINE_SYNCED') AND csi."id" IS NULL
    ),
    (
      'LEGACY_PROVIDER_IDENTITY_MISMATCH',
      cot."instagram_meta_id" IS NOT NULL
        AND csi."id" IS NOT NULL
        AND cot."instagram_meta_id" IS DISTINCT FROM csi."native_platform_user_id"
    ),
    (
      'TRACK_ATTACHED_TO_NON_CREATOR_USER',
      cot."user_id" IS NOT NULL AND (u."id" IS NULL OR u."role" <> 'CREATOR')
    ),
    (
      'PROVIDER_SUCCESS_WITH_NON_ACTIVE_OR_EXPIRED_EVIDENCE',
      cot."status" IN ('META_OAUTH_SUCCESS', 'AI_ENGINE_SYNCED')
        AND csi."id" IS NOT NULL
        AND (
          csi."token_state_condition" <> 'ACTIVE'
          OR (csi."token_expires_at" IS NOT NULL AND csi."token_expires_at" <= CURRENT_TIMESTAMP)
        )
    ),
    (
      'PERSONAL_INSTAGRAM_RECORDED_AS_PROVIDER_SUCCESS',
      cot."status" IN ('META_OAUTH_SUCCESS', 'AI_ENGINE_SYNCED')
        AND csi."professional_account_type" = 'PERSONAL'
    ),
    (
      'LEGACY_ADMISSION_STATE_VISIBLE',
      cot."status" = 'WAITLISTED' OR cot."is_approved" = true
    )
  ) AS checks(reason, violated)
  WHERE violated
) contradiction;

SELECT 'C01-DATA-10_LEGACY_OTP_STATE' AS issue_code,
       'ALL_REMAINING_CREATOR_OTP_ROWS' AS evidence_key,
       count(*) AS evidence_count
FROM "email_otp_verifications"
HAVING count(*) > 0;

SELECT 'C01-DATA-10_LEGACY_OTP_CANONICAL_CHALLENGE_OVERLAP' AS issue_code,
       lower(normalize(btrim(legacy."email"), NFC)) AS evidence_key,
       count(*) AS evidence_count
FROM "email_otp_verifications" legacy
JOIN "email_otp_challenges" canonical
  ON canonical."normalized_email" = lower(normalize(btrim(legacy."email"), NFC))
GROUP BY lower(normalize(btrim(legacy."email"), NFC));

SELECT 'C01-DATA-11_ORPHAN_INCONSISTENT_PROVIDER_RECORD' AS issue_code,
       csi."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_social_integrations" csi
LEFT JOIN "creator_profiles" cp ON cp."id" = csi."creator_profile_id"
LEFT JOIN "users" u ON u."id" = cp."user_id"
WHERE cp."id" IS NULL
   OR u."id" IS NULL
   OR u."role" <> 'CREATOR'
   OR btrim(csi."native_platform_user_id") = ''
   OR btrim(csi."oauth_access_token_encrypted") = ''
   OR (
     csi."platform_network" = 'INSTAGRAM'
     AND csi."professional_account_type" = 'PERSONAL'
   )
   OR (
     csi."token_state_condition" = 'ACTIVE'
     AND csi."token_expires_at" IS NOT NULL
     AND csi."token_expires_at" <= CURRENT_TIMESTAMP
   );

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
WHERE lower(normalize(btrim(cwm."associated_email"), NFC)) <> u."normalized_email";

SELECT 'C01-SUPPLEMENT_ACTIVE_MEMBER_WITHOUT_ASSIGNED_PROFILE' AS issue_code,
       cwm."id" AS evidence_key,
       1 AS evidence_count
FROM "creator_workspace_members" cwm
WHERE cwm."is_active_active" = true
  AND cwm."assigned_profile_id" IS NULL;

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
       u."id" || ':' || contradiction.reason AS evidence_key,
       1 AS evidence_count
FROM "users" u
CROSS JOIN LATERAL (
  SELECT reason
  FROM (VALUES
    (
      'ACTIVE_WITHOUT_ENABLED_AUTH_METHOD',
      u."auth_state" = 'ACTIVE' AND NOT EXISTS (
        SELECT 1 FROM "user_auth_methods" uam
        WHERE uam."user_id" = u."id" AND uam."disabled_at" IS NULL
      )
    ),
    (
      'PROVISIONAL_WITH_LIVE_SESSION',
      u."auth_state" = 'PROVISIONAL' AND EXISTS (
        SELECT 1 FROM "auth_sessions" session
        WHERE session."user_id" = u."id"
          AND session."revoked_at" IS NULL
          AND session."absolute_expires_at" > CURRENT_TIMESTAMP
      )
    ),
    (
      'ACTIVE_WITHOUT_EMAIL_VERIFICATION_TIMESTAMP',
      u."auth_state" = 'ACTIVE' AND u."email_verified_at" IS NULL
    ),
    (
      'PROVISIONAL_CREATOR_WITH_ORGANIZATION',
      u."auth_state" = 'PROVISIONAL'
        AND u."role" = 'CREATOR'
        AND u."organization_id" IS NOT NULL
    )
  ) AS checks(reason, violated)
  WHERE violated
) contradiction;

SELECT 'C01-SUPPLEMENT_BRAND_VERIFICATION_CODE_INVENTORY' AS issue_code,
       'UNUSED_BRAND_VERIFICATION_CODES' AS evidence_key,
       count(*) AS evidence_count
FROM "verification_codes"
WHERE "is_used" = false
HAVING count(*) > 0;

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
