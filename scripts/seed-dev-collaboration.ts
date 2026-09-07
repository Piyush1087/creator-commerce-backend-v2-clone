/**
 * Seed a deterministic local Collaboration acceptance fixture.
 *
 * Usage (from backend-v2 root, with a localhost DATABASE_URL):
 *   npm run db:seed:dev-collaboration
 *
 * This intentionally bypasses the unfinished Campaign pipeline UI. It creates
 * the minimum canonical Application graph required by Collaboration reads,
 * then creates one fresh ACTIVE Negotiation Collaboration for messaging and
 * interaction acceptance.
 *
 * Re-running the script resets only this fixture's Collaboration and children.
 * Login for both accounts uses password or email OTP (code is logged by the API in non-prod).
 */
import {
  CollaborationActorClass,
  CollaborationEventKind,
  CollaborationFulfillmentState,
  CollaborationIndustryType,
  CollaborationLifecycle,
  CollaborationMessageKind,
  CollaborationNegotiationState,
  CollaborationPaymentRail,
  CollaborationPayoutMode,
  CollaborationPublicationAuthorizationState,
  CollaborationPublishingState,
  CollaborationStage,
  CollaborationStageStatus,
  IndustryVertical,
  Prisma,
  PrismaClient,
  SubscriptionCurrency,
  SubscriptionStatus,
  SubscriptionTier,
  UceApplicationSource,
  UceApplicationStatus,
  UceCampaignCreatorIngestionMethod,
  UceCampaignCreatorReviewState,
  UceCampaignCreatorSource,
  UceCampaignStatus,
  UceCompensationType,
  UceMediaPlatform,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

const BRAND_EMAIL = "test1@brand.com";
const CREATOR_EMAIL = "test1@creator.com";
const BRAND_DOMAIN = "test1-brand.local";
const CREATOR_HANDLE = "test1_creator";
const APPLICATION_REQUEST_ID = "local-acceptance:test1-collaboration";

const IDS = {
  organization: "11111111-1111-4111-8111-111111111101",
  campaign: "11111111-1111-4111-8111-111111111102",
  product: "11111111-1111-4111-8111-111111111103",
  brief: "11111111-1111-4111-8111-111111111104",
  briefDeliverable: "11111111-1111-4111-8111-111111111105",
} as const;

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

function assertLocalDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is required.");
  }

  const hostname = new URL(raw).hostname.toLowerCase();
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    throw new Error(
      `Refusing to seed non-local database host "${hostname}". Use a localhost DATABASE_URL.`,
    );
  }
}

async function assertCompatibleExistingUser(
  prisma: PrismaClient,
  email: string,
  expectedRole: UserRole,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== expectedRole) {
    throw new Error(
      `${email} exists with role ${existing.role}; expected ${expectedRole}.`,
    );
  }
}

