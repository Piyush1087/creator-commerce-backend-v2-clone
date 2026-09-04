import { BadRequestException } from "@nestjs/common";
import { UceCampaignStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CanonicalCampaignReadinessService } from "./canonical-campaign-readiness.service";

function definition(objective?: string) {
  return {
    version: "1.2",
    draft: { strategy: objective ? { core_objective: objective } : {} },
  };
}

function setup(options?: {
  campaign?: {
    id: string;
    status: UceCampaignStatus;
    canonicalDefinition?: unknown;
  } | null;
  objective?: string;
  industry?: string;
  countryCode?: string | null;
  brand?: boolean;
}) {
  const prisma = {
    uceCampaign: {
      findFirst: vi.fn().mockResolvedValue(
        options?.campaign === null
          ? null
          : (options?.campaign ?? {
              id: "campaign-1",
              status: UceCampaignStatus.DRAFT,
              canonicalDefinition: definition(options?.objective),
            }),
      ),
      update: vi.fn(),
      create: vi.fn(),
    },
    brandProfile: {
      findUnique: vi.fn().mockResolvedValue(
        options?.brand === false
          ? null
          : {
              industry: options?.industry ?? "D2C",
              countryCode: options?.countryCode ?? "IN",
            },
      ),
    },
    uceCampaignReportingSnapshot: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };

  return {
    prisma,
    service: new CanonicalCampaignReadinessService(prisma as never),
  };
}

describe("CanonicalCampaignReadinessService", () => {
  it("returns NOT_READY for an owned Draft with no saved Objective", async () => {
    const { service } = setup();

    await expect(
      service.getReadiness("brand-1", "campaign-1"),
    ).resolves.toEqual({
      campaignId: "campaign-1",
      objective: null,
      status: "NOT_READY",
      reason: "OBJECTIVE_REQUIRED",
    });
  });

  it("returns the authoritative saved Objective and resolver-derived projection", async () => {
    const { service } = setup({ objective: "PULSE" });

    await expect(
      service.getReadiness("brand-1", "campaign-1"),
    ).resolves.toEqual({
      campaignId: "campaign-1",
      objective: "PULSE",
      status: "READY",
      currency: "INR",
      primaryKpi: "REACH",
      supportingKpis: [
        "DISCOVER_REACH",
        "IMPRESSIONS",
        "PROFILE_VISITS",
        "NEW_FOLLOWERS",
      ],
      revision: "objective:PULSE",
    });
  });

  it("uses Brand country context rather than request data", async () => {
    const { service } = setup({ objective: "PROOF", countryCode: "US" });

    const result = await service.getReadiness("brand-1", "campaign-1");

    expect(result).toMatchObject({ objective: "PROOF", currency: "USD" });
  });

  it("returns a stable non-retryable failure without internal configuration text", async () => {
    const { service } = setup({ objective: "PULSE", industry: "UNKNOWN" });

    const result = await service.getReadiness("brand-1", "campaign-1");

    expect(result).toEqual({
      campaignId: "campaign-1",
      objective: "PULSE",
      status: "FAILED",
      reason: "SUPPORTING_KPI_CONFIGURATION_UNAVAILABLE",
      retryable: false,
      revision: "objective:PULSE",
    });
    expect(JSON.stringify(result)).not.toContain("UNKNOWN");
  });

  it("does not disclose a missing or differently owned Draft", async () => {
    const { service, prisma } = setup({ campaign: null });

    await expect(
      service.getReadiness("brand-1", "campaign-other"),
    ).rejects.toEqual(new BadRequestException("Campaign draft not found."));
    expect(prisma.uceCampaign.findFirst).toHaveBeenCalledWith({
      where: { id: "campaign-other", brandProfileId: "brand-1" },
      select: { id: true, status: true, canonicalDefinition: true },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a Campaign that is no longer a Draft", async () => {
    const { service, prisma } = setup({
      campaign: { id: "campaign-1", status: UceCampaignStatus.PUBLISHED },
    });

    await expect(service.getReadiness("brand-1", "campaign-1")).rejects.toEqual(
      new BadRequestException("Campaign is no longer a DRAFT."),
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("uses only reads and never mutates, publishes, snapshots, or persists derivation", async () => {
    const { service, prisma } = setup({ objective: "PUSH" });

    await service.getReadiness("brand-1", "campaign-1");

    expect(prisma.uceCampaign.update).not.toHaveBeenCalled();
    expect(prisma.uceCampaign.create).not.toHaveBeenCalled();
    expect(prisma.uceCampaignReportingSnapshot.create).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("propagates unexpected operational failures to the application error layer", async () => {
    const { service, prisma } = setup({ objective: "PULSE" });
    prisma.uceCampaign.findFirst.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(service.getReadiness("brand-1", "campaign-1")).rejects.toThrow(
      "database unavailable",
    );
  });
});
