# 11 — Cross-module invariant results

**Date:** 2026-09-08  
**Run:** RUN 4  
**Suite definition:** `../phase-d-invariants/cross-module-invariant-suite.md`

OTP codes and secrets are not recorded here.

| ID | Result | Proof | Classification / notes |
| --- | --- | --- | --- |
| INV-01 | PASS (static/unit) | FE `require-auth.test.ts`, `post-login-redirect.test.ts`; BE `auth-security.static.test.ts`, `auth-security.unit.test.ts` | Postgres auth isolation not run |
| INV-02 | PARTIAL | Schema trigger `C01_ACTIVE_*_ORGANIZATION_REQUIRED` observed when activating `test@creator.com` without an org | Runtime org identity proven by trigger; no dedicated test file this run |
| INV-03 | PASS (architecture + smoke) | FE creator-entry + guard-scope tests; browser: Creator Home deferred page; Brand hitting `/creator/home` → Creator onboarding “Brand account cannot enter Creator setup” | C-02A Home content still deferred |
| INV-04 | PASS (architecture/unit) | FE C-05 convergence + Settings guard-scope; BE C-05 P2 architecture + `creator-team.policy.test.ts` | Actor vs subject postgres not run |
| INV-05 | PASS (unit + smoke) | Shell tests; authenticated nav had Home / Campaigns / Collaborations / Settings; no Marketplace / Centre / Co-Pilot / payout hub | Creator post-login can still honor a `/brand/` return path (see smoke) |
| INV-06 | NOT_RUN | Named C-03 postgres proof DBs not created | `PREEXISTING_ACCEPTED_DEBT` until Parent requires them. Smoke showed LIVE opportunity list for the C-03 fixture |
| INV-07 | NOT_RUN | `application-handoff` postgres not executed | `seed-dev-collaboration.ts` fails TypeScript vs current Prisma (`Organization.kind`, stale `UceApplication` fields) — `STALE_TEST_PROVEN`, not a freeze-hide regression |
| INV-08 | PARTIAL | BE C-05 P2 architecture: payout authority encrypted, fail-closed readiness; Brand Payouts v1 / C-06 not in freeze | Boundary unit only |
| INV-09 | NOT_RUN | Settings shipping → fulfillment consumption not executed | |
| INV-10 | PARTIAL | Auth static/unit bind OTP mail to Postmark; local Postmark send **failed**, OTP still issued (non-prod log). No production-success simulation observed | Live Instagram/Razorpay unavailable-recovery **NOT_RUN** |
| INV-11 | PARTIAL | Brand Home for a Creator session fail-closed (“Brand Centre is available to active brand users only”). Mutations not exhaustively proven | |
| INV-12 | PARTIAL | BE `brand-workspace-authorization.service.test.ts` unit PASS; browser: Brand cannot enter Creator setup. Dedicated cross-tenant postgres **NOT_RUN** | |
| INV-13 | FAIL classified | Duplicate persistence remains | `UNKNOWN_REQUIRES_REVIEW` — later amendment, not extra scope this freeze |

Commands and counts: `07-targeted-tests.md`. Browser narrative: `12-frontend-backend-smoke.md`.
