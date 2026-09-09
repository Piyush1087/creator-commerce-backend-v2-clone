# Frontend route classification

**Repo:** `growth-verse/creator-commerce-frontend-v2`  
**Evidence files:** `src/routes/app-routes.tsx`, `src/routes/brand-onboarding-app.tsx`, `src/routes/creator-onboarding-app.tsx`, `src/layouts/app-shell/sidebar-items.ts`, `src/layouts/app-shell/bottom-nav-items.ts`  
**Freeze branch HEAD (audit):** `1ee13b4c3ab93248bbe8cb79ef8d560277a4802d`  
**Route hide SHA (RUN 1):** `71fe273e9a4d84b868dc7511d606e1109f2d566e`

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
| `/brand/:slug` | CANONICAL | Public brand landing (missing slug → `/`) |

## Brand authenticated

| Path | Class | Authority |
| --- | --- | --- |
| `/brand/dashboard` | CANONICAL | Chat Home / Brand Home V1 |
| `/brand-centre` | CANONICAL | Brand Centre |
| `/brand-centre/offerings` | CANONICAL | PI / Centre offerings |
| `/brand-centre/offerings/:offeringId` | CANONICAL | PI offering detail |
| `/brand/uce/campaigns` | CANONICAL | Brand Campaign / UCE |
| `/brand/uce/campaigns/create` | CANONICAL | UCE create |
| `/brand/uce/campaigns/:id` | CANONICAL | UCE detail |
| `/brand/collaboration-page` | CANONICAL | Brand Collab |
| `/brand/collaborations` | CANONICAL | Brand Collab (also Brand bottom-nav “Chat”) |
| `/brand/payouts` | LEGACY_ONLY | Redirect → Settings billing |
| `/brand/settings` | CANONICAL | index → general |
| `/brand/settings/general` | CANONICAL | Brand Settings |
| `/brand/settings/integrations` | CANONICAL | Brand Settings |
| `/brand/settings/billing` | CANONICAL | Brand Settings / escrow-billing |
| `/brand/settings/escrow` | CANONICAL | Brand Settings / escrow |

## Creator authenticated

| Path | Class | Authority |
| --- | --- | --- |
| `/creator/home` | CANONICAL shell / DEFERRED C-02A product | C-05 `CreatorWorkspaceEntryPage` only. Accepted FE pack `src/features/creator-home` at `29e78397` is **not** in this tree |
| `/creator/dashboard` | LEGACY_ONLY | Redirect → Home |
| `/creator/centre` | OUT_OF_MVP / DEFERRED | Redirect → Home |
| `/creator/analytics` | DEFERRED | Redirect → Home |
| `/creator/media-kit` | DEFERRED | Redirect → Home |
| `/creator/payouts` | OUT (C-06) | Redirect → Settings payouts |
| `/creator/campaigns` | CANONICAL | index → opportunities |
| `/creator/campaigns/opportunities` | CANONICAL | C-03 |
| `/creator/campaigns/opportunities/:campaignId` | CANONICAL | C-03 |
| `/creator/campaigns/applications` | CANONICAL | C-03 |
| `/creator/campaigns/applications/:applicationId` | CANONICAL | C-03 |
| `/creator/campaigns/history` | LEGACY_ONLY | Redirect → applications |
| `/creator/collaborations` | MIXED | Shared collab workspace mounted; C-04 pack not pulled |
| `/creator/settings` | CANONICAL | index → account |
| `/creator/settings/account` | CANONICAL | C-05 |
| `/creator/settings/profile` | CANONICAL | C-05 |
| `/creator/settings/team` | CANONICAL | C-05 |
| `/creator/settings/instagram` | CANONICAL | C-05 |
| `/creator/settings/social` | LEGACY_ONLY | Redirect → Instagram |
| `/creator/settings/payouts` | CANONICAL | C-05 KYC/destination (not C-06) |

## Onboarding and callbacks

| Path | Class | Authority |
| --- | --- | --- |
| `/` | CANONICAL | Gatekeeper landing |
| `/terms` `/privacy` | CANONICAL placeholders | Legal placeholders |
| `/brand/onboarding/scan` | CANONICAL | Preview |
| `/brand/onboarding/core-identity` | CANONICAL | Preview |
| `/brand/onboarding/intelligence-scan` | CANONICAL | Preview / BI |
| `/brand/onboarding/dna` | CANONICAL compat | Resume → scan (do not bypass Preview) |
| `/brand/onboarding/catalogue` | CANONICAL | Preview |
| `/brand/onboarding/competitors` | CANONICAL | Preview |
| `/brand/onboarding/verification` | CANONICAL | Preview |
| `/brand/onboarding/pricing` | CANONICAL | Preview |
| `/brand/onboarding/social-sync` | CANONICAL | Preview |
| `/brand/onboarding/sync-verify` | CANONICAL | Preview |
| `/brand/onboarding/sync-complete` | CANONICAL | Preview |
| `/brand/intelligence/identity-test` | LEGACY_ONLY | Still mounted; non-MVP test surface |
| `/creator/onboarding` | CANONICAL | C-01 landing |
| `/creator/onboarding/{modules,signup,connect,sync}` | LEGACY_ONLY | Redirect to landing |
| `/creator-marketplace/callback` | CANONICAL | C-01 Instagram OAuth (name is leftover) |
| `/integrate-instagram` | CANONICAL | C-01 legacy Instagram callback |
| `/help` | CANONICAL placeholder | Authenticated `HelpPage` (Brand Support / Creator Help) |

## Shell navigation (canonical product chrome)

Brand sidebar: Home · Brand Centre · Campaigns · Brand page · Collaborations · Settings  
Brand bottom: Home · Campaigns · Brand Centre · Chat (`/brand/collaborations`)  
Creator sidebar/bottom: Home · Campaigns · Collaborations · Settings  

Creator Center and payout hubs are **not** in nav. `/help` is mounted as a freeze placeholder from Brand Support and Creator Help.
