import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CanonicalCampaignCreateController } from "./canonical-campaign-create.controller";

describe("CanonicalCampaignCreateController readiness route", () => {
  it("retains the authenticated controller guard and exposes the readiness path", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      CanonicalCampaignCreateController,
    ) as unknown[];
    const routePath = Reflect.getMetadata(
      PATH_METADATA,
      CanonicalCampaignCreateController.prototype.getCanonicalDraftReadiness,
    );

    expect(guards).toContain(JwtAuthGuard);
    expect(routePath).toBe("campaigns/canonical-drafts/:campaignId/readiness");
  });

  it("resolves the authenticated Brand and forwards only the path Campaign ID", async () => {
    const user = { sub: "user-1" };
    const auth = {
      resolveBrandProfileId: vi.fn().mockResolvedValue("brand-1"),
    };
    const readiness = {
      getReadiness: vi.fn().mockResolvedValue({ status: "NOT_READY" }),
    };
    const controller = new CanonicalCampaignCreateController(
      auth as never,
      {} as never,
      {} as never,
      readiness as never,
    );

    await controller.getCanonicalDraftReadiness(
      { user, body: { objective: "PUSH", currency: "USD" } } as never,
      "campaign-1",
    );

    expect(auth.resolveBrandProfileId).toHaveBeenCalledWith(user);
    expect(readiness.getReadiness).toHaveBeenCalledWith(
      "brand-1",
      "campaign-1",
    );
  });
});
