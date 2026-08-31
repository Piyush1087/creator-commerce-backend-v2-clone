import { NotFoundException } from "@nestjs/common";
import { OfferingPriceMode } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { BrandCentreController } from "../brand-centre.controller";
import { BrandCentreDnaService } from "./brand-centre-dna.service";
import { CanonicalOfferingStateService } from "./canonical-offering-state.service";

function dnaService(current: unknown = null) {
  const canonical = {
    read: vi.fn().mockResolvedValue({ priceState: current }),
    advancePrice: vi
      .fn()
      .mockImplementation(
        async (
          _brandProfileId: string,
          _offeringId: string,
          _expected: number | null,
          input: unknown,
        ) => input,
      ),
  };
  const service = new BrandCentreDnaService(
    {} as never,
    {} as never,
    {} as never,
    canonical as unknown as CanonicalOfferingStateService,
  );
  return { service, canonical };
}

describe("manual canonical Offering price command", () => {
  it("derives exact Brand ownership from the authenticated controller context", async () => {
    const auth = {
      resolveBrandProfileId: vi.fn().mockResolvedValue("brand-authenticated"),
    };
    const dna = {
      setManualOfferingPrice: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new BrandCentreController(
      auth as never,
      {} as never,
      {} as never,
      dna as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const body = {
      mode: OfferingPriceMode.EXACT,
      currentMinAmount: "25",
      currentMaxAmount: "25",
      currency: "usd",
    };
    await controller.setOfferingPrice(
      { user: { id: "user-authenticated" } } as never,
      "offering-exact",
      body,
    );
    expect(auth.resolveBrandProfileId).toHaveBeenCalledWith({
      id: "user-authenticated",
    });
    expect(dna.setManualOfferingPrice).toHaveBeenCalledWith(
      "brand-authenticated",
      "offering-exact",
      body,
    );
  });

  it("fails closed for invalid or cross-Brand Offering ownership", async () => {
    const { service, canonical } = dnaService();
    canonical.read.mockResolvedValueOnce(null);
    await expect(
      service.setManualOfferingPrice("brand-a", "offering-owned-by-b", {
        mode: OfferingPriceMode.EXACT,
        currentMinAmount: "25",
        currentMaxAmount: "25",
        currency: "USD",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    {
      mode: OfferingPriceMode.EXACT,
      currentMinAmount: "25.00",
      currentMaxAmount: "25.00",
      currency: "usd",
    },
    {
      mode: OfferingPriceMode.STARTING_AT,
      currentMinAmount: "10",
      currency: "USD",
    },
    {
      mode: OfferingPriceMode.RANGE,
      currentMinAmount: "10",
      currentMaxAmount: "20",
      regularReferenceMinAmount: "30",
      regularReferenceMaxAmount: "40",
      currency: "USD",
    },
    {
      mode: OfferingPriceMode.NOT_PUBLICLY_LISTED,
      currency: "USD",
    },
  ])("writes strict manual $mode authority and origin", async (input) => {
    const { service, canonical } = dnaService({ revision: 7 });
    await service.setManualOfferingPrice("brand-a", "offering-a", input);
    expect(canonical.advancePrice).toHaveBeenCalledWith(
      "brand-a",
      "offering-a",
      7,
      expect.objectContaining({
        mode: input.mode,
        currency: "USD",
        freshness: "CURRENT",
        authority: "BRAND_CONFIRMED",
        origin: "BRAND_EDIT",
        sourceClass: "APPLICATION",
      }),
    );
  });

  it.each([
    {
      mode: OfferingPriceMode.EXACT,
      currentMinAmount: "10",
      currentMaxAmount: "11",
      currency: "USD",
    },
    {
      mode: OfferingPriceMode.STARTING_AT,
      currentMinAmount: "10",
      currentMaxAmount: "20",
      currency: "USD",
    },
    {
      mode: OfferingPriceMode.RANGE,
      currentMinAmount: "20",
      currentMaxAmount: "10",
      currency: "USD",
    },
    {
      mode: OfferingPriceMode.NOT_PUBLICLY_LISTED,
      currentMinAmount: "10",
      currency: "USD",
    },
  ])("rejects invalid strict tuple %#", async (input) => {
    const { service } = dnaService();
    await expect(
      service.setManualOfferingPrice("brand-a", "offering-a", input),
    ).rejects.toThrow();
  });
});
