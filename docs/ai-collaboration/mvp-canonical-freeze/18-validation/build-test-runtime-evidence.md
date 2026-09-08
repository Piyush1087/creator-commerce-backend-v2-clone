# Build / test / runtime evidence (§18)

**Date:** 2026-09-08  
**Status:** NOT YET RUN for freeze PASS

Do not declare `PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` until this table is evidence-backed.

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout/reproducibility | NOT_RUN | |
| package install / lockfile integrity | NOT_RUN | |
| backend build | NOT_RUN | |
| frontend typecheck | NOT_RUN | |
| frontend build | NOT_RUN | |
| lint | NOT_RUN | |
| unit/contract tests | PARTIAL | RUN 1: FE shell tests 12/12 after Store import restore; guard-scope not fully re-run after vitest hang |
| module acceptance suites | NOT_RE_RUN on freeze tip | PREEXISTING_ACCEPTED_DEBT until reconfirmed |
| cross-module invariant suite | DEFINED not executed | see `../phase-d-invariants/` |
| fresh disposable database migration | NOT_PROVEN | ENVIRONMENT_BLOCKED |
| Prisma/schema validation | PASS `npx prisma validate` 2026-09-08 | see `../14-migration-schema/` |
| backend boot + health | NOT_RUN | |
| frontend ↔ backend smoke | NOT_RUN | |
| auth/session regression | NOT_RUN | |
| RBAC / actor-subject / cross-tenant | NOT_RUN | |
| responsive shell/navigation smoke | NOT_RUN in browser this run | RUN 1 hide is code-complete |
| provider-unavailable recovery | NOT_RUN | |
| compiled/deployable artifact | NOT_RUN | |
| clean worktrees | NOT_CLAIMED | BE has unrelated untracked `tmp-*` / logs — do not commit |
| local/remote checkpoint equality | freeze branches local; not required to push unless Parent asks | |

## Failure classification vocabulary

```text
CANONICAL_REGRESSION
PREEXISTING_ACCEPTED_DEBT
ENVIRONMENT_BLOCKED
PROVIDER_BLOCKED
STALE_TEST_PROVEN
RELEASE_BLOCKER
```

No failures are greenwashed as pass.
