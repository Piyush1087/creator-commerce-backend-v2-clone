# Frontend route classification

**Repo:** `growth-verse/creator-commerce-frontend-v2`  
**Evidence file:** `src/routes/app-routes.tsx`, `src/routes/brand-onboarding-app.tsx`, `src/routes/creator-onboarding-app.tsx`, `src/layouts/app-shell/sidebar-items.ts`, `src/layouts/app-shell/bottom-nav-items.ts`  
**Freeze branch evidence SHA (RUN 1 hide):** `71fe273e9a4d84b868dc7511d606e1109f2d566e`

## Auth and public

| Path | Class | Authority |
| --- | --- | --- |
| `/login` | CANONICAL | Shared auth |
| `/forgot-password` | CANONICAL | Shared auth |
| `/reset-password` | CANONICAL | Shared auth |
| `/brand/team-invitations/accept` | CANONICAL | Brand Settings team |
| `/creator/team-invitations/accept` | CANONICAL | C-05 team |
| `/campaigns/:campaignId` | CANONICAL | C-03 public campaign |
| `/marketplace` | OUT_OF_MVP | `CampaignUnavailable` |
| `/marketplace/invite/:token` | OUT_OF_MVP | unavailable invitation |
| `/marketplace/:campaignId` | OUT_OF_MVP / C-03 compat | `LegacyCampaignRedirect` |
| `/creator/marketplace` | OUT_OF_MVP / C-03 compat | Navigate to opportunities |
| `/creator/marketplace/:campaignId` | OUT_OF_MVP / C-03 compat | `LegacyCampaignRedirect` |
| `/brand/:slug` | CANONICAL | Public brand landing |

## Brand authenticated

| Path | Class | Authority |
| --- | --- | --- |
| `/brand/dashboard` | CANONICAL | Chat Home / Brand Home V1 |
| `/brand-centre` + offerings | CANONICAL | Brand Centre + PI |
| `/brand/uce/campaigns` + create/detail | CANONICAL | Brand Campaign / UCE |
| `/brand/collaboration-page` | CANONICAL | Brand Collab |
| `/brand/collaborations` | CANONICAL | Brand Collab |
| `/brand/payouts` | LEGACY_ONLY | Redirect → Settings billing |
| `/brand/settings/general` | CANONICAL | Brand Settings |
| `/brand/settings/integrations` | CANONICAL | Brand Settings |
| `/brand/settings/billing` | CANONICAL | Brand Settings / escrow-billing |
| `/brand/settings/escrow` | CANONICAL | Brand Settings / escrow |

## Creator authenticated

| Path | Class | Authority |
| --- | --- | --- |
| `/creator/home` | CANONICAL shell / DEFERRED product | C-05 workspace entry; C-02A Home not pulled |
| `/creator/dashboard` | LEGACY_ONLY | Redirect → Home |
| `/creator/centre` | OUT_OF_MVP / DEFERRED | Redirect → Home |
| `/creator/analytics` | DEFERRED | Redirect → Home |
| `/creator/media-kit` | DEFERRED | Redirect → Home |
| `/creator/payouts` | OUT (C-06) | Redirect → Settings payouts |
| `/creator/campaigns/opportunities*` | CANONICAL | C-03 |
| `/creator/campaigns/applications*` | CANONICAL | C-03 |
| `/creator/campaigns/history` | LEGACY_ONLY | Redirect → applications |
| `/creator/collaborations` | MIXED | Shared collab workspace mounted; C-04 pack not pulled |
| `/creator/settings/account` | CANONICAL | C-05 |
| `/creator/settings/profile` | CANONICAL | C-05 |
| `/creator/settings/team` | CANONICAL | C-05 |
| `/creator/settings/instagram` | CANONICAL | C-05 |
| `/creator/settings/social` | LEGACY_ONLY | Redirect → Instagram |
| `/creator/settings/payouts` | CANONICAL | C-05 KYC/destination (not C-06) |

## Onboarding

| Path | Class | Authority |
| --- | --- | --- |
| `/` + `/brand/onboarding/*` | CANONICAL | Gatekeeper + Preview |
| `/brand/intelligence/identity-test` | LEGACY_ONLY / test surface | Brand onboarding app; treat as non-MVP unless later accepted |
| `/terms` `/privacy` | CANONICAL placeholders | Legal placeholders |
| `/creator/onboarding` | CANONICAL | C-01 |
| `/creator/onboarding/{modules,signup,connect,sync}` | LEGACY_ONLY | Redirect to landing |
| Instagram callback routes | CANONICAL | C-01 / Settings Instagram |

## Shell navigation (canonical product chrome)

Brand sidebar: Home · Brand Centre · Campaigns · Brand page · Collaborations · Settings  
Brand bottom: Home · Campaigns · Brand Centre · Chat  
Creator sidebar/bottom: Home · Campaigns · Collaborations · Settings  

Creator Center and payout hubs are **not** in nav.
