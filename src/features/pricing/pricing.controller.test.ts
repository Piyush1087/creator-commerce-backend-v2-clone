import { ForbiddenException } from "@nestjs/common";
import { BrandRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { BrandSettingsAccessService } from "../brand-settings/services/brand-settings-access.service";
import { PricingController } from "./pricing.controller";

function controllerFor(role: BrandRole) {
  const access = new BrandSettingsAccessService({} as never, {} as never);
  vi.spyOn(access, "resolveBrandContext").mockResolvedValue({
    brandProfileId: "brand-1",
    membership: { role },
  } as never);
  const brandAuth = {
    resolveBrandProfileId: vi.fn().mockResolvedValue("brand-1"),
  };
  const lifecycle = {
    bootstrapLocalTrial: vi.fn().mockResolvedValue({ id: "subscription-1" }),
    getSubscription: vi.fn().mockResolvedValue({ id: "subscription-1" }),
  };
  const controller = new PricingController(
    brandAuth as never,
    access,
    {} as never,
    lifecycle as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const request = { user: { id: "user-1" } } as RequestWithAuthUser;
  return { controller, lifecycle, request };
}

describe("PricingController financial authorization", () => {
  it.each([BrandRole.BRAND_OWNER, BrandRole.FINANCE_ADMIN])(
    "allows %s to bootstrap a subscription trial",
    async (role) => {
      const { controller, lifecycle, request } = controllerFor(role);
      await expect(controller.bootstrapLocalTrial(request)).resolves.toEqual({
        subscription: { id: "subscription-1" },
      });
      expect(lifecycle.bootstrapLocalTrial).toHaveBeenCalledWith("brand-1");
    },
  );

  it("denies Campaign Manager subscription mutations", async () => {
    const { controller, lifecycle, request } = controllerFor(
      BrandRole.CAMPAIGN_MANAGER,
    );
    await expect(
      controller.bootstrapLocalTrial(request),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(lifecycle.bootstrapLocalTrial).not.toHaveBeenCalled();
  });

  it("keeps subscription reads available to Campaign Manager", async () => {
    const { controller, lifecycle, request } = controllerFor(
      BrandRole.CAMPAIGN_MANAGER,
    );
    await expect(controller.getSubscription(request)).resolves.toEqual({
      subscription: { id: "subscription-1" },
    });
    expect(lifecycle.getSubscription).toHaveBeenCalledWith("brand-1");
  });
});
