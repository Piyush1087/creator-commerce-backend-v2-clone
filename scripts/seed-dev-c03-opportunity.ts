/**
 * Seed a local C-03 Opportunity smoke fixture (Brand + LIVE campaign + Creator).
 *
 * Usage (backend-v2 root, localhost DATABASE_URL only):
 *   npm run db:seed:dev-c03-opportunity
 *
 * Creates an ELIGIBLE_ONLY LIVE campaign with a PUBLISHED Brief so it appears in
 * `/creator/campaigns/opportunities` without a prior public ingress visit.
 *
 * Login: OTP (non-prod logs `[OTP]`) or existing password if you set one.
 */
import {
  CreatorTeamRole,
  OAuthTokenStatus,
  OrganizationKind,
  Prisma,
  PrismaClient,
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
  SocialNetworkProvider,
  UceApplicationScope,
  UceBriefStatus,
  UceCampaignAssetKind,
  UceCampaignAssetStatus,
  UceCampaignStatus,
  UceCompensationType,
  UceVisibilityScope,
  UserAuthState,
  UserRole,
} from "@prisma/client";

const CREATOR_EMAIL = process.env.C03_SMOKE_CREATOR_EMAIL ?? "c03-smoke@creator.com";
const BRAND_EMAIL = process.env.C03_SMOKE_BRAND_EMAIL ?? "c03-smoke@brand.com";
const BRAND_DOMAIN = "c03-smoke-brand.local";
const CAMPAIGN_NAME = "C-03 Local Smoke Opportunity";

const IDS = {
  brandOrg: "22222222-2222-4222-8222-222222222201",
  creatorOrg: "22222222-2222-4222-8222-222222222202",
  campaign: "22222222-2222-4222-8222-222222222203",
  asset: "22222222-2222-4222-8222-222222222204",
  brief: "22222222-2222-4222-8222-222222222205",
  deliverable0: "22222222-2222-4222-8222-222222222206",
  deliverable1: "22222222-2222-4222-8222-222222222207",
  workspace: "22222222-2222-4222-8222-222222222208",
  membership: "22222222-2222-4222-8222-222222222209",
  integration: "22222222-2222-4222-8222-222222222210",
} as const;

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is required.");
  const hostname = new URL(raw).hostname.toLowerCase();
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(
      `Refusing to seed non-local database host "${hostname}". Use localhost DATABASE_URL.`,
    );
  }
}

