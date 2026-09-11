# 10 — Remaining §18 gates

**Date:** 2026-09-10  
**Run:** RUN 5 + RUN 7 INV-03 harness + RUN 8 viewport + RUN 9 local hygiene + RUN 11 Postmark live send + RUN 12 authAuthorizationHeader cutover

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout / `npm ci` | PARTIAL | FE clone typecheck/lint/build PASS. BE clone validate PASS; clone nest hung under farm load. **Working-tree** `npx prisma generate` + `npm run build` Parent reconfirm PASS 2026-09-09 (`14-npm-ci-fresh-clone.md`) |
| full unit/contract `npm test` | FAIL classified | Full farms not re-run this amendment. Targeted: competing-transition retired tests + Brand Payouts unit + C-02A Home architecture (see amendment run). Do not greenwash prettier 712 / env-blocked farms |
| module acceptance suites | PARTIAL this amendment | Targeted C-04/C-02A/Payouts unit PASS. Wave B postgres **PASS 3/3** on disposable `waveb_runtime` after `npx prisma generate` (not `thecreatorshop`, not freeze DB) |
| cross-module invariant suite execution | PARTIAL | postgres INV-01/02/03/04/12/06/07 PASS (prior). INV-11 **PASS classified**. INV-08 PARTIAL (C-06). INV-09 PARTIAL (consumption). INV-10 PARTIAL (live IG/Razorpay). INV-13 PASS classified |
| frontend ↔ backend smoke | PASS | Parent confirm 2026-09-11 `12-frontend-backend-smoke.md` (C-02A Home, not deferred) |
| auth/session regression | PASS postgres INV-01 | plus RUN 4 static/unit |
| RBAC / actor-subject / cross-tenant | PASS postgres INV-04 + INV-12 | |
| responsive shell/navigation smoke | PASS | RUN 8 Parent confirm: UCE table→cards + Creator viewport (`16-viewport-smoke.md`) |
| provider-unavailable recovery | PASS classified | Fail-closed Brand Payouts provider + C-05 P2 adapter 2026-09-11. Postmark OTP live send PASS 2026-09-10. Live IG/Razorpay **NOT_RUN** / `PROVIDER_DEFERRED` |
| frontend lint | PASS | RUN 4 + clone |
| backend lint | PASS classified | `npm run lint:eslint` clean 2026-09-11 (prettier plugin off). `npm run lint` prettier 712 remains **accepted** `PREEXISTING_ACCEPTED_DEBT` (do not `--fix`) |
| clean worktrees | NOT_CLAIMED | do not commit `tmp-*` / OTP logs |
| local/remote checkpoint equality | this amendment: origin still one BE commit behind local `23d315a`; FE origin = `5e6cfe5` | freeze branch only; not `development`/`main` |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden.

**Amendment 2026-09-10 targeted gates (not full farms):**

```text
BE prisma validate                              PASS
BE out-of-mvp-competing-transition-retired      PASS 3/3
BE Brand Payouts unit (P0/P1/P3a/controller/wave-b/reserve/v2) PASS
BE C-05 P1D architecture                        PASS 5/5
BE C-04 collab vitest (14 formerly node:test files) PASS 14/14 files, 106/106 tests
BE prettier/prettier 712                            ACCEPTED this freeze (do not --fix)
FE C-02A Home architecture/schemas/nav          PASS
FE Brand Payouts P2 + Wave C                    PASS 40 tests across 5 files
full npm test farms                             NOT_RE_RUN (do not greenwash)
Brand Payouts Wave B postgres                   PASS 3/3 on localhost/waveb_runtime (generate first; npx vitest skips pretest)
post-Wave-B targeted C-04 + Payouts unit        PASS 23 files / 167 tests (5 skipped env-gated)
FE↔BE local smoke                               PASS 2026-09-11 Parent confirm
INV-11 accepted IN API clients                  PASS classified
INV-09 leftover shipping HTTP+service           410; consumption still PARTIAL
provider fail-closed recovery                   PASS classified (live IG/Razorpay later)
BE lint:eslint (prettier plugin off)            PASS classified 2026-09-11
BE prettier/prettier 712                            ACCEPTED this freeze (do not --fix)
NO_KNOWN_DEPLOYABLE_SECURITY_BYPASS             NOT DECLARED
immutable SHA pair                              checkpoint this push; not freeze PASS
```
