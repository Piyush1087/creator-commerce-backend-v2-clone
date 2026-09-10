# Whole-application coverage map (§10)

**Source:** freeze-branch frontend `src/routes/app-routes.tsx` + `brand-onboarding-app.tsx` + `creator-onboarding-app.tsx`; backend `src/app.module.ts` + `@Controller` prefixes.  
**Audited:** 2026-09-09 (freeze working tree). Route hide unchanged since RUN 1.  
**Classification key:** `CANONICAL` | `DEFERRED` | `OUT_OF_MVP` | `LEGACY_ONLY` | `INFRA` | `PROVIDER_DEFERRED`

A route merely existing in code does not make it part of the canonical product.

## Charter journeys

| Journey | Classification | Canonical surfaces | Notes |
| --- | --- | --- | --- |
| public/guest entry | MIXED | `/login`, `/forgot-password`, `/reset-password`, `/` Gatekeeper landing, `/brand/:slug` public brand page, `/campaigns/:campaignId` C-03 public campaign | `/marketplace*` stays OUT_OF_MVP inbound (`CampaignUnavailable` / C-03 redirect). New CTAs no longer generate Marketplace browse URLs (C-01 recovery → Campaigns; guest campaign share/login-return → `/campaigns/:id`; missing brand slug → `/`). |
| Brand onboarding | CANONICAL | `/`, `/brand/onboarding/{scan,core-identity,intelligence-scan,dna,catalogue,competitors,verification,pricing,social-sync,sync-verify,sync-complete}`, Gatekeeper discovery | `dna` is compatibility resume → scan page. `/brand/intelligence/identity-test` inbound redirects to Home (RUN 9). |
| Brand Preview / Brand Centre | CANONICAL | `/brand-centre`, `/brand-centre/offerings`, `/brand-centre/offerings/:offeringId` | Brand Centre + PI |
| Brand Settings | CANONICAL | `/brand/settings/{general,integrations,billing,escrow}` | Settings MVP + escrow/billing (not Brand Payouts v1) |
| Campaign creation and Brand Campaign workspaces | CANONICAL | `/brand/uce/campaigns`, `/create`, `/:id` | Brand UCE |
| Creator Entry | CANONICAL | `/creator/onboarding`, Instagram callbacks `/creator-marketplace/callback` and `/integrate-instagram` | C-01. Callback paths keep marketplace naming; they are Instagram OAuth, not browse. |
| Creator persistent shell | CANONICAL (C-05) / DEFERRED (C-02A Home product) | Sidebar + bottom nav: Home · Campaigns · Collaborations · Settings | `/creator/home` is the C-05 **slot** (`CreatorWorkspaceEntryPage`). Accepted C-02A `src/features/creator-home` + `GET /api/v1/creator/home` are **not** in this tree. Do not confuse with leftover Creator Centre Home files (unmounted). Brand bottom “Chat” is `/brand/collaborations`. Chat Home is `/brand/dashboard`. |
| Creator Settings | CANONICAL | `/creator/settings/{account,profile,team,instagram,payouts}` | C-05; `/social` redirects to Instagram |
| Creator Campaign participation | CANONICAL | `/creator/campaigns/opportunities`, `opportunities/:campaignId`, `applications`, `applications/:applicationId` | C-03; marketplace URLs redirect here |
| Collaboration — Brand | CANONICAL | `/brand/collaborations`, `/brand/collaboration-page` | Brand Collab + Phase G |
| Collaboration — Creator | MIXED | `/creator/collaborations` still mounted (`CollaborationRouteGuard` + shared workspace) | C-04 accepted pack **not pulled**. Brand-side collab remains. |
| Payouts / earnings / KYC | MIXED | Brand: Settings billing + escrow. Creator: Settings payouts + legal | Brand Payouts v1 deferred. C-06 OUT. Old hubs redirect. |
| shared authentication/session/security | CANONICAL | `/api/v1/auth`, JWT session, OTP, Google | |
| Intelligence / Data Extraction consumers | CANONICAL as infra | Brand onboarding + Centre + PI consumers | `IntelligenceConsumerModule` has **no HTTP controller** (in-process). DE is not a user-facing product. |
| notifications required by MVP | CANONICAL as infra | Brand + Creator notification APIs, Postmark | |
| provider boundaries | PROVIDER_DEFERRED / fail-closed | Instagram/Meta, Razorpay, Postmark, Gemini/OpenAI, Zyte, Google | See `../16-external-providers/` |

## Must not re-enter the product

