import { ConflictException } from "@nestjs/common";
import { UceApplicationStatus, UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CampaignApplicationService } from "./campaign-application.service";

const applicationId = "3dc7e4b2-6b69-4c58-b5f0-0ed03256e451";

function approvalHarness(claimCount = 1) {
  const application = {
    id: applicationId,
    campaignId: "campaign-1",
    campaignCreatorId: "creator-1",
    campaignAssetId: "legacy-product-1",
    briefId: "legacy-brief-1",
    status: UceApplicationStatus.PENDING,
    campaignCreator: {
      socialHandle: "creator",
      email: "creator@example.com",
    },
  };
  const tx = {
    uceApplication: {
      findFirst: vi.fn().mockResolvedValue(application),
      updateMany: vi
        .fn()
        .mockResolvedValueOnce({ count: claimCount })
        .mockResolvedValueOnce({ count: 0 }),
    },
    uceCampaign: {
      findFirst: vi.fn().mockResolvedValue({
        id: "campaign-1",
        status: UceCampaignStatus.LIVE,
      }),
    },
    uceCampaignProduct: {
      findFirst: vi.fn().mockResolvedValue({
        id: "legacy-product-1",
        inventoryCount: 0,
      }),
      update: vi.fn(),
    },
    uceCampaignBrief: {
      findFirst: vi.fn().mockResolvedValue({ id: "legacy-brief-1" }),
    },
    uceCampaignCollaboration: { findFirst: vi.fn().mockResolvedValue(null) },
    uceCampaignCommercials: { findUnique: vi.fn().mockResolvedValue(null) },
    uceCollaborationAuditLog: { create: vi.fn() },
    uceCampaignPerformanceAggregate: { update: vi.fn() },
  };
  const prisma = {
    uceApplication: { findMany: vi.fn() },
    uceCampaignCollaboration: { findMany: vi.fn() },
    uceCampaignCreator: { upsert: vi.fn() },
    $transaction: vi.fn().mockImplementation((callback) => callback(tx)),
  };
  const access = {
    assertCampaignOwned: vi.fn().mockResolvedValue({ id: "campaign-1" }),
  };
  const pipeline = { rejectApplicant: vi.fn() };
  return {
    tx,
    prisma,
    service: new CampaignApplicationService(
      prisma as never,
      access as never,
      pipeline as never,
    ),
  };
}

describe("CampaignApplicationService development authority", () => {
  it("lists UceApplications without invoking legacy synchronization", async () => {
    const { service, prisma } = approvalHarness();
    prisma.uceApplication.findMany.mockResolvedValue([
      {
        id: applicationId,
        campaignCreatorId: "creator-1",
        campaignAssetId: "legacy-product-1",
        briefId: "legacy-brief-1",
        status: UceApplicationStatus.PENDING,
        source: "DIRECT",
        appliedAt: new Date("2026-08-15T00:00:00Z"),
        campaignCreator: { socialHandle: "creator" },
      },
    ]);

    const result = await service.listApplicants("brand-1", "campaign-1");

    expect(prisma.uceCampaignCollaboration.findMany).not.toHaveBeenCalled();
    expect(prisma.uceCampaignCreator.upsert).not.toHaveBeenCalled();
    expect(result.applicants[0]).toMatchObject({
      campaignAssetId: "legacy-product-1",
      briefId: "legacy-brief-1",
      canonicalCampaignAssetId: null,
      canonicalBriefId: null,
      referenceAuthority: "LEGACY_COMPATIBILITY",
    });
  });

  it("approves Applications without auto-provisioning Collaboration", async () => {
    const { service, tx } = approvalHarness();

    const result = await service.approve(
      "brand-1",
      "campaign-1",
      applicationId,
      "actor-1",
    );

    expect(tx.uceApplication.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: applicationId,
          status: UceApplicationStatus.PENDING,
        }),
      }),
    );
    expect(result).toEqual({
      ok: true,
      applicationId,
      status: "APPROVED",
    });
    expect(result).not.toHaveProperty("workflowCollaborationId");
  });

  it("preserves the compare-and-set concurrency guard and does not provision", async () => {
    const { service } = approvalHarness(0);

    await expect(
      service.approve("brand-1", "campaign-1", applicationId, "actor-1"),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
