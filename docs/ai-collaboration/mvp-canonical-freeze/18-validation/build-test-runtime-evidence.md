# Build / test / runtime evidence (§18)

**Date:** 2026-09-08  
**Status:** RUN 4 COMPLETE (partial gates) — not freeze PASS

Do not declare `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` until remaining gates in `10-remaining-gates.md` are closed or Parent-accepted.

| Gate | Status | Classification | Evidence |
| --- | --- | --- | --- |
| fresh checkout/reproducibility | NOT_RUN | working copy | `01-branch-and-lockfile.md` |
| package install / lockfile integrity | LOCKFILE_PRESENT | `npm ci` not re-run | `01-branch-and-lockfile.md` |
| backend build | PASS | | `03-backend-build.md` |
| frontend typecheck | PASS | | `04-frontend-typecheck.md` |
| frontend build | PASS | chunk-size warning = preexisting debt | `05-frontend-build.md` |
| frontend lint | PASS | | `06-lint.md` |
| backend lint | FAIL | PREEXISTING_ACCEPTED_DEBT (712 prettier) | `06-lint.md` |
| unit/contract tests | PARTIAL | FE 70 + BE 51 freeze proofs PASS; full suite not run | `07-targeted-tests.md` |
| module acceptance suites | NOT_RE_RUN | PREEXISTING_ACCEPTED_DEBT | `10-remaining-gates.md` |
| cross-module invariant suite | DEFINED + PARTIAL execution | | `11-invariant-results.md` |
| fresh disposable database migration | PASS 87/87 | `thecreatorshop` not touched | `08-fresh-db-migrate.md` |
| Prisma/schema validation | PASS | | `02-prisma-validate.md` |
| backend boot + health | PASS on freeze DB | | `09-backend-boot-health.md` |
| frontend ↔ backend smoke | PARTIAL PASS | OTP + shell hide + Brand Home + Creator Campaigns/Settings | `12-frontend-backend-smoke.md` |
| auth/session regression | PARTIAL | BS-12 static+unit PASS | `07-targeted-tests.md` |
| RBAC / actor-subject / cross-tenant | PARTIAL | unit + browser Brand↛Creator | `11-invariant-results.md` |
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
