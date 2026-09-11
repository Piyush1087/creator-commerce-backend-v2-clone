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
| INV-08 | PARTIAL | C-05 P2 architecture + Brand Payouts v1 pulled (provider-disabled). Wave B postgres **PASS 3/3**. C-06 still OUT — left for next |
| INV-09 | PASS classified | Settings contact proven. Leftover collab shipping HTTP+service `410`. C-04 destination snapshot consumption. Parent reconfirm 2026-09-11 16:50: BE INV-09 static **3/3**, `c04-runtime`+fulfillment **15/15**, FE `c04-frontend` **6/6**. Auth security static+unit **14/14**. Do not invent a live fulfillment join. Destination postgres not re-run this pass. |
| INV-10 | PARTIAL | Postmark OTP template live send **PASS** 2026-09-10. Fail-closed payouts/C-05 recovery **PASS classified** 2026-09-11. Live IG/Razorpay **NOT_RUN** |
| INV-11 | PASS classified | Accepted IN feature API clients use `authenticatedFetch` → `/api/v1`. Brand Home / Creator Home aggregators only. Brand Home fail-closed for Creator (smoke). OUT Co-Pilot/Centre/C-06 hub excluded | |
| INV-12 | PASS (unit + postgres 11/11 + browser) | `brand-workspace-authorization.postgres.test.ts` on `bs07_freeze_auth` | |
| INV-13 | PASS classified (pairs 1–2 leftover journey writers retired) | Pair 1 `UceCampaignCollaboration` writes `410`. Pair 2 leftover commercial/logistics/media/finalization service writes `410 LEGACY_COLLABORATION_AGGREGATE_WRITE_RETIRED`; escrow reserve no longer writes `CollaborationCommercial`. Canonical C-03/C-04 still write `Collaboration` + `CollaborationCommercialAgreement`. Tables retained. **No Prisma drop.** Proof: `../phase-d-invariants/inv-13-competing-writers.md` | Writer proof closed; freeze itself is still not PASS |

Postgres commands: `13-postgres-invariants.md`.
