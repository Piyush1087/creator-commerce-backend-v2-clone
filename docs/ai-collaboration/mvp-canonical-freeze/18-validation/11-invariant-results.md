# 11 — Cross-module invariant results

**Date:** 2026-09-09  
**Runs:** RUN 4 (static/unit/smoke) + RUN 5 (postgres)  
**Suite definition:** `../phase-d-invariants/cross-module-invariant-suite.md`

OTP codes and secrets are not recorded here.

| ID | Result | Proof | Classification / notes |
| --- | --- | --- | --- |
| INV-01 | PASS (static/unit + postgres 10/10) | FE auth tests; BE `auth-security.static/unit`; `auth-security.postgres.test.ts` on `bs12_freeze_auth` | |
| INV-02 | PARTIAL | C-01 org trigger + C-01 I2 postgres (26/29) | Identity recon 3 fails = harness drift |
| INV-03 | PASS architecture/smoke; postgres PARTIAL | FE creator-entry; browser Brand↛Creator; `creator-entry.postgres.test.ts` 26/29 | 3 Brand-activation race tests `STALE_TEST_PROVEN` |
| INV-04 | PASS (unit + postgres 5/5) | C-05 policy + `creator-team.postgres.test.ts` on `c05_freeze_team` | |
| INV-05 | PASS (unit + smoke) | Shell tests + browser hide | Chat architecture git-diff test vs P6 SHA is stale (`15-full-npm-test.md`) |
| INV-06 | PARTIAL postgres | Handoff suite 27/30 on `c03_p14_handoff` | 3 query timeouts 5s `ENVIRONMENT_BLOCKED` |
| INV-07 | PARTIAL postgres | Same handoff file: approval commits Collaboration | Same 3 timeouts; collab seed still `STALE_TEST_PROVEN` |
| INV-08 | PARTIAL | C-05 P2 architecture | Brand Payouts v1 / C-06 out |
| INV-09 | PARTIAL | C-05 Settings contact/shipping unit+architecture PASS (BE 24/24 isolated 2026-09-09). Brand Collab fulfillment does **not** read `CreatorShippingAddress`; it stores Brand-entered evidence. Collab `POST creator/shipping-address` is a second writer. C-05 P2 forbids Collaboration business deps. Cross-module *consumption* not proven; not a Brand Payouts pull. | `ENVIRONMENT_BLOCKED` FE contact tests hung; Settings half proven |
| INV-10 | PARTIAL | Postmark fail + OTP still issued off-prod (postgres + smoke) | Live IG/Razorpay NOT_RUN |
| INV-11 | PARTIAL | Browser Brand Home fail-closed for Creator | |
| INV-12 | PASS (unit + postgres 11/11 + browser) | `brand-workspace-authorization.postgres.test.ts` on `bs07_freeze_auth` | |
| INV-13 | FAIL classified; **Parent-accepted 2026-09-09** later amendment | Same duplicate tables on C-03 accepted `aebeb85`, origin `development` `cd446fb`, freeze. Canonical C-03 writes `Collaboration`; UCE pipeline leftover. Bank/payout models vs C-05 destinations + C-06/Payouts not pulled. **No Prisma drop this freeze.** | `PREEXISTING_ACCEPTED_DEBT` (was `UNKNOWN_REQUIRES_REVIEW`) |

Postgres commands: `13-postgres-invariants.md`.
