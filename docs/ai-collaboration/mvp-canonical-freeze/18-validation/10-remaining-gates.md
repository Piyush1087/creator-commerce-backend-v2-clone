# 10 — Remaining §18 gates

**Date:** 2026-09-09  
**Run:** RUN 5

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout / `npm ci` | PARTIAL | FE clone typecheck/lint/build PASS. BE clone validate PASS; build needs `prisma generate`; nest build hung under load (`14-npm-ci-fresh-clone.md`) |
| full unit/contract `npm test` | FAIL classified | FE Parent-accepted/amended. BE: CORS/brief-pack/Gatekeeper isolated PASS; C-04 empty suites + payout greps still open (`15-full-npm-test.md`) |
| module acceptance suites | NOT_RE_RUN as named packs | farm results above |
| cross-module invariant suite execution | PARTIAL | postgres INV-01/04/12 PASS; INV-03/06/07 partial; INV-09 Settings half PASS, consumption not in tree (`11-invariant-results.md`) |
| frontend ↔ backend smoke | PARTIAL PASS | RUN 4 `12-frontend-backend-smoke.md` |
| auth/session regression | PASS postgres INV-01 | plus RUN 4 static/unit |
| RBAC / actor-subject / cross-tenant | PASS postgres INV-04 + INV-12 | |
| responsive shell/navigation smoke | NOT_RUN in viewport matrix | |
| provider-unavailable recovery | PARTIAL | Postmark only |
| frontend lint | PASS | RUN 4 + clone |
| backend lint | FAIL | 712 prettier — **Parent-accepted** `PREEXISTING_ACCEPTED_DEBT` (do not `--fix`) |
| clean worktrees | NOT_CLAIMED | do not commit `tmp-*` / OTP logs |
| local/remote checkpoint equality | local only | commit this freeze-doc checkpoint; do not push unless Parent asks |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden.