async function main() {
  assertLocalDatabase();
  const prisma = new PrismaClient();

  try {
    const existingCreator = await prisma.user.findUnique({
      where: { email: CREATOR_EMAIL },
    });
    if (existingCreator && existingCreator.role !== UserRole.CREATOR) {
      throw new Error(
        `${CREATOR_EMAIL} exists as ${existingCreator.role}; pick another C03_SMOKE_CREATOR_EMAIL.`,
      );
    }
    const existingBrand = await prisma.user.findUnique({
      where: { email: BRAND_EMAIL },
    });
    if (existingBrand && existingBrand.role !== UserRole.BRAND) {
      throw new Error(
        `${BRAND_EMAIL} exists as ${existingBrand.role}; pick another C03_SMOKE_BRAND_EMAIL.`,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const brandOrg = await tx.organization.upsert({
        where: { id: IDS.brandOrg },
        update: { name: "C-03 Smoke Brand Org", kind: OrganizationKind.BRAND },
        create: {
          id: IDS.brandOrg,
          name: "C-03 Smoke Brand Org",
          kind: OrganizationKind.BRAND,
        },
      });

      const brandUser = await tx.user.upsert({
        where: { email: BRAND_EMAIL },
        update: {
          name: "C-03 Smoke Brand",
          organizationId: brandOrg.id,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        create: {
          email: BRAND_EMAIL,
          name: "C-03 Smoke Brand",
          role: UserRole.BRAND,
          organizationId: brandOrg.id,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const brandProfile = await tx.brandProfile.upsert({
        where: { domain: BRAND_DOMAIN },
        update: {
          organizationId: brandOrg.id,
          name: "C-03 Smoke Brand",
          industry: "D2C",
        },
        create: {
          organizationId: brandOrg.id,
          domain: BRAND_DOMAIN,
          name: "C-03 Smoke Brand",
          industry: "D2C",
          brandValues: ["C03_SMOKE"],
          policyFlags: [],
          countryCode: "IN",
          currencyCode: "INR",
          isVerified: true,
          verifiedAt: new Date(),
          verificationEmail: BRAND_EMAIL,
          identityConfirmedAt: new Date(),
        },
      });

      await tx.brandTeamMember.upsert({
        where: {
          brandProfileId_userId: {
            brandProfileId: brandProfile.id,
            userId: brandUser.id,
          },
        },
        update: { role: "BRAND_OWNER", isActive: true },
        create: {
          brandProfileId: brandProfile.id,
          userId: brandUser.id,
          role: "BRAND_OWNER",
          isActive: true,
        },
      });

      const creatorOrg = await tx.organization.upsert({
        where: { id: IDS.creatorOrg },
        update: {
          name: "C-03 Smoke Creator Org",
          kind: OrganizationKind.CREATOR,
        },
        create: {
          id: IDS.creatorOrg,
          name: "C-03 Smoke Creator Org",
          kind: OrganizationKind.CREATOR,
        },
      });

      const creatorUser = await tx.user.upsert({
        where: { email: CREATOR_EMAIL },
        update: {
          name: "C-03 Smoke Creator",
          organizationId: creatorOrg.id,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        create: {
          email: CREATOR_EMAIL,
          name: "C-03 Smoke Creator",
          role: UserRole.CREATOR,
          organizationId: creatorOrg.id,
          authState: UserAuthState.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const creatorProfile = await tx.creatorProfile.upsert({
        where: { userId: creatorUser.id },
        update: {
          displayName: "C-03 Smoke Creator",
          instagramHandle: "c03_smoke_creator",
          primaryRegion: "IN",
          followerCount: 45_000,
          audienceDemographicsMatrix: json({
            top_countries: { IN: 0.8, US: 0.2 },
            age_distribution: { "18-24": 0.4, "25-34": 0.6 },
            gender_skew: { female: 0.55, male: 0.45 },
          }),
        },
        create: {
          userId: creatorUser.id,
          displayName: "C-03 Smoke Creator",
          instagramHandle: "c03_smoke_creator",
          primaryRegion: "IN",
          followerCount: 45_000,
          audienceDemographicsMatrix: json({
            top_countries: { IN: 0.8, US: 0.2 },
            age_distribution: { "18-24": 0.4, "25-34": 0.6 },
            gender_skew: { female: 0.55, male: 0.45 },
          }),
        },
      });

      const workspace = await tx.creatorWorkspace.upsert({
        where: { id: IDS.workspace },
        update: {
          ownerProfileId: creatorProfile.id,
          organizationId: creatorOrg.id,
        },
        create: {
          id: IDS.workspace,
          ownerProfileId: creatorProfile.id,
          organizationId: creatorOrg.id,
        },
      });

      await tx.creatorWorkspaceMember.upsert({
        where: { id: IDS.membership },
        update: {
          workspaceId: workspace.id,
          userId: creatorUser.id,
          assignedProfileId: creatorProfile.id,
          associatedEmail: CREATOR_EMAIL,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
        create: {
          id: IDS.membership,
          workspaceId: workspace.id,
          userId: creatorUser.id,
          assignedProfileId: creatorProfile.id,
          associatedEmail: CREATOR_EMAIL,
          securityRole: CreatorTeamRole.OWNER,
          isActive: true,
          joinedAt: new Date(),
        },
      });

      await tx.creatorSocialIntegration.upsert({
        where: { id: IDS.integration },
        update: {
          creatorProfileId: creatorProfile.id,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
          nativePlatformUserId: "c03-smoke-ig-user",
          channelHandleString: "c03_smoke_creator",
          oauthAccessTokenEncrypted: "c03-smoke-unused-token",
          tokenStateCondition: OAuthTokenStatus.ACTIVE,
          tokenExpiresAt: new Date(Date.now() + 86400000 * 30),
          authorizationHealth: ProviderAuthorizationHealth.USABLE,
          basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
        },
        create: {
          id: IDS.integration,
          creatorProfileId: creatorProfile.id,
          platformNetwork: SocialNetworkProvider.INSTAGRAM,
          nativePlatformUserId: "c03-smoke-ig-user",
          channelHandleString: "c03_smoke_creator",
          oauthAccessTokenEncrypted: "c03-smoke-unused-token",
          tokenStateCondition: OAuthTokenStatus.ACTIVE,
          tokenExpiresAt: new Date(Date.now() + 86400000 * 30),
          authorizationHealth: ProviderAuthorizationHealth.USABLE,
          basicAuthorizationCapability: ProviderCapabilityState.AVAILABLE,
        },
      });

      const campaign = await tx.uceCampaign.upsert({
        where: { id: IDS.campaign },
        update: {
          brandProfileId: brandProfile.id,
          name: CAMPAIGN_NAME,
          status: UceCampaignStatus.LIVE,
          canonicalDefinition: json({
            version: "1.2",
            creationSource: "MANUAL",
            strategy: {
              platforms: ["INSTAGRAM"],
              campaign_visibility: "ELIGIBLE",
            },
            targeting: {},
            commercials: {
              compensation_model: "FIXED",
              commercial_offer: 15000,
              total_campaign_budget: 150000,
              receives_brand_support: false,
            },
            derived: { currency: "INR" },
          }),
        },
        create: {
          id: IDS.campaign,
          brandProfileId: brandProfile.id,
          name: CAMPAIGN_NAME,
          status: UceCampaignStatus.LIVE,
          canonicalDefinition: json({
            version: "1.2",
            creationSource: "MANUAL",
            strategy: {
              platforms: ["INSTAGRAM"],
              campaign_visibility: "ELIGIBLE",
            },
            targeting: {},
            commercials: {
              compensation_model: "FIXED",
              commercial_offer: 15000,
              total_campaign_budget: 150000,
              receives_brand_support: false,
            },
            derived: { currency: "INR" },
          }),
        },
      });

      await tx.uceCampaignTargeting.upsert({
        where: { campaignId: campaign.id },
        update: {
          industryVertical: "D2C",
          visibilityScope: UceVisibilityScope.ELIGIBLE_ONLY,
          visibilityScopes: [UceVisibilityScope.ELIGIBLE_ONLY],
          applicationScope: UceApplicationScope.EVERYONE,
          followerTiers: [],
          creatorArchetypes: [],
          disqualifyingKeywords: [],
          targetLocations: [],
          audienceAgeMin: 18,
          audienceAgeMax: 65,
          audienceGender: "ALL",
          targetingVersion: 1,
        },
        create: {
          campaignId: campaign.id,
          industryVertical: "D2C",
          visibilityScope: UceVisibilityScope.ELIGIBLE_ONLY,
          visibilityScopes: [UceVisibilityScope.ELIGIBLE_ONLY],
          applicationScope: UceApplicationScope.EVERYONE,
          followerTiers: [],
          creatorArchetypes: [],
          disqualifyingKeywords: [],
          targetLocations: [],
          audienceAgeMin: 18,
          audienceAgeMax: 65,
          audienceGender: "ALL",
          targetingVersion: 1,
        },
      });

      await tx.uceCampaignCommercials.upsert({
        where: { campaignId: campaign.id },
        update: {
          compensationType: UceCompensationType.FIXED_FEE,
          commercialOffer: 15_000,
          fixedFeeAmount: 15_000,
          totalCampaignBudgetPool: 150_000,
          currency: "INR",
          receivesBrandSupport: false,
          canonicalVersion: 1,
          advancePaymentPercentage: 30,
        },
        create: {
          campaignId: campaign.id,
          compensationType: UceCompensationType.FIXED_FEE,
          commercialOffer: 15_000,
          fixedFeeAmount: 15_000,
          totalCampaignBudgetPool: 150_000,
          currency: "INR",
          receivesBrandSupport: false,
          canonicalVersion: 1,
          advancePaymentPercentage: 30,
        },
      });

      const asset = await tx.uceCampaignAsset.upsert({
        where: { id: IDS.asset },
        update: {
          campaignId: campaign.id,
          kind: UceCampaignAssetKind.BRAND,
          brandProfileId: brandProfile.id,
          status: UceCampaignAssetStatus.ACTIVE,
        },
        create: {
          id: IDS.asset,
          campaignId: campaign.id,
          kind: UceCampaignAssetKind.BRAND,
          brandProfileId: brandProfile.id,
          status: UceCampaignAssetStatus.ACTIVE,
        },
      });

      const brief = await tx.canonicalCampaignBrief.upsert({
        where: { id: IDS.brief },
        update: {
          campaignAssetId: asset.id,
          status: UceBriefStatus.PUBLISHED,
          briefName: "C-03 Smoke Brief",
          creativeIntent: "Show a clear everyday product moment",
          creatorBrief: "Film one Instagram Reel in natural light.",
          briefType: "CREATOR_LED",
          platform: "INSTAGRAM",
        },
        create: {
          id: IDS.brief,
          campaignAssetId: asset.id,
          status: UceBriefStatus.PUBLISHED,
          briefName: "C-03 Smoke Brief",
          creativeIntent: "Show a clear everyday product moment",
          creatorBrief: "Film one Instagram Reel in natural light.",
          briefType: "CREATOR_LED",
          platform: "INSTAGRAM",
        },
      });

      await tx.canonicalBriefDeliverable.upsert({
        where: { id: IDS.deliverable0 },
        update: {
          briefId: brief.id,
          format: "REEL_VIDEO",
          displayOrder: 0,
        },
        create: {
          id: IDS.deliverable0,
          briefId: brief.id,
          format: "REEL_VIDEO",
          displayOrder: 0,
        },
      });
      await tx.canonicalBriefDeliverable.upsert({
        where: { id: IDS.deliverable1 },
        update: {
          briefId: brief.id,
          format: "REEL_VIDEO",
          displayOrder: 1,
        },
        create: {
          id: IDS.deliverable1,
          briefId: brief.id,
          format: "REEL_VIDEO",
          displayOrder: 1,
        },
      });

      return {
        campaignId: campaign.id,
        briefId: brief.id,
        assetId: asset.id,
        creatorEmail: CREATOR_EMAIL,
        brandEmail: BRAND_EMAIL,
        brandProfileId: brandProfile.id,
        workspaceId: workspace.id,
        creatorProfileId: creatorProfile.id,
      };
    });

    console.log("");
    console.log("C-03 opportunity seed complete.");
    console.log(`  Creator login:  ${result.creatorEmail}`);
    console.log(`  Brand login:    ${result.brandEmail}`);
    console.log(`  Campaign id:    ${result.campaignId}`);
    console.log(`  Brief id:       ${result.briefId}`);
    console.log("");
    console.log("Check steps:");
    console.log("  1. BE npm run start:dev  |  FE npm run dev");
    console.log(`  2. Login as Creator ${result.creatorEmail} (OTP in BE log)`);
    console.log("  3. Open /creator/campaigns/opportunities → Refresh");
    console.log(`  4. Open /creator/campaigns/opportunities/${result.campaignId}`);
    console.log("  5. Apply to Brief → Applications → Brief Pack / Withdraw");
    console.log(`  6. Public URL also: /campaigns/${result.campaignId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
