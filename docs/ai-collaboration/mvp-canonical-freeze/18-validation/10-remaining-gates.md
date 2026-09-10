# 10 — Remaining §18 gates

**Date:** 2026-09-10  
**Run:** RUN 5 + RUN 7 INV-03 harness + RUN 8 viewport + RUN 9 local hygiene + RUN 11 Postmark live send + RUN 12 authAuthorizationHeader cutover

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout / `npm ci` | PARTIAL | FE clone typecheck/lint/build PASS. BE clone validate PASS; clone nest hung under farm load. **Working-tree** `npx prisma generate` + `npm run build` Parent reconfirm PASS 2026-09-09 (`14-npm-ci-fresh-clone.md`) |
| full unit/contract `npm test` | FAIL classified | Full farms not re-run this amendment. Targeted: competing-transition retired tests + Brand Payouts unit + C-02A Home architecture (see amendment run). Do not greenwash prettier 712 / env-blocked farms |
| module acceptance suites | PARTIAL this amendment | Targeted C-04/C-02A/Payouts unit only; postgres Wave B not run here (`BRAND_PAYOUTS_WAVE_B_DATABASE_TEST`) |
| cross-module invariant suite execution | PARTIAL | postgres INV-01/02/03/04/12/06/07 PASS (prior). INV-08/09/10/11 PARTIAL; INV-13 FAIL classified with writer proof (`11-invariant-results.md`) |
| frontend ↔ backend smoke | PARTIAL PASS | RUN 4 `12-frontend-backend-smoke.md` |
| auth/session regression | PASS postgres INV-01 | plus RUN 4 static/unit |
| RBAC / actor-subject / cross-tenant | PASS postgres INV-04 + INV-12 | |
| responsive shell/navigation smoke | PASS | RUN 8 Parent confirm: UCE table→cards + Creator viewport (`16-viewport-smoke.md`) |
| provider-unavailable recovery | PARTIAL | Postmark OTP live send **PASS** 2026-09-10; IG/Razorpay **NOT_RUN**. RUN 4 fail was invalid TemplateId (`12-frontend-backend-smoke.md`) |
| frontend lint | PASS | RUN 4 + clone |
| backend lint | FAIL | 712 prettier — **Parent-accepted** `PREEXISTING_ACCEPTED_DEBT` (do not `--fix`) |
| clean worktrees | NOT_CLAIMED | do not commit `tmp-*` / OTP logs |
| local/remote checkpoint equality | this amendment: origin push of ledger-record (not piyush) | freeze branch only; not `development`/`main` |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden.

**Amendment 2026-09-10 targeted gates (not full farms):**

```text
BE prisma validate                              PASS
BE out-of-mvp-competing-transition-retired      PASS 3/3
BE Brand Payouts unit (P0/P1/P3a/controller/wave-b/reserve/v2) PASS
BE C-05 P1D architecture                        PASS 5/5
BE C-04 fulfillment/production/publishing       STALE_TEST_PROVEN (node:test; vitest 0 suites)
FE C-02A Home architecture/schemas/nav          PASS
FE Brand Payouts P2 + Wave C                    PASS 40 tests across 5 files
full npm test farms                             NOT_RE_RUN (do not greenwash)
Brand Payouts Wave B postgres                   NOT_RUN (needs BRAND_PAYOUTS_WAVE_B_DATABASE_TEST + Parent freeze DB)
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS             NOT DECLARED
immutable SHA pair                              EVIDENCE BE aaa0b83 / FE 12fa514 (ledger-record may sit on top)
```
