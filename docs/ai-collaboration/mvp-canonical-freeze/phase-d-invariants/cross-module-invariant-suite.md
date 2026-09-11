# Cross-module invariant suite (§11)

Compact high-value invariants only. Not a restatement of every module test.

**Status:** DEFINED + audited 2026-09-09 against freeze tree and `../18-validation/11-invariant-results.md`  
**Execution lives in §18.** This file is the preflight definition (authority + proof files + tests).

Charter examples are all represented (INV-01 … INV-13). C-02A, C-04, and Brand Payouts v1 are **in this suite** after the amendment pull. C-06 remains out.

| ID | Invariant | Authority | FE proof | BE proof | Tests | Execution |
| --- | --- | --- | --- | --- | --- | --- |
| INV-01 | One canonical auth/session model across Brand and Creator | Shared platform | `src/shared/auth/*`, `src/features/auth/*`, `require-auth.tsx` | `src/features/auth/*` | FE `auth-security-static.test.ts`; BE `auth-security.static/unit/postgres.test.ts` | **PASS** (postgres 10/10) |
| INV-02 | Normalized identity/account ownership (User ↔ OrganizationKind) | Shared + C-01 + Brand Settings | C-01 entry clients / session role | Prisma `User` `Organization`; C-01 I1 persistence | BE `c01-persistence-security.postgres.test.ts`; C-01 I2 via `creator-entry.postgres.test.ts` | **PASS** I2 leftover closed (29/29, same as INV-03) |
| INV-03 | Creator Entry gating and recovery | C-01 | `creator-platform-route-guard.tsx` | `src/features/creator-entry/*` | FE `creator-platform-route-guard.test.ts` `creator-entry-architecture.test.ts`; BE `creator-entry.postgres.test.ts` | Architecture/smoke PASS; postgres **29/29** (harness ctor aligned RUN 7) |
| INV-04 | C-05 Team actor vs canonical Creator business subject | C-05 | `creator-settings-action-guard.tsx`, `creator-shell-capabilities.ts` | `creator-workspace-actor.controller.ts` `creator-team.policy.ts` | FE settings action-guard tests; BE `creator-team.postgres.test.ts` (5/5) | **PASS** |
| INV-05 | Creator shell route ownership; Marketplace hidden | C-05 + freeze hide | `sidebar-items.ts` `bottom-nav-items.ts` `app-routes.tsx` | n/a (FE chrome) | `c05-frontend-convergence.architecture.test.ts` `creator-shell-capabilities.test.ts` `creator-shell-rendering.test.ts` | **PASS** unit+smoke. Chat architecture test retargeted RUN 9 |
| INV-06 | Campaign Application identity and Product/Brief relationship | C-03 | C-03 campaign pages/clients | `UceApplication` `UceApplicationSnapshot` `CanonicalCampaignBrief`; `campaign-applications/*` `brand-uce/persistence/*` | BE C-03 P11/P14 postgres (`c03-p11*.postgres.test.ts`, applications postgres) | **PASS** 34/34 serial leftover retry |
| INV-07 | Accepted Application → Collaboration handoff | C-03 + Brand Collab | `CollaborationRouteGuard.tsx`; Brand/Creator collab pages | `application-handoff`; `Collaboration` | BE `application-handoff.postgres.test.ts` `legacy-handoff-regression.postgres.test.ts` | **PASS** handoff. Local `seed-dev-collaboration.ts` is a legacy brief-linked fixture (RUN 9), not this proof |
| INV-08 | Collaboration commercial agreement → payout/settlement boundary | Brand Collab + Settings escrow + Brand Payouts v1 | Brand Settings billing/escrow UI; Brand Payouts page | `CollaborationCommercialAgreement` `CollaborationSettlement` `BrandEscrowVault`; Brand Payouts v1 provider-disabled | BE `brand-escrow` postgres; C-05 P2 architecture; Brand Payouts P0/P1/controller unit | **PARTIAL** — Payouts v1 pulled, provider-disabled; C-06 still OUT |
| INV-09 | Settings shipping/contact → Collaboration fulfillment consumption | C-05 + C-04 | `creator-profile-contact-settings.tsx` | C-05 profile/contact APIs. Collab `POST creator/shipping-address` is already `410`. C-04 fulfillment stores Brand-entered evidence | FE contact tests; BE contact-phone isolated | **PARTIAL** — Settings half proven; consumption still not the C-05 address row |
| INV-10 | Provider state fail-closed | Provider clients | FE does not fake provider success | Instagram/Razorpay/Postmark clients | BE mail/notification tests; C-05 P2 fail-closed adapter; OTP postgres | **PARTIAL** — Postmark OTP live send **PASS** 2026-09-10; live IG/Razorpay **NOT_RUN** |
| INV-11 | Backend business state authoritative over frontend display | All accepted IN modules | Feature `api/` clients; mutations go to BE | Controllers/services | FE `brand-home-architecture.test.ts` `chat-architecture.test.ts`; browser Brand Home vs Creator session | **PARTIAL** — Brand Home fail-closed for Creator proven; not every mutation path re-proven this freeze |
| INV-12 | Cross-tenant and cross-role isolation | Auth + workspace guards | `require-auth.tsx` role home routes | Brand Centre authz; C-05 team | BE `brand-workspace-authorization.postgres.test.ts` (11/11); C-05 team postgres | **PASS** |
| INV-13 | No duplicate competing persistence for the same canonical concept | Schema SOP | n/a | Prisma pairs + runtime writers in `inv-13-competing-writers.md` | Schema register; `out-of-mvp-competing-transition-retired.test.ts` | **PASS classified** — Pair 1 and Pair 2 leftover journey writers retired `410`. Canonical C-04 agreement path remains. No Prisma drop |

## Explicitly out of this suite

- C-06, Marketplace browse (except “must not be required for MVP journeys”)
- Co-Pilot collab mutations (retired `410`; campaign/planner HITL remains Chat Home)
- Creator Centre product chrome (routes redirect Home)

## Preflight verdict

Suite is **defined**. Execution is PARTIAL overall (INV-08/09/10/11 PARTIAL). INV-13 leftover journey writers are PASS classified (tables retained). C-02A / C-04 / Brand Payouts v1 are now in lineage. That still blocks freeze PASS.
