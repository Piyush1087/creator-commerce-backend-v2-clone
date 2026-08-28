import { ConfigService } from "@nestjs/config";
import { OfferingLifecycle } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { OfferingPriceRefreshConfigService } from "./offering-price-refresh-config.service";
import {
  offeringPriceRefreshRequestKey,
  OfferingPriceRefreshCoordinatorService,
} from "./offering-price-refresh-coordinator.service";
import {
  OfferingPriceRefreshEligibilityService,
  type EligibleOfferingPriceRefresh,
} from "./offering-price-refresh-eligibility.service";
import { OfferingPriceRefreshScheduler } from "./offering-price-refresh.scheduler";

function candidate(id: string): EligibleOfferingPriceRefresh {
  return {
    brandProfileId: `brand-${id}`,
    offeringId: `offering-${id}`,
    offeringUrl: `https://brand.example/${id}`,
    ownedWebsiteRoot: "https://brand.example",
    resourceRef: `resource:${id}`,
    lastSuccessfulAt: null,
  };
}

describe("Offering price refresh scheduling and eligibility", () => {
  it("uses a stable hourly UTC claim bucket and changes on the next hour", () => {
    const first = offeringPriceRefreshRequestKey(
      "brand-a",
      "offering-a",
      new Date("2026-08-28T12:59:59.999Z"),
    );
    expect(
      offeringPriceRefreshRequestKey(
        "brand-a",
        "offering-a",
        new Date("2026-08-28T12:00:00.000Z"),
      ),
    ).toBe(first);
    expect(
      offeringPriceRefreshRequestKey(
        "brand-a",
        "offering-a",
        new Date("2026-08-28T13:00:00.000Z"),
      ),
    ).not.toBe(first);
    expect(first).toContain(
      "owned_website.offering_commercial_evidence:brand-a:offering-a:2026-08-28T12",
    );
  });

  it("defaults to enabled hourly scan, 24h cadence, and bounded batch 20", () => {
    const service = new OfferingPriceRefreshConfigService({
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);
    expect(service.read()).toEqual({
      enabled: true,
      scanIntervalMinutes: 60,
      refreshIntervalHours: 24,
      batchSize: 20,
    });
  });

  it("fails optional bad configuration closed without making startup fail", () => {
    const values: Record<string, string> = {
      OFFERING_PRICE_REFRESH_ENABLED: "true",
      OFFERING_PRICE_REFRESH_BATCH_SIZE: "0",
    };
    const service = new OfferingPriceRefreshConfigService({
      get: vi.fn((name: string) => values[name]),
    } as unknown as ConfigService);
    expect(service.read().enabled).toBe(false);
  });

  it("does not register or dispatch when disabled", () => {
    const registry = {
      addInterval: vi.fn(),
      deleteInterval: vi.fn(),
    };
    const coordinator = { runBatch: vi.fn() };
    const scheduler = new OfferingPriceRefreshScheduler(
      registry as never,
      { read: () => ({ enabled: false }) } as never,
      coordinator as never,
    );
    scheduler.onModuleInit();
    expect(registry.addInterval).not.toHaveBeenCalled();
    expect(coordinator.runBatch).not.toHaveBeenCalled();
  });

  it("selects ACTIVE, exact-resource, unprotected Offerings at >=24h and bounds the batch", async () => {
    const offerings = [
      {
        id: "never",
        brandProfileId: "brand-never",
        url: "https://never.example/item",
        brandProfile: { domain: "never.example" },
        priceState: null,
      },
      {
        id: "manual",
        brandProfileId: "brand-manual",
        url: "https://manual.example/item",
        brandProfile: { domain: "manual.example" },
        priceState: {
          currentRevision: {
            authority: "BRAND_CONFIRMED",
            origin: "BRAND_EDIT",
          },
        },
      },
      {
        id: "recent",
        brandProfileId: "brand-recent",
        url: "https://recent.example/item",
        brandProfile: { domain: "recent.example" },
        priceState: null,
      },
      {
        id: "old",
        brandProfileId: "brand-old",
        url: "https://old.example/item",
        brandProfile: { domain: "old.example" },
        priceState: null,
      },
    ];
    const prisma = {
      offering: { findMany: vi.fn().mockResolvedValue(offerings) },
      dataExtractionResource: {
        findUnique: vi.fn().mockImplementation(async () => ({
          resourceRef: `resource:${Math.random()}`,
          pageRole: "OFFERING_DETAIL",
        })),
      },
      dataExtractionCapabilityExecution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            completedAt: new Date("2026-08-28T11:00:00.000Z"),
          })
          .mockResolvedValueOnce({
            completedAt: new Date("2026-08-26T11:00:00.000Z"),
          }),
      },
    };
    const service = new OfferingPriceRefreshEligibilityService(
      prisma as unknown as PrismaService,
    );
    const selected = await service.select(
      24,
      2,
      new Date("2026-08-28T12:00:00.000Z"),
    );
    expect(selected.map((item) => item.offeringId)).toEqual(["never", "old"]);
    expect(prisma.offering.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { canonicalLifecycle: OfferingLifecycle.ACTIVE },
      }),
    );
    const cadenceWhere =
      prisma.dataExtractionCapabilityExecution.findFirst.mock.calls[0][0].where;
    expect(cadenceWhere.captures.some.status).toBe("COMPLETED");
    expect(cadenceWhere).not.toHaveProperty("evidenceMemberships");
  });

  it("isolates one Offering failure and continues the bounded batch", async () => {
    const candidates = [candidate("a"), candidate("b")];
    const coordinator = new OfferingPriceRefreshCoordinatorService(
      {
        read: () => ({
          enabled: true,
          refreshIntervalHours: 24,
          batchSize: 2,
        }),
      } as never,
      { select: vi.fn().mockResolvedValue(candidates) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const internals = coordinator as unknown as {
      runOne: (
        value: EligibleOfferingPriceRefresh,
        now: Date,
      ) => Promise<"NO_CHANGE">;
    };
    vi.spyOn(internals, "runOne")
      .mockRejectedValueOnce(new Error("one Offering failed"))
      .mockResolvedValueOnce("NO_CHANGE");
    expect(await coordinator.runBatch()).toEqual([
      { offeringId: "offering-a", outcome: "ACQUISITION_FAILED" },
      { offeringId: "offering-b", outcome: "NO_CHANGE" },
    ]);
    expect(internals.runOne).toHaveBeenCalledTimes(2);
  });
});
