# Backend module and API classification

**Repo:** `growth-verse/creator-commerce-backend-v2`  
**Evidence:** `src/app.module.ts` + `@Controller` declarations  
**Freeze branch evidence SHA (RUN 1):** `13a1dedc0ead8eef24a27c48067364258119b0fc`

## AppModule imports

| Module | Class | Notes |
| --- | --- | --- |
| `AuthModule` | CANONICAL | Shared auth |
| `PrismaModule` `HealthModule` `S3Module` | INFRA | |
| `DataExtractionModule` | INFRA / CANONICAL consumer | Required by Brand Intelligence / Centre |
| `BrandOnboardingModule` | CANONICAL | Gatekeeper + Preview |
| `BrandIntelligenceModule` | CANONICAL | BI P1 |
| `BrandCentreModule` `BrandCentreUceBridgeModule` | CANONICAL | |
| `IntelligenceConsumerModule` | CANONICAL | PI |
| `BrandUceModule` `CampaignOpportunityModule` `CampaignApplicationsModule` | CANONICAL | UCE + C-03 |
| `BrandEscrowModule` | CANONICAL | Settings escrow; not Brand Payouts v1 |
| `BrandHomeModule` `ChatModule` | CANONICAL | Chat Home |
| `BrandSettingsModule` `PricingModule` | CANONICAL | |
| `NotificationsModule` | INFRA | |
| `CollaborationModule` | CANONICAL Brand + MIXED Creator | C-04 pack not pulled |
| `CreatorEntryModule` `CreatorOnboardingModule` | CANONICAL | C-01 |
| `CreatorSettingsModule` | CANONICAL | C-05 |
| `CreatorUceModule` | CANONICAL | C-03 / campaign participation |
| `CreatorMarketplaceModule` | MIXED | C-03 helpers retained; public marketplace OUT |
| `PublicBrandModule` | CANONICAL | |
| `PublicCreatorModule` | LEGACY_ONLY / review | Confirm not a Marketplace re-entry |
| `InstagramModule` | CANONICAL provider | Fail-closed without credentials |
| `BrandPayoutsModule` | LEGACY_ONLY | Old hub; not accepted Brand Payouts v1 |
| `CreatorPayoutsModule` | OUT (C-06) | Still imported |
| `CoPilotModule` `CreatorCoPilotModule` | OUT_OF_MVP | Still imported |
| `CreatorCentreModule` | DEFERRED / OUT | Still imported |

## HTTP controllers (selected)

| Controller prefix | Class |
| --- | --- |
| `health` `health/live` | INFRA |
| `api/v1/auth` | CANONICAL |
| `api/v1/discovery` `api/v1/brand` `api/v1/brand/social-sync` | CANONICAL onboarding |
| `api/v1/brand/home` `api/v1/chat/conversations` | CANONICAL |
| `api/v1/brand-centre` `api/v1/orchestration` | CANONICAL |
| `api/v1/brand-uce` | CANONICAL |
| `api/v1/campaign-opportunities` `api/v1/creator/campaigns` `api/v1/creator` applications | CANONICAL C-03 |
| `api/v1/collaboration` | CANONICAL Brand; Creator C-04 deferred |
| `api/v1/brand/settings` `api/v1/brand/team-invitations` `api/v1/pricing` `api/v1/escrow*` | CANONICAL |
| `api/v1/creator-entry` `api/v1/creator-onboarding` `api/v1/instagram` | CANONICAL C-01 |
| `api/v1/creator/settings*` `api/v1/creator/workspace` `api/v1/creator/team-invitations` | CANONICAL C-05 |
| `api/v1/creator/notifications` `api/v1/brand/notifications` | INFRA |
| `api/v1/webhooks/*` | CANONICAL fail-closed | Razorpay/subscription webhooks |
| `api/v1/public/marketplace` `api/v1/creator/marketplace` | OUT_OF_MVP / C-03 mixed |
| `api/v1/co-pilot` `api/v1/creator/co-pilot` | OUT_OF_MVP |
| `api/v1/creator-centre` | DEFERRED |
| `api/v1/brand/payouts` | LEGACY_ONLY |
| `api/v1/creator/payouts` | OUT (C-06) |
| `api/v1/meta/instagram/data-deletion` | PROVIDER / CANONICAL compliance |

Hiding the frontend does **not** unwire these APIs. Later freeze amendment may remove OUT modules from `AppModule`. Not done in RUN 1 (Prisma drop forbidden that checkpoint).
