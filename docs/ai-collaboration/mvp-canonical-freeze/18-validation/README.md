# §18 — Whole-application validation gate

**Status:** RUN 3 IN PROGRESS — not freeze PASS  
**Date:** 2026-09-08

## Files in this folder (one file per gate)

| File | Gate |
| --- | --- |
| `build-test-runtime-evidence.md` | Summary table |
| `01-branch-and-lockfile.md` | freeze branch + lockfile presence |
| `02-prisma-validate.md` | `npx prisma validate` |
| `03-backend-build.md` | backend `npm run build` |
| `04-frontend-typecheck.md` | frontend `npm run typecheck` |
| `05-frontend-build.md` | frontend `npm run build` |
| `06-lint.md` | lint (not run this checkpoint) |
| `07-targeted-tests.md` | freeze-relevant unit/contract tests |
| `08-fresh-db-migrate.md` | disposable DB `0 → head` |
| `09-backend-boot-health.md` | boot + `/health` |
| `10-remaining-gates.md` | still-open §18 gates |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is forbidden until remaining gates are closed or Parent-accepted.
