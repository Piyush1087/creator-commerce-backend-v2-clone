# 13 — Named postgres invariant suites (RUN 5)

**Date:** 2026-09-09  
**Engine:** `creatorshop-postgres-v2` (already up). `thecreatorshop` not migrated.

Empty DBs created and `npx prisma migrate deploy` applied: `bs12_freeze_auth`, `bs07_freeze_auth`, `c05_freeze_team`, `c01_i2_freeze`, `c03_p14_handoff`.

OTP codes appeared in test logs and are **not** recorded here.

| INV | DB | Flag | Result | Notes |
| --- | --- | --- | --- | --- |
| INV-01 | `bs12_freeze_auth` | `BS12_DATABASE_TEST=true` | **PASS** 10/10 | `auth-security.postgres.test.ts`. Postmark send failed; OTP still issued off-prod |
| INV-12 | `bs07_freeze_auth` | `BRAND_WORKSPACE_DATABASE_TEST=true` | **PASS** 11/11 | `brand-workspace-authorization.postgres.test.ts`. Hostname `127.0.0.1` accepted |
| INV-04 | `c05_freeze_team` | `C05_TEAM_DATABASE_TEST=true` | **PASS** 5/5 | `creator-team.postgres.test.ts` |
| INV-03 | `c01_i2_freeze` | `C01_I2_DATABASE_URL` | **FAIL** 2 failed / 27 passed (29) Parent re-run 2026-09-09 | Same `issueTokenForUserId is not a function`. Test constructs `BrandVerificationService(db, scan, auth, googleAuth, emailOtp)` but production ctor is `(prisma, mail, brandCentreScan, auth, googleAuth)` — `this.auth` is the Google service. Race case then fails. **Classification:** `STALE_TEST_PROVEN` harness drift, not freeze-hide |
| INV-06/07 | `c03_p14_handoff` | `C03_P14_DATABASE_TEST=true` | **PASS** 34/34 (2026-09-09 isolated retry) | Must use hostname `localhost`. Default Vitest 5s timed out OWNER/MANAGER/ASSISTANT query tests. Dirty DB + overlapping runs caused leftover `user`/`creatorProfile`/`creatorWorkspace` count asserts. Recreated DB, `prisma migrate deploy` 87/87, `--testTimeout=30000 --fileParallelism=false --maxWorkers=1`: handoff 30/30 + legacy 4/4. `thecreatorshop` not touched. |

INV-03 postgres remains FAIL classified (`STALE_TEST_PROVEN` harness). INV-06/07 postgres is PASS on this retry.
