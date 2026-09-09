# Cross-module invariant suite (§11)

Compact high-value invariants only. Not a restatement of every module test.

**Status:** DEFINED. RUN 4 + RUN 5 execution: `../18-validation/11-invariant-results.md`.  
**Date:** 2026-09-08

| ID | Invariant | Authority | Prove with |
| --- | --- | --- | --- |
| INV-01 | One canonical auth/session model across Brand and Creator | Shared platform + BS-12 | `src/features/auth/*`; FE `src/shared/auth/*`; `auth-security.static.test.ts` |
| INV-02 | Normalized identity/account ownership (User ↔ OrganizationKind) | Shared + C-01 + Brand Settings | Prisma `User` `Organization`; C-01 I1 org foundation migration |
| INV-03 | Creator Entry gating and recovery | C-01 | FE `creator-platform-route-guard`; BE `creator-entry` |
| INV-04 | C-05 Team actor vs canonical Creator business subject | C-05 | `creator-workspace-actor`; Settings action guards |
| INV-05 | Creator shell route ownership; Marketplace hidden | C-05 + freeze hide | `sidebar-items.ts` `bottom-nav-items.ts` `app-routes.tsx` |
| INV-06 | Campaign Application identity and Product/Brief relationship | C-03 | `UceApplication` `UceApplicationSnapshot` `CanonicalCampaignBrief` |
| INV-07 | Accepted Application → Collaboration handoff | C-03 + Brand Collab | `application-handoff`; `Collaboration` |
| INV-08 | Collaboration commercial agreement → payout/settlement boundary | Brand Collab + Settings escrow | `CollaborationCommercialAgreement` `CollaborationSettlement` `BrandEscrowVault`; Brand Payouts v1 **not** in this freeze; C-06 **out** |
| INV-09 | Settings shipping/contact → Collaboration fulfillment consumption | C-05 + Brand Collab | `CreatorShippingAddress` `CreatorProfile` → fulfillment |
| INV-10 | Provider state fail-closed | Provider clients | Instagram/Razorpay/Postmark: missing secrets must not simulate production success |
| INV-11 | Backend business state authoritative over frontend display | All accepted modules | No frontend-only authorization for mutations |
| INV-12 | Cross-tenant and cross-role isolation | Auth + workspace guards | Brand cannot read Creator Settings; Creator cannot hit Brand Centre writes |
| INV-13 | No duplicate competing persistence for the same canonical concept | Schema SOP | Known debt: `UceCampaignCollaboration` vs `Collaboration`; `CollaborationCommercial` vs `CollaborationCommercialAgreement`; `CreatorBankDetails` vs `CreatorPayoutDestination` vs `CreatorSettlementProfile`. **Parent-accepted 2026-09-09** later amendment (same as last-accepted C-03 + origin Brand Collab). No Prisma drop this freeze. |

## Explicitly out of this suite

- C-02A Home content
- C-04 Creator Collaboration accepted pack
- Brand Payouts v1 provider-disabled pack
- C-06, Marketplace browse, Co-Pilot, Creator Centre
