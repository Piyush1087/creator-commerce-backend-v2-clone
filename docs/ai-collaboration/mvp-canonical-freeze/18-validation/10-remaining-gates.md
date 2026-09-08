# 10 — Remaining §18 gates

**Date:** 2026-09-08  
**Run:** RUN 4

| Gate | Status | Classification |
| --- | --- | --- |
| fresh checkout / `npm ci` | NOT_RUN | working copies used |
| full unit/contract `npm test` | NOT_RUN | hang risk; targeted tests only |
| module acceptance suites | NOT_RE_RUN | PREEXISTING_ACCEPTED_DEBT until reconfirmed |
| cross-module invariant suite execution | PARTIAL | `11-invariant-results.md` — INV-06/07/09 postgres and live INV-10 not run; INV-13 classified debt |
| frontend ↔ backend smoke | PARTIAL PASS | `12-frontend-backend-smoke.md` — OTP login + shell hide + Brand Home + Creator Campaigns/Settings. Not a full apply/handoff matrix |
| auth/session regression | PARTIAL | BS-12 static+unit PASS; postgres auth tests not run |
| RBAC / actor-subject / cross-tenant | PARTIAL | unit + one browser Brand↛Creator block; dedicated postgres NOT_RUN |
| responsive shell/navigation smoke | NOT_RUN in viewport matrix | hide is unit-tested and one desktop browser pass |
| provider-unavailable recovery | PARTIAL | local Postmark send failed, OTP still issued off-prod; Instagram/Razorpay NOT_RUN |
| frontend lint | PASS | `06-lint.md` |
| backend lint | FAIL | 712 `prettier/prettier` — `PREEXISTING_ACCEPTED_DEBT` |
| clean worktrees | NOT_CLAIMED | BE `tmp-*` / logs must not be committed |
| local/remote checkpoint equality | local only | do not push unless Parent asks |

`PASS — MVP_CANONICAL_APPLICATION_FREEZE_V1` is still forbidden until remaining gates are closed or Parent-accepted as debt.
