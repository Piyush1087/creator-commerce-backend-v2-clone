# 13 — Named postgres invariant suites (RUN 5)

**Date:** 2026-09-09  
**Engine:** `creatorshop-postgres-v2` (already up). `thecreatorshop` not migrated.
**Runs:** RUN 5 named DBs; RUN 7 INV-03 leftover 29/29.

Empty DBs created and `npx prisma migrate deploy` applied: `bs12_freeze_auth`, `bs07_freeze_auth`, `c05_freeze_team`, `c01_i2_freeze`, `c03_p14_handoff`.

OTP codes appeared in test logs and are **not** recorded here.

| INV | DB | Flag | Result | Notes |
| --- | --- | --- | --- | --- |
| INV-01 | `bs12_freeze_auth` | `BS12_DATABASE_TEST=true` | **PASS** 10/10 | `auth-security.postgres.test.ts`. RUN 5: Postmark send failed; OTP still issued off-prod. RUN 11: live OTP template send PASS (invalid TemplateId `1` was the RUN 5 cause) |
| INV-12 | `bs07_freeze_auth` | `BRAND_WORKSPACE_DATABASE_TEST=true` | **PASS** 11/11 | `brand-workspace-authorization.postgres.test.ts`. Hostname `127.0.0.1` accepted |
| INV-04 | `c05_freeze_team` | `C05_TEAM_DATABASE_TEST=true` | **PASS** 5/5 | `creator-team.postgres.test.ts` |
| INV-03 | `c01_i2_freeze` | `C01_I2_DATABASE_URL` | **PASS** 29/29 Parent-run 2026-09-09 | Harness ctor aligned to production `(prisma, mail, scan, auth, googleAuth)`. `--testTimeout=30000 --fileParallelism=false --maxWorkers=1`. `thecreatorshop` not touched. |
| INV-06/07 | `c03_p14_handoff` | `C03_P14_DATABASE_TEST=true` | **PASS** 34/34 (2026-09-09 isolated retry) | Must use hostname `localhost`. Default Vitest 5s timed out OWNER/MANAGER/ASSISTANT query tests. Dirty DB + overlapping runs caused leftover `user`/`creatorProfile`/`creatorWorkspace` count asserts. Recreated DB, `prisma migrate deploy` 87/87, `--testTimeout=30000 --fileParallelism=false --maxWorkers=1`: handoff 30/30 + legacy 4/4. `thecreatorshop` not touched. |

INV-03 postgres is PASS 29/29 (harness ctor leftover closed). INV-06/07 postgres remains PASS.
