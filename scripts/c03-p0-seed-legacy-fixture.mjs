import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
const parsedDatabaseUrl = databaseUrl ? new URL(databaseUrl) : null;
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

if (
  !parsedDatabaseUrl ||
  !allowedHosts.has(parsedDatabaseUrl.hostname) ||
  parsedDatabaseUrl.pathname !== "/c03_p0_legacy"
) {
  throw new Error("C03_P0_LEGACY_FIXTURE_REQUIRES_DISPOSABLE_DATABASE");
}

const prisma = new PrismaClient();

const ids = {
  brand: "c0300000-0000-4000-8000-000000000001",
  campaign: "c0300000-0000-4000-8000-000000000002",
  product: "c0300000-0000-4000-8000-000000000003",
  brief: "c0300000-0000-4000-8000-000000000004",
  campaignCreator: "c0300000-0000-4000-8000-000000000005",
  application: "c0300000-0000-4000-8000-000000000006",
  snapshot: "c0300000-0000-4000-8000-000000000007",
  collaboration: "c0300000-0000-4000-8000-000000000008",
};

try {
  await prisma.$transaction(async (tx) => {
    await tx.brandProfile.create({
      data: {
        id: ids.brand,
        domain: "c03-p0-legacy.example.test",
        name: "C03 P0 Legacy Fixture Brand",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });

    await tx.uceCampaign.create({
      data: {
        id: ids.campaign,
        brandProfileId: ids.brand,
        name: "C03 P0 Legacy Fixture Campaign",
        status: "LIVE",
        targeting: {
          create: {
            industryVertical: "D2C",
            visibilityScopes: ["EVERYONE", "ELIGIBLE_ONLY"],
            applicationScope: "BLENDED_SMART_FUNNEL",
          },
        },
        commercials: {
          create: {
            compensationType: "NEGOTIABLE",
            fixedFeeAmount: 0,
            negotiableMinFee: 0,
            negotiableMaxFee: 0,
            totalCampaignBudgetPool: 0,
            advancePaymentPercentage: 30,
          },
        },
      },
    });

    await tx.uceCampaignProduct.create({
      data: {
        id: ids.product,
        campaignId: ids.campaign,
        productName: "Legacy zero-stock product selection",
        inventoryCount: 0,
        costPerUnit: 0,
      },
    });

    await tx.uceCampaignBrief.create({
      data: {
        id: ids.brief,
        campaignId: ids.campaign,
        internalTitle: "Legacy independent Product Brief",
        creativeGuidelines: "Legacy free-text guidance",
        requiredPlatforms: ["INSTAGRAM"],
      },
    });

    await tx.uceCampaignCreator.create({
      data: {
        id: ids.campaignCreator,
        campaignId: ids.campaign,
        socialHandle: "@c03_legacy_fixture",
        normalizedSocialHandle: "c03_legacy_fixture",
        email: "c03-legacy-fixture@example.test",
      },
    });

    await tx.uceApplication.create({
      data: {
        id: ids.application,
        requestId: "c03-p0-legacy-request",
        campaignId: ids.campaign,
        campaignCreatorId: ids.campaignCreator,
        campaignAssetId: ids.product,
        briefId: ids.brief,
        status: "PENDING",
        source: "DIRECT",
      },
    });

    await tx.uceApplicationSnapshot.create({
      data: {
        id: ids.snapshot,
        applicationId: ids.application,
        campaignContext: { legacy: true, campaignId: ids.campaign },
        campaignAssetContext: { legacyProductId: ids.product, stock: 0 },
        briefContext: { legacyBriefId: ids.brief },
        commercialContext: {
          compensationType: "NEGOTIABLE",
          negotiableMinFee: 0,
          negotiableMaxFee: 0,
          advancePaymentPercentage: 30,
        },
        creatorIdentity: { instagramHandle: "@c03_legacy_fixture" },
      },
    });

    await tx.uceCampaignCollaboration.create({
      data: {
        id: ids.collaboration,
        campaignId: ids.campaign,
        briefId: ids.brief,
        productId: ids.product,
        instagramHandle: "@c03_legacy_fixture",
        creatorEmail: "c03-legacy-fixture@example.test",
        currentMilestoneDeadline: new Date("2099-01-01T00:00:00.000Z"),
        invitationToken: "c03-p0-legacy-plaintext-token-fixture",
        invitationSourceChannel: "legacy-fixture",
      },
    });
  });
} finally {
  await prisma.$disconnect();
}
