import { UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { BrandUceCampaignService } from "./brand-uce-campaign.service";

describe("Campaign lifecycle canonical readiness reconciliation", () => {
  it("retains PUBLISHED/LIVE and does not restore ACTIVE", () => {
    expect(Object.values(UceCampaignStatus)).toContain("PUBLISHED");
    expect(Object.values(UceCampaignStatus)).toContain("LIVE");
    expect(Object.values(UceCampaignStatus)).not.toContain("ACTIVE");
  });

  it("builds go-live readiness from canonical Assets and nested Briefs", async () => {
    const prisma = {
      uceCampaignAsset: { count: vi.fn().mockResolvedValue(1) },
      canonicalCampaignBrief: {
        findMany: vi.fn().mockResolvedValue([
          {
            status: "PUBLISHED",
            briefName: "Creator launch Brief",
            creativeIntent: "Demonstrate a credible daily routine.",
            creatorBrief: "Show the product in natural daylight.",
            briefType: "CREATOR_LED",
            platform: "INSTAGRAM",
            briefLevelGuidance: null,
            referenceContent: null,
            usageRights: null,
            creatorRequirements: null,
            deliverables: [
              {
                id: "deliverable-1",
                format: "REEL_VIDEO",
                displayOrder: 0,
                configuration: null,
                creativeGuidance: null,
                amplifyTargetDeliverableId: null,
              },
            ],
          },
        ]),
      },
      uceCampaignCommercials: {
        findUnique: vi.fn().mockResolvedValue({
          totalCampaignBudgetPool: 1000,
          canonicalVersion: 1,
        }),
      },
      uceCampaignProduct: { count: vi.fn() },
      uceCampaignBrief: { count: vi.fn() },
    };
    const access = {
      assertCampaignOwned: vi.fn().mockResolvedValue({ id: "campaign-1" }),
    };
    const service = new BrandUceCampaignService(
      prisma as never,
      access as never,
      { assertCapability: vi.fn() } as never,
    );

    const checklist = await service.getActivationChecklist(
      "brand-1",
      "campaign-1",
    );

    expect(checklist).toEqual([
      expect.objectContaining({ key: "campaign_asset", satisfied: true }),
      expect.objectContaining({ key: "canonical_brief", satisfied: true }),
      expect.objectContaining({ key: "escrow_funding", satisfied: true }),
    ]);
    expect(prisma.uceCampaignProduct.count).not.toHaveBeenCalled();
    expect(prisma.uceCampaignBrief.count).not.toHaveBeenCalled();
  });
});
