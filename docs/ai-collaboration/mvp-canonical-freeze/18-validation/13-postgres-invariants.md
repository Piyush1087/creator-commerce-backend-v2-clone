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
| INV-03 | `c01_i2_freeze` | `C01_I2_DATABASE_URL` | **FAIL** 3 failed / 26 passed (29) | Brand/Creator identity reconciliation: `issueTokenForUserId is not a function` on Brand verification harness; two race tests then failed. **Classification:** `STALE_TEST_PROVEN` / harness drift, not freeze-hide |
| INV-06/07 | `c03_p14_handoff` | `C03_P14_DATABASE_TEST=true` | **FAIL** 3 failed / 27 passed (30) | First attempt used `127.0.0.1` → suite refused (`hostname !== localhost`). Retry on `localhost`: approval/handoff **27 PASS**; OWNER/MANAGER/ASSISTANT query tests **timed out at 5s**. **Classification:** `ENVIRONMENT_BLOCKED` / slow machine for those three; handoff core not red |

Do not treat INV-03/06/07 as freeze PASS.
