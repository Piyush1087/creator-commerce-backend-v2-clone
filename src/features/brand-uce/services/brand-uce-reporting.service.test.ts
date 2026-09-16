import { ConflictException, NotFoundException } from "@nestjs/common";
import { UceCampaignObjective } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  BrandUceReportingService,
  CAMPAIGN_REPORTING_CANONICAL_OBJECTIVE_UNAVAILABLE,
} from "./brand-uce-reporting.service";

const decimal = (value: number) => ({ toString: () => String(value) });

function harness(
  objective: UceCampaignObjective = UceCampaignObjective.BRAND_AWARENESS,
) {
  const lastSync = new Date("2026-08-15T00:00:00.000Z");
  const prisma = {
    uceCampaignStrategy: {
      findUnique: vi.fn().mockResolvedValue({
        coreObjective: objective,
      }),
    },
    uceCampaignReportingSnapshot: {
      findFirst: vi.fn().mockResolvedValue({
        lastApiSyncTimestamp: lastSync,
        totalSpendAllocated: decimal(100),
        totalEarnedMediaValue: decimal(250),
        totalVerifiedImpressions: 1000n,
        totalVerifiedReach: 750n,
        calculatedCpmRate: decimal(10),
        calculatedCpeRate: decimal(2),
        totalTrackedLinkClicks: 0n,
        aggregatedCtrPercentage: decimal(0),
        calculatedCpcRate: decimal(0),
        attributedSalesRevenue: decimal(0),
        attributedConversionCount: 0,
        aggregatedConversionRate: decimal(0),
        calculatedCacRate: decimal(0),
      }),
      create: vi.fn().mockResolvedValue({
        id: "snapshot-2",
        lastApiSyncTimestamp: lastSync,
      }),
    },
    uceCampaignReportingTimeseriesHourly: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    uceCampaignReportingAssetGallery: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    uceCampaignCollaboration: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const access = {
    assertCampaignOwned: vi.fn().mockResolvedValue({
      id: "campaign-1",
      name: "Legacy Reporting Campaign",
    }),
  };
  return {
    prisma,
    access,
    service: new BrandUceReportingService(prisma as never, access as never),
  };
}

describe("BrandUceReportingService legacy compatibility contract", () => {
  it.each([
    UceCampaignObjective.AWARENESS,
    UceCampaignObjective.TRUST,
    UceCampaignObjective.ASSETS,
    UceCampaignObjective.ACTION,
  ])(
    "fails the legacy dashboard closed for canonical objective %s",
    async (objective) => {
      const { service, prisma } = harness(objective);

      const error = await service
        .getDashboard("brand-1", "campaign-1")
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        code: CAMPAIGN_REPORTING_CANONICAL_OBJECTIVE_UNAVAILABLE,
      });
      expect(
        prisma.uceCampaignReportingSnapshot.findFirst,
      ).not.toHaveBeenCalled();
      expect(
        prisma.uceCampaignReportingTimeseriesHourly.findMany,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    UceCampaignObjective.AWARENESS,
    UceCampaignObjective.TRUST,
    UceCampaignObjective.ASSETS,
    UceCampaignObjective.ACTION,
  ])(
    "fails legacy refresh closed for canonical objective %s without a write",
    async (objective) => {
      const { service, prisma } = harness(objective);

      const error = await service
        .forceRefreshSync("brand-1", "campaign-1")
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        code: CAMPAIGN_REPORTING_CANONICAL_OBJECTIVE_UNAVAILABLE,
      });
      expect(prisma.uceCampaignReportingSnapshot.create).not.toHaveBeenCalled();
    },
  );

  it("preserves the existing dashboard payload for the legacy Reporting tab", async () => {
    const { service } = harness();

    const dashboard = await service.getDashboard("brand-1", "campaign-1");

    expect(dashboard).toMatchObject({
      campaign_id: "campaign-1",
      campaign_name: "Legacy Reporting Campaign",
      primary_objective: UceCampaignObjective.BRAND_AWARENESS,
      last_api_sync_timestamp: "2026-08-15T00:00:00.000Z",
      roi_summary_strip_payload: {
        total_spend_allocated: 100,
        total_earned_media_value: 250,
        total_verified_impressions: 1000,
        total_verified_reach: 750,
      },
      timeseries_hourly_feed: [],
      leaderboard_rankings: [],
      creative_gallery_grid: [],
    });
    expect(dashboard).not.toHaveProperty("availability");
  });

  it("preserves the explicit refresh compatibility command", async () => {
    const { service, prisma } = harness();

    const result = await service.forceRefreshSync("brand-1", "campaign-1");

    expect(prisma.uceCampaignReportingSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "campaign-1",
        primaryObjective: UceCampaignObjective.BRAND_AWARENESS,
      }),
    });
    expect(result).toEqual({
      ok: true,
      snapshot_id: "snapshot-2",
      last_api_sync_timestamp: "2026-08-15T00:00:00.000Z",
    });
  });

  it("checks Campaign ownership before exposing legacy reporting data", async () => {
    const { service, prisma, access } = harness();
    access.assertCampaignOwned.mockRejectedValueOnce(
      new NotFoundException("Campaign not found"),
    );

    await expect(
      service.getDashboard("brand-other", "campaign-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      prisma.uceCampaignReportingSnapshot.findFirst,
    ).not.toHaveBeenCalled();
  });
});
