# 11 — Cross-module invariant results

**Date:** 2026-09-10  
**Runs:** RUN 4 (static/unit/smoke) + RUN 5 (postgres) + RUN 7 (INV-03 harness 29/29) + RUN 9 (local hygiene)  
**Suite definition:** `../phase-d-invariants/cross-module-invariant-suite.md`

OTP codes and secrets are not recorded here.

| ID | Result | Proof | Classification / notes |
| --- | --- | --- | --- |
| INV-01 | PASS (static/unit + postgres 10/10) | FE auth tests; BE `auth-security.static/unit`; `auth-security.postgres.test.ts` on `bs12_freeze_auth` | |
| INV-02 | PASS (I2 leftover closed) | Same `creator-entry.postgres.test.ts` 29/29 as INV-03 | Documented PARTIAL was the I2 harness ctor, not a new I1 fail |
| INV-03 | PASS architecture/smoke + postgres 29/29 | FE creator-entry; browser Brand↛Creator; `creator-entry.postgres.test.ts` Parent-run 2026-09-09 | Harness ctor now `(prisma, mail, scan, auth, googleAuth)` |
| INV-04 | PASS (unit + postgres 5/5) | C-05 policy + `creator-team.postgres.test.ts` on `c05_freeze_team` | |
| INV-05 | PASS (unit + smoke) | Shell tests + browser hide | Chat architecture test retargeted RUN 9 (no P6 git-diff) |
| INV-06 | **PASS** postgres (2026-09-09 retry) | Fresh `c03_p14_handoff` 34/34 serial `--testTimeout=30000` | Prior 5s timeouts + dirty-DB count drift were `ENVIRONMENT_BLOCKED`, not product red |
| INV-07 | **PASS** postgres handoff; local seed leftover closed RUN 9 | Same suite: approval commits `Collaboration` | `scripts/seed-dev-collaboration.ts` now seeds a **legacy** brief-linked fixture (`source_application_id` null). Canonical handoff remains this suite |
| INV-08 | PARTIAL | C-05 P2 architecture + Brand Payouts v1 pulled (provider-disabled). C-06 still OUT |
| INV-09 | PARTIAL | C-05 Settings contact/shipping unit+architecture PASS (BE 24/24 isolated; Parent reconfirm 2026-09-09 BE contact-phone 8/8 + FE 6/6). Collab `POST creator/shipping-address` is already `410`. C-04 fulfillment still stores Brand-entered evidence, not `CreatorShippingAddress`. |
| INV-10 | PARTIAL | Postmark OTP template live send **PASS** 2026-09-10 (Parent-confirmed inboxes). RUN 4/postgres “send failed” was invalid TemplateId `1` (422/1101); off-prod OTP still issued from log. | Live IG/Razorpay NOT_RUN |
| INV-11 | PARTIAL | Browser Brand Home fail-closed for Creator | |
| INV-12 | PASS (unit + postgres 11/11 + browser) | `brand-workspace-authorization.postgres.test.ts` on `bs07_freeze_auth` | |
| INV-13 | FAIL classified (Pair 1 writers retired) | `UceCampaignCollaboration` writes fail-closed `410` (Brand UCE pipeline, creator-uce apply, marketplace, leftover approve update). Canonical C-03/C-04 still write `Collaboration`. Pair 2 escrow/legacy commercial source writers remain. **No Prisma drop.** Proof: `../phase-d-invariants/inv-13-competing-writers.md` | Pair 1 Parent decision applied; overall INV-13 not PASS |

Postgres commands: `13-postgres-invariants.md`.
