# Build / test / runtime evidence (§18)

**Date:** 2026-09-09  
**Status:** RUN 5 COMPLETE (partial gates) — not freeze PASS

Do not declare `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` until remaining gates in `10-remaining-gates.md` are closed or Parent-accepted.

| Gate | Status | Classification | Evidence |
| --- | --- | --- | --- |
| fresh checkout/reproducibility | PARTIAL | FE clone PASS; BE clone generate required | `14-npm-ci-fresh-clone.md` |
| package install / lockfile integrity | PASS `npm ci` on freeze clones | | `14-npm-ci-fresh-clone.md` |
| backend build | PASS | | `03-backend-build.md` |
| frontend typecheck | PASS | | `04-frontend-typecheck.md` |
| frontend build | PASS | chunk-size warning = preexisting debt | `05-frontend-build.md` |
| frontend lint | PASS | | `06-lint.md` |
| backend lint | FAIL | PREEXISTING_ACCEPTED_DEBT (712 prettier; Parent: do not `--fix`) | `06-lint.md` |
| unit/contract tests | FAIL classified | FE: 2 Parent-accepted + withdrawal types deleted; BE 18 failed / 6370 passed | `15-full-npm-test.md` |
| module acceptance suites | NOT_RE_RUN as named packs | farm classified in `15` | `10-remaining-gates.md` |
| cross-module invariant suite | PARTIAL + postgres | INV-01/04/12 postgres PASS | `11-invariant-results.md` `13-postgres-invariants.md` |
| fresh disposable database migration | PASS 87/87 | `thecreatorshop` not touched | `08-fresh-db-migrate.md` |
| Prisma/schema validation | PASS | | `02-prisma-validate.md` |
| backend boot + health | PASS on freeze DB | | `09-backend-boot-health.md` |
| frontend ↔ backend smoke | PARTIAL PASS | OTP + shell hide + Brand Home + Creator Campaigns/Settings | `12-frontend-backend-smoke.md` |
| auth/session regression | PASS postgres INV-01 | plus static/unit | `13-postgres-invariants.md` |
| RBAC / actor-subject / cross-tenant | PASS postgres INV-04 + INV-12 | | `13-postgres-invariants.md` |
| responsive shell/navigation smoke | desktop browser + unit | no viewport matrix | `12-frontend-backend-smoke.md` |
| provider-unavailable recovery | PARTIAL | Postmark fail observed locally | `12-frontend-backend-smoke.md` |
| compiled/deployable artifact | PASS | FE `dist/`, BE `dist/main.js` | `03` + `05` |
| clean worktrees | NOT_CLAIMED | do not commit `tmp-*` | |
| local/remote checkpoint equality | local only | | |

## Failure classification vocabulary

```text
CANONICAL_REGRESSION
PREEXISTING_ACCEPTED_DEBT
ENVIRONMENT_BLOCKED
PROVIDER_BLOCKED
STALE_TEST_PROVEN
RELEASE_BLOCKER
UNKNOWN_REQUIRES_REVIEW
```

No failures are greenwashed as pass.