| Surface | How it is blocked on freeze branch | Residual risk (still true 2026-09-09) |
| --- | --- | --- |
| Marketplace browse | Guest `/marketplace` and invite render `CampaignUnavailable`; `/marketplace/:campaignId` and `/creator/marketplace*` redirect to C-03 | Inbound compat URLs remain. Product CTAs now target C-03 Campaigns / `/campaigns/:id` / `/`. Unmounted leftover marketplace **pages** still exist. **Not** shell nav. |
| Co-Pilot | No shell nav | Backend `CoPilotModule` + `CreatorCoPilotModule` still imported; HTTP still live |
| Creator Centre / analytics / media-kit | FE routes redirect to `/creator/home` | Page files remain. **BE** `GET api/v1/public/creators/:slug/media-kit` and `api/v1/creator-centre` still imported |
| Brand/Creator payout hubs | FE redirect to Settings billing / Settings payouts | Old feature folders and BE controllers still wired |
| C-02A Home | Placeholder C-05 entry only; accepted pack not an ancestor | See **C-02A vs freeze** below |
| Creator Centre Home UI | Unmounted page files; FE routes redirect Home | Not C-02A (C-02A handoff: Centre is separately deferred) |
| `/help` | Brand Support + Creator Help footer | Mounted placeholder `HelpPage` under authenticated shell. Not a product journey. |

## C-02A vs freeze (Phase C — 2026-09-09)

There is no separate product module named **C-02**. The accepted Home module is **C-02A — Creator Home Foundation** (dummy_tcs parent acceptance `3ac98959`).

| Layer | On freeze (`HEAD`) | On accepted C-02A SHA | Class for this freeze |
| --- | --- | --- | --- |
| Route `/creator/home` | Mounted → `CreatorWorkspaceEntryPage` (C-05 stub: “Creator Home is deferred”) | Would mount `src/features/creator-home` workspace | **CANONICAL shell slot** / **DEFERRED product** |
| FE `src/features/creator-home/*` | **Absent** | Present (`creator-home-client`, schemas, workspace, destinations) | DEFERRED — not pulled |
| BE `src/features/creator-home/*` + `GET /api/v1/creator/home` | **Absent** (grep freeze: no match) | Present (`creator-home.controller.ts`, aggregation service, postgres tests) | DEFERRED — not pulled |
| FE `CreatorCentrePage` / `CreatorHomePage` / `HomeBriefingWorkspace` | Files in tree; **not** in `app-routes.tsx`. `/creator/centre` `/analytics` `/media-kit` **redirect Home** | C-02A handoff lists Centre / Media Kit / Analytics as **future additive, not C-02A debt** | **OUT / DEFERRED Centre leftover**, not a partial C-02A pull |
| BE `CreatorCentreModule` `api/v1/creator-centre` | Still imported (media-kit + analytics pulse) | Not the C-02A Home API | Same leftover as Phase C Centre row |
| `src/features/home/HomePage.tsx` | Unrouted “coming soon” | n/a | Unmounted leftover |
| C-04 dependency | Brand Collab on freeze; C-04 pack not pulled | C-02A BE ancestry **includes** accepted C-04 `ec395bf5` | Do **not** pull C-02A without C-04 (Parent) |

**Verdict:** C-02A is **not** partly integrated as the accepted product. Only the Home **URL/shell** exists. Leftover Centre briefing UI can look like a Home, but it is unmounted and is **not** the accepted C-02A aggregation (KPIs, sections, one `GET /api/v1/creator/home`). Keep DEFERRED. Do not treat Centre files as C-02A progress.

## Unmounted leftovers (not product journeys)

| Surface | Why it is not a journey |
| --- | --- |
| `src/temp/aurora-playground` | Not referenced from `App.tsx` / `AppRoutes` |
| `BrandCoPilotWorkspace` / `brand-home-assistant-panel.tsx` | Not used by `BrandDashboardPage` (Chat Home uses `useBrandChat`; `chat-architecture.test.ts` forbids `useBrandCoPilot` on that page) |
| Creator Centre / analytics / media-kit **page files** | Routes redirect Home |
| `creator-centre.css` on Brand dashboard | Styling leftover only |

## Charter coverage verdict

Intended MVP journeys are covered by accepted IN modules **on the freeze branch**, with named MIXED leftovers (Creator collab route, payouts hubs, OUT APIs still imported). identity-test inbound redirects to Home (RUN 9). Marketplace browse CTAs were retargeted; inbound `/marketplace*` compat remains. That is classification, not freeze PASS. Phase C is **complete enough to move to Phase D**.