async function main() {
  assertLocalDatabase();
  const prisma = new PrismaClient();

  try {
    await assertCompatibleExistingUser(prisma, BRAND_EMAIL, UserRole.BRAND);
    await assertCompatibleExistingUser(prisma, CREATOR_EMAIL, UserRole.CREATOR);

    const fixture = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.upsert({
        where: { id: IDS.organization },
        update: { name: "Test One Brand" },
        create: {
          id: IDS.organization,
          name: "Test One Brand",
        },
      });

      const brandUser = await tx.user.upsert({
        where: { email: BRAND_EMAIL },
        update: {
          name: "Test One Brand",
          organizationId: organization.id,
        },
        create: {
          email: BRAND_EMAIL,
          name: "Test One Brand",
          role: UserRole.BRAND,
          organizationId: organization.id,
          emailVerifiedAt: new Date(),
        },
      });

      const brandProfile = await tx.brandProfile.upsert({
        where: { domain: BRAND_DOMAIN },
        update: {
          organizationId: organization.id,
          name: "Test One Brand",
          industry: IndustryVertical.D2C,
          countryCode: "IN",
          currencyCode: "INR",
          isVerified: true,
          verificationEmail: BRAND_EMAIL,
        },
        create: {
          organizationId: organization.id,
          domain: BRAND_DOMAIN,
          name: "Test One Brand",
          industry: IndustryVertical.D2C,
          brandValues: ["LOCAL_ACCEPTANCE"],
          policyFlags: [],
          countryCode: "IN",
          currencyCode: "INR",
          isVerified: true,
          verifiedAt: new Date(),
          verificationEmail: BRAND_EMAIL,
          identityConfirmedAt: new Date(),
        },
      });

      const subscriptionPeriodEnd = new Date();
      subscriptionPeriodEnd.setFullYear(
        subscriptionPeriodEnd.getFullYear() + 1,
      );
      await tx.brandSubscription.upsert({
        where: { brandProfileId: brandProfile.id },
        update: {
          tier: SubscriptionTier.FOUNDERS_BETA,
          status: SubscriptionStatus.ACTIVE,
          currency: SubscriptionCurrency.INR,
          currentPeriodEnd: subscriptionPeriodEnd,
        },
        create: {
          brandProfileId: brandProfile.id,
          tier: SubscriptionTier.FOUNDERS_BETA,
          status: SubscriptionStatus.ACTIVE,
          currency: SubscriptionCurrency.INR,
          currentPeriodEnd: subscriptionPeriodEnd,
        },
      });

      const creatorUser = await tx.user.upsert({
        where: { email: CREATOR_EMAIL },
        update: { name: "Test One Creator" },
        create: {
          email: CREATOR_EMAIL,
          name: "Test One Creator",
          role: UserRole.CREATOR,
          emailVerifiedAt: new Date(),
        },
      });

      const creatorProfile = await tx.creatorProfile.upsert({
        where: { userId: creatorUser.id },
        update: {
          displayName: "Test One Creator",
          instagramHandle: CREATOR_HANDLE,
          primaryRegion: "IN",
          followerCount: 25_000,
          audienceDemographicsMatrix: json({
            top_countries: { IN: 0.8 },
            age_distribution: { "18-24": 0.4, "25-34": 0.6 },
          }),
        },
        create: {
          userId: creatorUser.id,
          displayName: "Test One Creator",
          instagramHandle: CREATOR_HANDLE,
          primaryRegion: "IN",
          followerCount: 25_000,
          audienceDemographicsMatrix: json({
            top_countries: { IN: 0.8 },
            age_distribution: { "18-24": 0.4, "25-34": 0.6 },
          }),
        },
      });

      const campaign = await tx.uceCampaign.upsert({
        where: { id: IDS.campaign },
        update: {
          brandProfileId: brandProfile.id,
          name: "Local Collaboration Acceptance Campaign",
          status: UceCampaignStatus.LIVE,
        },
        create: {
          id: IDS.campaign,
          brandProfileId: brandProfile.id,
          name: "Local Collaboration Acceptance Campaign",
          status: UceCampaignStatus.LIVE,
        },
      });

      const product = await tx.uceCampaignProduct.upsert({
        where: { id: IDS.product },
        update: {
          campaignId: campaign.id,
          productName: "Acceptance Product",
          skuCode: "LOCAL-ACCEPTANCE-001",
          isActive: true,
          inventoryCount: 10,
          costPerUnit: 2_500,
        },
        create: {
          id: IDS.product,
          campaignId: campaign.id,
          productName: "Acceptance Product",
          skuCode: "LOCAL-ACCEPTANCE-001",
          isActive: true,
          inventoryCount: 10,
          costPerUnit: 2_500,
          assetPayload: json({ fixture: true }),
        },
      });

      const brief = await tx.uceCampaignBrief.upsert({
        where: { id: IDS.brief },
        update: {
          campaignId: campaign.id,
          productId: product.id,
          internalTitle: "Local acceptance short-form video",
          creativeGuidelines:
            "Create one short-form product video for local acceptance testing.",
          requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
          deliverableFormatTags: ["SHORT_FORM_VIDEO"],
        },
        create: {
          id: IDS.brief,
          campaignId: campaign.id,
          productId: product.id,
          internalTitle: "Local acceptance short-form video",
          creativeGuidelines:
            "Create one short-form product video for local acceptance testing.",
          requiredPlatforms: [UceMediaPlatform.INSTAGRAM],
          deliverableFormatTags: ["SHORT_FORM_VIDEO"],
        },
      });

      const briefDeliverable = await tx.uceBriefDeliverable.upsert({
        where: { id: IDS.briefDeliverable },
        update: {
          briefId: brief.id,
          format: "SHORT_FORM_VIDEO",
          displayOrder: 0,
          configuration: json({ fixture: true }),
        },
        create: {
          id: IDS.briefDeliverable,
          briefId: brief.id,
          format: "SHORT_FORM_VIDEO",
          displayOrder: 0,
          configuration: json({ fixture: true }),
        },
      });

      const commercials = await tx.uceCampaignCommercials.upsert({
        where: { campaignId: campaign.id },
        update: {
          compensationType: UceCompensationType.NEGOTIABLE,
          negotiableMinFee: 10_000,
          negotiableMaxFee: 20_000,
          totalCampaignBudgetPool: 100_000,
          advancePaymentPercentage: 30,
          receivesBrandSupport: false,
          currency: "INR",
        },
        create: {
          campaignId: campaign.id,
          compensationType: UceCompensationType.NEGOTIABLE,
          negotiableMinFee: 10_000,
          negotiableMaxFee: 20_000,
          totalCampaignBudgetPool: 100_000,
          advancePaymentPercentage: 30,
          receivesBrandSupport: false,
          currency: "INR",
        },
      });

      const campaignCreator = await tx.uceCampaignCreator.upsert({
        where: {
          campaignId_platform_normalizedSocialHandle: {
            campaignId: campaign.id,
            platform: UceMediaPlatform.INSTAGRAM,
            normalizedSocialHandle: CREATOR_HANDLE,
          },
        },
        update: {
          creatorProfileId: creatorProfile.id,
          creatorUserId: creatorUser.id,
          email: CREATOR_EMAIL,
          reviewState: UceCampaignCreatorReviewState.REVIEWED,
        },
        create: {
          campaignId: campaign.id,
          creatorProfileId: creatorProfile.id,
          creatorUserId: creatorUser.id,
          platform: UceMediaPlatform.INSTAGRAM,
          socialHandle: CREATOR_HANDLE,
          normalizedSocialHandle: CREATOR_HANDLE,
          email: CREATOR_EMAIL,
          source: UceCampaignCreatorSource.MANUAL,
          ingestionMethod: UceCampaignCreatorIngestionMethod.MANUAL_SINGLE,
          reviewState: UceCampaignCreatorReviewState.REVIEWED,
        },
      });

      const application = await tx.uceApplication.upsert({
        where: { requestId: APPLICATION_REQUEST_ID },
        update: {
          campaignId: campaign.id,
          campaignCreatorId: campaignCreator.id,
          campaignAssetId: product.id,
          briefId: brief.id,
          status: UceApplicationStatus.APPROVED,
          source: UceApplicationSource.DIRECT,
          proposedFee: 15_000,
          approvedAt: new Date(),
        },
        create: {
          requestId: APPLICATION_REQUEST_ID,
          campaignId: campaign.id,
          campaignCreatorId: campaignCreator.id,
          campaignAssetId: product.id,
          briefId: brief.id,
          status: UceApplicationStatus.APPROVED,
          source: UceApplicationSource.DIRECT,
          proposedFee: 15_000,
          approvedAt: new Date(),
        },
      });

      await tx.uceApplicationSnapshot.upsert({
        where: { applicationId: application.id },
        update: {
          campaignContext: json({ id: campaign.id, name: campaign.name }),
          campaignAssetContext: json({
            id: product.id,
            productName: product.productName,
          }),
          briefContext: json({
            id: brief.id,
            internalTitle: brief.internalTitle,
          }),
          commercialContext: json({
            proposedFee: 15_000,
            currency: commercials.currency,
          }),
          creatorIdentity: json({
            userId: creatorUser.id,
            email: creatorUser.email,
            instagramHandle: CREATOR_HANDLE,
          }),
        },
        create: {
          applicationId: application.id,
          campaignContext: json({ id: campaign.id, name: campaign.name }),
          campaignAssetContext: json({
            id: product.id,
            productName: product.productName,
          }),
          briefContext: json({
            id: brief.id,
            internalTitle: brief.internalTitle,
          }),
          commercialContext: json({
            proposedFee: 15_000,
            currency: commercials.currency,
          }),
          creatorIdentity: json({
            userId: creatorUser.id,
            email: creatorUser.email,
            instagramHandle: CREATOR_HANDLE,
          }),
        },
      });

      await tx.collaboration.deleteMany({
        where: { sourceApplicationId: application.id },
      });

      const welcome =
        "Local acceptance fixture is active. Brand and Creator can message each other.";
      const collaboration = await tx.collaboration.create({
        data: {
          sourceApplicationId: application.id,
          campaignCreatorId: campaignCreator.id,
          campaignAssetId: product.id,
          brandProfileId: brandProfile.id,
          creatorUserId: creatorUser.id,
          campaignId: campaign.id,
          briefId: brief.id,
          productId: product.id,
          lifecycle: CollaborationLifecycle.ACTIVE,
          canonicalStage: CollaborationStage.NEGOTIATION,
          currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
          currentStage: UceMilestoneStage.STAGE_1_NEGOTIATION,
          payoutMode: CollaborationPayoutMode.ESCROW,
          industry: CollaborationIndustryType.D2C_ECOMMERCE,
          unreadCountCreator: 1,
          lastMessageSnippet: welcome,
          lastMessageAt: new Date(),
          snapshot: {
            create: {
              campaignContext: json({
                id: campaign.id,
                name: campaign.name,
              }),
              campaignAssetContext: json({
                id: product.id,
                productName: product.productName,
              }),
              briefContext: json({
                id: brief.id,
                internalTitle: brief.internalTitle,
              }),
              applicationContext: json({
                id: application.id,
                proposedFee: 15_000,
              }),
              creatorContext: json({
                id: creatorUser.id,
                email: creatorUser.email,
                instagramHandle: CREATOR_HANDLE,
              }),
              brandContext: json({
                id: brandProfile.id,
                name: brandProfile.name,
              }),
              receivesBrandSupport: false,
              campaignCommercialContext: json({
                compensationType: commercials.compensationType,
                currency: commercials.currency,
              }),
              advancePercentageSnapshot: 30,
              commercialCurrency: "INR",
            },
          },
          commercialAgreement: {
            create: {
              negotiationState:
                CollaborationNegotiationState.AWAITING_BRAND_DECISION,
              applicationProposedFee: 15_000,
              currency: "INR",
              advancePercentageSnapshot: 30,
              paymentRail: CollaborationPaymentRail.PLATFORM_ESCROW,
            },
          },
          fulfillment: {
            create: { state: CollaborationFulfillmentState.SKIPPED },
          },
          deliverables: {
            create: {
              sourceBriefDeliverableId: briefDeliverable.id,
              displayOrder: 0,
              definitionSnapshot: json({
                id: briefDeliverable.id,
                format: briefDeliverable.format,
              }),
              publishingRequired: false,
              publishing: {
                create: {
                  state: CollaborationPublishingState.PUBLISHING_NOT_REQUIRED,
                  authorizationState:
                    CollaborationPublicationAuthorizationState.NOT_REQUIRED,
                },
              },
            },
          },
          commercials: { create: {} },
          logistics: { create: {} },
          finalization: { create: {} },
          messages: {
            create: {
              kind: CollaborationMessageKind.SYSTEM,
              systemEventTag: "LOCAL_ACCEPTANCE_FIXTURE_CREATED",
              body: welcome,
            },
          },
          events: {
            create: {
              kind: CollaborationEventKind.DOMAIN,
              eventType: "COLLABORATION_PROVISIONED",
              actorClass: CollaborationActorClass.SYSTEM,
              commandId: "local-acceptance:provision",
              aggregateVersion: 1,
              payload: json({
                sourceApplicationId: application.id,
                fixture: true,
              }),
            },
          },
        },
      });

      return {
        brandUser,
        creatorUser,
        application,
        collaboration,
      };
    });

    console.log("");
    console.log("Local Collaboration acceptance fixture ready.");
    console.log(`  Brand:         ${fixture.brandUser.email}`);
    console.log(`  Creator:       ${fixture.creatorUser.email}`);
    console.log("  OTP:           check the API log in non-prod ([OTP] ...)");
    console.log(`  Application:   ${fixture.application.id} (APPROVED)`);
    console.log(`  Collaboration: ${fixture.collaboration.id} (ACTIVE)`);
    console.log("  Stage:         NEGOTIATION");
    console.log("  Messaging:     enabled for Brand and Creator");
    console.log("");
    console.log(
      "Re-running this command resets only this fixture Collaboration and its child records.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
