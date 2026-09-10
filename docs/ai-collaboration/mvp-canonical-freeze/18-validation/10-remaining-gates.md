# 10 — Remaining §18 gates

**Date:** 2026-09-10  
**Run:** RUN 5 + RUN 7 INV-03 harness + RUN 8 viewport + RUN 9 local hygiene + RUN 11 Postmark live send + RUN 12 authAuthorizationHeader cutover

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout / `npm ci` | PARTIAL | FE clone typecheck/lint/build PASS. BE clone validate PASS; clone nest hung under farm load. **Working-tree** `npx prisma generate` + `npm run build` Parent reconfirm PASS 2026-09-09 (`14-npm-ci-fresh-clone.md`) |
| full unit/contract `npm test` | FAIL classified | FE three named RUN 5 farm files closed (auth static isolated PASS RUN 12; chat RUN 9; billing types amended). Full FE farm not re-run. BE: CORS/brief-pack/Gatekeeper isolated PASS; C-04 empty suites + payout greps still open (`15-full-npm-test.md`) |
| module acceptance suites | NOT_RE_RUN as named packs | farm results above |
| cross-module invariant suite execution | PARTIAL | postgres INV-01/02/03/04/12/06/07 PASS (INV-03 **29/29** RUN 7); INV-08/09/10/11 PARTIAL; INV-13 FAIL classified (`11-invariant-results.md`) |
| frontend ↔ backend smoke | PARTIAL PASS | RUN 4 `12-frontend-backend-smoke.md` |
| auth/session regression | PASS postgres INV-01 | plus RUN 4 static/unit |
| RBAC / actor-subject / cross-tenant | PASS postgres INV-04 + INV-12 | |
| responsive shell/navigation smoke | PASS | RUN 8 Parent confirm: UCE table→cards + Creator viewport (`16-viewport-smoke.md`) |
| provider-unavailable recovery | PARTIAL | Postmark OTP live send **PASS** 2026-09-10; IG/Razorpay **NOT_RUN**. RUN 4 fail was invalid TemplateId (`12-frontend-backend-smoke.md`) |
| frontend lint | PASS | RUN 4 + clone |
| backend lint | FAIL | 712 prettier — **Parent-accepted** `PREEXISTING_ACCEPTED_DEBT` (do not `--fix`) |
| clean worktrees | NOT_CLAIMED | do not commit `tmp-*` / OTP logs |
| local/remote checkpoint equality | Parent asked origin+piyush push of RUN 12 authAuthorizationHeader cutover | freeze branch only; not `development`/`main` |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden.
