import { randomUUID } from "node:crypto";

import {
  PrismaClient,
  UceBriefStatus,
  UceCampaignAssetKind,
  UceDeliverableFormat,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe.skipIf(process.env.C03_P11A_DATABASE_TEST !== "true")(
  "C-03 P1.1A real-PostgreSQL Campaign/Brief invariants",
  () => {
    const prisma = new PrismaClient();
    const brandId = randomUUID();
    const campaignIds = [randomUUID(), randomUUID()];
    const assetIds = [randomUUID(), randomUUID()];
    const briefIds = [randomUUID(), randomUUID()];
    const reelId = randomUUID();
    const storyId = randomUUID();

    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URL ?? "");
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.startsWith("/c03_p11a_")
      ) {
        throw new Error(
          "C-03 P1.1A tests require a disposable loopback c03_p11a_* database.",
        );
      }
      await prisma.brandProfile.create({
        data: {
          id: brandId,
          domain: `c03-p11a-${brandId}.example.test`,
          name: "C03 P1.1A invariant fixture",
          industry: "D2C",
          brandValues: [],
          policyFlags: [],
        },
      });
      for (const [index, campaignId] of campaignIds.entries()) {
        await prisma.uceCampaign.create({
          data: {
            id: campaignId,
            brandProfileId: brandId,
            name: `C03 P1.1A Campaign ${index}`,
          },
        });
        await prisma.uceCampaignAsset.create({
          data: {
            id: assetIds[index],
            campaignId,
            kind: UceCampaignAssetKind.BRAND,
            brandProfileId: brandId,
          },
        });
        await prisma.canonicalCampaignBrief.create({
          data: {
            id: briefIds[index],
            campaignAssetId: assetIds[index],
            status: UceBriefStatus.DRAFT,
            briefName: `Brief ${index}`,
          },
        });
      }
      await prisma.canonicalBriefDeliverable.create({
        data: {
          id: reelId,
          briefId: briefIds[0],
          format: UceDeliverableFormat.REEL_VIDEO,
          displayOrder: 0,
        },
      });
      await prisma.canonicalBriefDeliverable.create({
        data: {
          id: storyId,
          briefId: briefIds[1],
          format: UceDeliverableFormat.STORY,
          displayOrder: 0,
        },
      });
    });

    afterAll(async () => {
      try {
        await prisma.canonicalBriefDeliverable.deleteMany({
          where: { briefId: { in: briefIds } },
        });
        await prisma.canonicalCampaignBrief.deleteMany({
          where: { id: { in: briefIds } },
        });
        await prisma.uceCampaignAsset.deleteMany({
          where: { id: { in: assetIds } },
        });
        await prisma.uceCampaignCommercials.deleteMany({
          where: { campaignId: { in: campaignIds } },
        });
        await prisma.uceCampaign.deleteMany({
          where: { id: { in: campaignIds } },
        });
        await prisma.brandProfile.deleteMany({ where: { id: brandId } });
      } finally {
        await prisma.$disconnect();
      }
    });

    it("projects canonical Brief status into legacy is_active", async () => {
      const draft = await prisma.canonicalCampaignBrief.findUniqueOrThrow({
        where: { id: briefIds[0] },
      });
      expect(draft.legacyIsActive).toBe(false);

      await expect(
        prisma.$executeRaw`UPDATE campaign_briefs SET is_active = TRUE WHERE brief_id = ${briefIds[0]}`,
      ).rejects.toBeTruthy();

      await prisma.canonicalCampaignBrief.update({
        where: { id: briefIds[0] },
        data: { status: UceBriefStatus.PUBLISHED },
      });
      const published = await prisma.canonicalCampaignBrief.findUniqueOrThrow({
        where: { id: briefIds[0] },
      });
      expect(published.legacyIsActive).toBe(true);
    });

    it("rejects Brief and Deliverable identity or parent mutation", async () => {
      await expect(
        prisma.$executeRaw`UPDATE campaign_briefs SET brief_id = ${randomUUID()} WHERE brief_id = ${briefIds[0]}`,
      ).rejects.toBeTruthy();
      await expect(
        prisma.$executeRaw`UPDATE campaign_briefs SET campaign_asset_id = ${assetIds[1]} WHERE brief_id = ${briefIds[0]}`,
      ).rejects.toBeTruthy();
      await expect(
        prisma.$executeRaw`UPDATE campaign_brief_deliverables SET deliverable_id = ${randomUUID()} WHERE deliverable_id = ${reelId}`,
      ).rejects.toBeTruthy();
      await expect(
        prisma.$executeRaw`UPDATE campaign_brief_deliverables SET brief_id = ${briefIds[1]} WHERE deliverable_id = ${reelId}`,
      ).rejects.toBeTruthy();
    });

    it("rejects self and cross-Brief AMPLIFY_REEL targets", async () => {
      await expect(
        prisma.$executeRaw`UPDATE campaign_brief_deliverables SET amplify_target_deliverable_id = ${storyId} WHERE deliverable_id = ${storyId}`,
      ).rejects.toBeTruthy();
      await expect(
        prisma.$executeRaw`UPDATE campaign_brief_deliverables SET amplify_target_deliverable_id = ${reelId} WHERE deliverable_id = ${storyId}`,
      ).rejects.toBeTruthy();
    });

    it("rejects invalid canonical Deliverable and commercial shapes", async () => {
      await expect(
        prisma.$executeRaw`UPDATE campaign_brief_deliverables SET display_order = -1 WHERE deliverable_id = ${reelId}`,
      ).rejects.toBeTruthy();
      await prisma.uceCampaignCommercials.create({
        data: {
          campaignId: campaignIds[0],
          compensationType: "FIXED_FEE",
          totalCampaignBudgetPool: 100,
        },
      });
      await expect(
        prisma.$executeRaw`UPDATE uce_campaign_commercials SET canonical_version = 1 WHERE campaign_id = ${campaignIds[0]}`,
      ).rejects.toBeTruthy();
    });

    it("installs the composite ancestry keys and guard triggers", async () => {
      const rows = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT indexname AS name FROM pg_indexes
        WHERE schemaname = 'public' AND indexname IN (
          'uce_campaigns_id_brand_profile_id_key',
          'uce_campaign_assets_campaign_id_campaign_asset_id_key',
          'campaign_briefs_campaign_asset_id_brief_id_key',
          'campaign_brief_deliverables_brief_id_deliverable_id_key'
        )
        UNION ALL
        SELECT tgname AS name FROM pg_trigger
        WHERE NOT tgisinternal AND tgname IN (
          'c03_campaign_brief_identity_and_projection_guard',
          'c03_campaign_brief_deliverable_identity_guard'
        )
      `;
      expect(new Set(rows.map((row) => row.name)).size).toBe(6);
    });
  },
);
