import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  UceApplicationAuthorityVersion,
  UceApplicationStatus,
  UceCampaignStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CampaignApplicationService } from "./campaign-application.service";

const applicationId = "3dc7e4b2-6b69-4c58-b5f0-0ed03256e451";

function approvalHarness(claimCount = 1, capabilityError?: Error) {
  const application = {
    id: applicationId,
    authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
    campaignId: "campaign-1",
    campaignCreatorId: "creator-1",
    legacyCampaignProductId: "legacy-product-1",
    legacyBriefId: "legacy-brief-1",
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
    uceApplication: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    uceCampaignCollaboration: { findMany: vi.fn() },
    uceCampaignCreator: { upsert: vi.fn() },
    $transaction: vi.fn().mockImplementation((callback) => callback(tx)),
  };
  const access = {
    assertCampaignOwned: vi.fn().mockResolvedValue({ id: "campaign-1" }),
  };
  const pipeline = { rejectApplicant: vi.fn() };
  const collaborationProvision = {
    ensureCreatorUserInTransaction: vi.fn().mockResolvedValue("user-1"),
    provisionFromUceApprovalInTransaction: vi.fn().mockResolvedValue({
      collaboration_id: "collaboration-1",
    }),
    broadcastProvisioned: vi.fn().mockResolvedValue(undefined),
  };
  const subscriptionCapabilities = {
    assertCapability: capabilityError
      ? vi.fn().mockRejectedValue(capabilityError)
      : vi.fn().mockResolvedValue(undefined),
  };
  return {
    tx,
    prisma,
    collaborationProvision,
    service: new CampaignApplicationService(
      prisma as never,
      access as never,
      pipeline as never,
      collaborationProvision as never,
      subscriptionCapabilities as never,
    ),
  };
}

describe("CampaignApplicationService development authority", () => {
  it("denies Collaboration creation before claiming or mutating an Application", async () => {
    const { service, prisma, tx, collaborationProvision } = approvalHarness(
      1,
      new ForbiddenException("SUBSCRIPTION_RESTRICTED"),
    );
    await expect(
      service.approve("brand-1", "campaign-1", applicationId, "actor-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.uceApplication.updateMany).not.toHaveBeenCalled();
    expect(
      collaborationProvision.provisionFromUceApprovalInTransaction,
    ).not.toHaveBeenCalled();
  });
  it("lists UceApplications without invoking legacy synchronization", async () => {
    const { service, prisma } = approvalHarness();
    prisma.uceApplication.findMany.mockResolvedValue([
      {
        id: applicationId,
        authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
        campaignCreatorId: "creator-1",
        legacyCampaignProductId: "legacy-product-1",
        legacyBriefId: "legacy-brief-1",
        status: UceApplicationStatus.PENDING,
        source: "DIRECT",
        appliedAt: new Date("2026-08-15T00:00:00Z"),
        campaignCreator: { socialHandle: "creator" },
      },
    ]);

    const result = await service.listApplicants("brand-1", "campaign-1");

    expect(prisma.uceApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
        }),
      }),
    );
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

  it("returns a stable unavailable handoff instead of treating canonical rows as legacy", async () => {
    const { service, prisma } = approvalHarness();
    prisma.uceApplication.findMany.mockResolvedValue([]);
    prisma.uceApplication.count.mockResolvedValue(1);

    const result = await service.listApplicants("brand-1", "campaign-1");

    expect(result).toEqual({
      state: "UNAVAILABLE",
      reason: "C03_CANONICAL_APPLICATION_HANDOFF_NOT_AVAILABLE",
      canonicalApplicationCount: 1,
      applicants: [],
    });
    expect(prisma.uceApplication.count).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
        authorityVersion: UceApplicationAuthorityVersion.C03_CANONICAL,
      },
    });
  });

  it("keeps approval and Collaboration provisioning in one transaction", async () => {
    const { service, tx, collaborationProvision } = approvalHarness();

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
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
          status: UceApplicationStatus.PENDING,
        }),
      }),
    );
    expect(
      collaborationProvision.ensureCreatorUserInTransaction,
    ).toHaveBeenCalledWith(tx, "creator@example.com", "creator");
    expect(
      collaborationProvision.provisionFromUceApprovalInTransaction,
    ).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        campaignId: "campaign-1",
        productId: "legacy-product-1",
        briefId: "legacy-brief-1",
        allowExisting: false,
      }),
    );
    expect(collaborationProvision.broadcastProvisioned).toHaveBeenCalledWith(
      "collaboration-1",
    );
    expect(result).toMatchObject({
      status: "APPROVED",
      workflowCollaborationId: "collaboration-1",
    });
  });

  it("preserves the compare-and-set concurrency guard before provisioning", async () => {
    const { service, collaborationProvision } = approvalHarness(0);

    await expect(
      service.approve("brand-1", "campaign-1", applicationId, "actor-1"),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      collaborationProvision.provisionFromUceApprovalInTransaction,
    ).not.toHaveBeenCalled();
    expect(collaborationProvision.broadcastProvisioned).not.toHaveBeenCalled();
  });
});
