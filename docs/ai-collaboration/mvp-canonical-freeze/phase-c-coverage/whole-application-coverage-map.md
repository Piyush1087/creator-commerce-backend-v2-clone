# Whole-application coverage map (§10)

**Source:** freeze-branch frontend `src/routes/app-routes.tsx` + `brand-onboarding-app.tsx` + `creator-onboarding-app.tsx`; backend `src/app.module.ts` + controllers.  
**Date:** 2026-09-08  
**Classification key:** `CANONICAL` | `DEFERRED` | `OUT_OF_MVP` | `LEGACY_ONLY` | `INFRA`

A route merely existing in code does not make it part of the canonical product.

## Charter journeys

| Journey | Classification | Canonical surfaces | Notes |
| --- | --- | --- | --- |
| public/guest entry | MIXED | `/login`, `/forgot-password`, `/reset-password`, `/` Gatekeeper landing, `/brand/:slug` public brand page, `/campaigns/:campaignId` C-03 public campaign | `/marketplace*` is OUT_OF_MVP (unavailable / C-03 redirect only) |
| Brand onboarding | CANONICAL | `/brand/onboarding/*`, Gatekeeper discovery, Brand Preview scan/DNA/catalogue/competitors/verification/pricing/social-sync | Gatekeeper + Preview + BI |
| Brand Preview / Brand Centre | CANONICAL | `/brand-centre`, offerings, budget | Brand Centre + PI |
| Brand Settings | CANONICAL | `/brand/settings/{general,integrations,billing,escrow}` | Settings MVP + escrow/billing (not Brand Payouts v1) |
| Campaign creation and Brand Campaign workspaces | CANONICAL | `/brand/uce/campaigns`, create, detail | Brand UCE |
| Creator Entry | CANONICAL | `/creator/onboarding`, Instagram callbacks | C-01 |
| Creator persistent shell | CANONICAL (C-05) / DEFERRED (C-02A Home content) | Sidebar + bottom nav: Home · Campaigns · Collaborations · Settings | Home page is C-05 workspace entry, not accepted C-02A Home |
| Creator Settings | CANONICAL | `/creator/settings/{account,profile,team,instagram,payouts}` | C-05; `/social` redirects to Instagram |
| Creator Campaign participation | CANONICAL | `/creator/campaigns/opportunities`, applications | C-03; marketplace URLs redirect here |
| Collaboration — Brand | CANONICAL | `/brand/collaborations`, `/brand/collaboration-page` | Brand Collab + Phase G |
| Collaboration — Creator | MIXED | `/creator/collaborations` still mounted on shared `CollaborationWorkspace` | C-04 accepted pack **not pulled**. Brand-side collab remains. Creator-side C-04 authority is deferred |
| Payouts / earnings / KYC | MIXED | Brand: Settings billing + escrow. Creator: Settings payouts + legal | Brand Payouts v1 deferred. C-06 OUT. Old hubs redirect |
| shared authentication/session/security | CANONICAL | `/api/v1/auth`, JWT session, OTP, Google | BS-12 |
| Intelligence / Data Extraction consumers | CANONICAL as infra | Brand onboarding + Centre + PI consumers | DE is not a user-facing product |
| notifications required by MVP | CANONICAL as infra | Brand + Creator notification APIs, Postmark | |
| provider boundaries | PROVIDER_DEFERRED / fail-closed | Instagram/Meta, Razorpay, Postmark, Gemini/OpenAI, Zyte, Google | See `../16-external-providers/` |

## Must not re-enter the product

| Surface | How it is blocked on freeze branch | Residual risk |
| --- | --- | --- |
| Marketplace browse | Guest routes render `CampaignUnavailable`; creator marketplace redirects to C-03 opportunities | Public brand landing still navigates to `PUBLIC_ROUTES.marketplace` on some failures — classified LEGACY_COMPAT; later amendment |
| Co-Pilot | No shell nav | Backend `CoPilotModule` + `CreatorCoPilotModule` still imported |
| Creator Centre / analytics / media-kit | Redirect to `/creator/home` | Page files remain in tree |
| Brand/Creator payout hubs | Redirect to Settings billing / Settings payouts | Old feature folders and BE controllers still wired |
| C-02A Home | Home is C-05 entry with explicit deferred copy | Accepted Home SHA not pulled |
