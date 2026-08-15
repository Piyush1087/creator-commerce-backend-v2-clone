/*
 * Local-only, idempotent fixture graph for Phase G migrated-schema runtime
 * acceptance. It deliberately contains no reporting data, provider data, or
 * inferred legacy-to-canonical linkage.
 */
const { PrismaClient } = require("@prisma/client");

const expected = { host: "127.0.0.1", port: "5432", database: "creator_shop_g1_clean_acceptance" };
const url = new URL(process.env.DATABASE_URL || "");
if (url.hostname !== expected.host || url.port !== expected.port || url.pathname.replace(/^\//, "") !== expected.database) {
  throw new Error("G1 clean fixture safety gate failed");
}

const prisma = new PrismaClient();
const ids = {
  organization: "10000000-0000-4000-8000-000000000001",
  brandUser: "10000000-0000-4000-8000-000000000002",
  brandProfile: "10000000-0000-4000-8000-000000000003",
  offering: "10000000-0000-4000-8000-000000000004",
  creatorOne: "10000000-0000-4000-8000-000000000005",
  creatorOneProfile: "10000000-0000-4000-8000-000000000006",
  creatorTwo: "10000000-0000-4000-8000-000000000007",
  creatorTwoProfile: "10000000-0000-4000-8000-000000000008",
  reconcileCampaign: "10000000-0000-4000-8000-000000000010",
  readyCampaign: "10000000-0000-4000-8000-000000000011",
  terminalCampaign: "10000000-0000-4000-8000-000000000012",
  liveCampaign: "10000000-0000-4000-8000-000000000013",
  readyAsset: "10000000-0000-4000-8000-000000000020",
  readyBrief: "10000000-0000-4000-8000-000000000021",
  readyDeliverable: "10000000-0000-4000-8000-000000000022",
  application: "10000000-0000-4000-8000-000000000023",
  liveAsset: "10000000-0000-4000-8000-000000000024",
  liveBrief: "10000000-0000-4000-8000-000000000025",
  liveDeliverable: "10000000-0000-4000-8000-000000000026",
  reconciliationLegacyProduct: "10000000-0000-4000-8000-000000000027",
};

const campaignData = (name, status) => ({
  id: ids[name], brandProfileId: ids.brandProfile, name: `F6C G1 ${name}`, status,
});
const prerequisites = (campaignId) => ({
  strategy: { upsert: { create: { campaign: { connect: { id: campaignId } }, timelineType: "DYNAMIC_MILESTONES", dynamicDaysLimit: 30, coreObjective: "BRAND_AWARENESS", platformDeliverables: {} }, update: {} } },
  targeting: { upsert: { create: { campaign: { connect: { id: campaignId } }, industryVertical: "D2C" }, update: {} } },
  commercials: { upsert: { create: { campaign: { connect: { id: campaignId } }, compensationType: "FIXED_FEE", fixedFeeAmount: 100, totalCampaignBudgetPool: 1000 }, update: {} } },
});

async function upsertCampaign(name, status) {
  const data = campaignData(name, status);
  await prisma.uceCampaign.upsert({ where: { id: data.id }, create: data, update: { name: data.name, status } });
  const p = prerequisites(data.id);
  await prisma.uceCampaignStrategy.upsert({ where: { campaignId: data.id }, ...p.strategy.upsert });
  await prisma.uceCampaignTargeting.upsert({ where: { campaignId: data.id }, ...p.targeting.upsert });
  await prisma.uceCampaignCommercials.upsert({ where: { campaignId: data.id }, ...p.commercials.upsert });
}

async function main() {
  await prisma.organization.upsert({ where: { id: ids.organization }, create: { id: ids.organization, name: "F6C G1 Acceptance Brand" }, update: { name: "F6C G1 Acceptance Brand" } });
  await prisma.user.upsert({ where: { email: "f6c.brand.owner@example.invalid" }, create: { id: ids.brandUser, email: "f6c.brand.owner@example.invalid", name: "F6C Brand Owner", role: "BRAND", organizationId: ids.organization }, update: { organizationId: ids.organization, role: "BRAND" } });
  await prisma.brandProfile.upsert({ where: { id: ids.brandProfile }, create: { id: ids.brandProfile, organizationId: ids.organization, domain: "f6c-g1-acceptance.example.invalid", name: "F6C G1 Acceptance Brand", industry: "D2C", brandValues: [], policyFlags: [], targetAudience: {} }, update: { organizationId: ids.organization } });
  await prisma.offering.upsert({ where: { id: ids.offering }, create: { id: ids.offering, brandProfileId: ids.brandProfile, type: "PRODUCT", name: "F6C G1 Offering", url: "https://f6c-g1-acceptance.example.invalid/offering", locationIds: [] }, update: { isActive: true } });
  for (const [userId, profileId, email, displayName, slug] of [[ids.creatorOne, ids.creatorOneProfile, "f6c.creator@example.invalid", "F6C Primary Creator", "f6c-g1-primary"], [ids.creatorTwo, ids.creatorTwoProfile, "f6c.second.creator@example.invalid", "F6C Secondary Creator", "f6c-g1-secondary"]]) {
    await prisma.user.upsert({ where: { email }, create: { id: userId, email, name: displayName, role: "CREATOR" }, update: { role: "CREATOR" } });
    await prisma.creatorProfile.upsert({ where: { userId }, create: { id: profileId, userId, displayName, publicSlug: slug }, update: { displayName } });
  }
  await upsertCampaign("reconcileCampaign", "ACTIVE");
  await upsertCampaign("readyCampaign", "DRAFT");
  await upsertCampaign("terminalCampaign", "ARCHIVED");
  await upsertCampaign("liveCampaign", "ACTIVE");
  await prisma.uceCampaignProduct.upsert({ where: { id: ids.reconciliationLegacyProduct }, create: { id: ids.reconciliationLegacyProduct, campaignId: ids.reconcileCampaign, productName: "F6C compatibility fixture product", skuCode: "F6C-G1-COMPAT" }, update: {} });
  for (const [assetId, campaignId, briefId, deliverableId, title] of [[ids.readyAsset, ids.readyCampaign, ids.readyBrief, ids.readyDeliverable, "F6C ready canonical brief"], [ids.liveAsset, ids.liveCampaign, ids.liveBrief, ids.liveDeliverable, "F6C live canonical brief"]]) {
    await prisma.uceCampaignAsset.upsert({ where: { id: assetId }, create: { id: assetId, campaignId, kind: "OFFERING", offeringId: ids.offering }, update: { status: "ACTIVE" } });
    await prisma.canonicalCampaignBrief.upsert({ where: { id: briefId }, create: { id: briefId, campaignAssetId: assetId, title, creativeRequirements: "Deterministic local acceptance creative requirements." }, update: {} });
    await prisma.canonicalBriefDeliverable.upsert({ where: { id: deliverableId }, create: { id: deliverableId, briefId, format: "Short video", quantity: 1, creativeRequirements: "Demonstrate the offering truthfully.", publishingRequired: true }, update: {} });
  }
  await prisma.campaignApplication.upsert({ where: { id: ids.application }, create: { id: ids.application, campaignId: ids.readyCampaign, canonicalBriefId: ids.readyBrief, creatorUserId: ids.creatorOne }, update: { status: "SUBMITTED", collaborationId: null } });
  const counts = await Promise.all(["user", "organization", "brandProfile", "offering", "creatorProfile", "uceCampaign", "campaignApplication", "collaboration"].map((model) => prisma[model].count()));
  console.log(JSON.stringify(Object.fromEntries(["users", "organizations", "brandProfiles", "offerings", "creatorProfiles", "campaigns", "applications", "collaborations"].map((name, i) => [name, counts[i]]))));
}

main().finally(() => prisma.$disconnect());
