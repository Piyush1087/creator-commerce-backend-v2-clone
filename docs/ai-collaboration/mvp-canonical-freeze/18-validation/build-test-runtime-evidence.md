# Build / test / runtime evidence (§18)

**Date:** 2026-09-09  
**Status:** RUN 5 COMPLETE (partial gates) — not freeze PASS

Do not declare `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` until remaining gates in `10-remaining-gates.md` are closed or Parent-accepted.

| Gate | Status | Classification | Evidence |
| --- | --- | --- | --- |
| fresh checkout/reproducibility | PARTIAL | FE clone PASS; BE clone generate required | `14-npm-ci-fresh-clone.md` |
| package install / lockfile integrity | PASS `npm ci` on freeze clones | | `14-npm-ci-fresh-clone.md` |
| backend build | PASS | working-tree generate+build Parent reconfirm 2026-09-09; clone nest hung under load | `03-backend-build.md` `14-npm-ci-fresh-clone.md` |
| frontend typecheck | PASS | | `04-frontend-typecheck.md` |
| frontend build | PASS | chunk-size warning = preexisting debt | `05-frontend-build.md` |
| frontend lint | PASS | | `06-lint.md` |
| backend lint | PASS classified | prettier 712 accepted this freeze (do not `--fix`). Later eslint-without-prettier: same prettier-only farm stays accepted | `06-lint.md` |
| unit/contract tests | FAIL classified | FE named RUN 5 files closed (auth static isolated PASS RUN 12); full FE farm not re-run. BE 18 failed / 6370 passed | `15-full-npm-test.md` |
| module acceptance suites | PARTIAL this amendment | C-04/C-02A/Payouts unit PASS; Wave B postgres PASS 3/3 on `waveb_runtime` | `10-remaining-gates.md` `07-targeted-tests.md` |
| cross-module invariant suite | PARTIAL + postgres | INV-01/02/03/04/12/06/07 postgres PASS; INV-11 PASS classified; INV-08/09/10 PARTIAL; INV-13 PASS classified | `11-invariant-results.md` `13-postgres-invariants.md` |
| fresh disposable database migration | PASS 87/87 | `thecreatorshop` not touched | `08-fresh-db-migrate.md` |
| Prisma/schema validation | PASS | | `02-prisma-validate.md` |
| backend boot + health | PASS on freeze DB | | `09-backend-boot-health.md` |
| frontend ↔ backend smoke | PASS | Parent confirm 2026-09-11 (C-02A Home, not deferred) | `12-frontend-backend-smoke.md` |
| auth/session regression | PASS postgres INV-01 | plus static/unit | `13-postgres-invariants.md` |
| RBAC / actor-subject / cross-tenant | PASS postgres INV-04 + INV-12 | | `13-postgres-invariants.md` |
| responsive shell/navigation smoke | PASS | RUN 8 Parent confirm: UCE cards + Creator viewport | `16-viewport-smoke.md` |
| provider-unavailable recovery | PASS classified | Fail-closed Brand Payouts + C-05 P2; Postmark live send; IG/Razorpay later | `10-remaining-gates.md` |
| compiled/deployable artifact | PASS | FE `dist/`, BE `dist/main.js` | `03` + `05` |
| clean worktrees | NOT_CLAIMED | do not commit `tmp-*` | |
| local/remote checkpoint equality | Parent asked origin+piyush push of RUN 12 | freeze branch; not development/main |

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
