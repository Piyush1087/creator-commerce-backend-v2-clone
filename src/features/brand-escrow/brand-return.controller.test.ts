import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BrandEscrowController } from "./brand-escrow.controller";

const request = (role: string) =>
  ({ user: { id: `${role.toLowerCase()}-1`, role } }) as never;

function harness() {
  const workspaceAuth = {
    resolveBrandContext: vi.fn().mockResolvedValue({
      brandProfileId: "brand-1",
    }),
    assertFinancialMutation: vi
      .fn()
      .mockImplementation(async (user: { role: string }) => {
        if (user.role === "CAMPAIGN_MANAGER") {
          throw new ForbiddenException("Financial mutation denied");
        }
        return { brandProfileId: "brand-1" };
      }),
  };
  const brandReturns = {
    getSummary: vi.fn().mockResolvedValue({ available_balance: 100 }),
    requestReturn: vi.fn().mockResolvedValue({
      brand_return_request_id: "return-1",
    }),
  };
  const controller = new BrandEscrowController(
    {} as never,
    workspaceAuth as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    brandReturns as never,
  );
  return { brandReturns, controller, workspaceAuth };
}

describe("BS04 Brand Return controller authorization", () => {
  it.each(["BRAND_OWNER", "FINANCE_ADMIN"])(
    "allows %s through canonical financial mutation authority",
    async (role) => {
      const { brandReturns, controller } = harness();
      await expect(
        controller.requestBrandReturn(request(role), {
          amount: 25,
          idempotency_identity: "6c786ed8-938c-4cb7-99eb-f9f49946c1aa",
        }),
      ).resolves.toMatchObject({ brand_return_request_id: "return-1" });
      expect(brandReturns.requestReturn).toHaveBeenCalledWith({
        brandProfileId: "brand-1",
        requestedByUserId: `${role.toLowerCase()}-1`,
        amount: 25,
        requestIdentity: "6c786ed8-938c-4cb7-99eb-f9f49946c1aa",
      });
    },
  );

  it("allows Campaign Manager financial reads but denies Brand Return mutation", async () => {
    const { brandReturns, controller } = harness();
    await expect(
      controller.getBrandReturnSummary(request("CAMPAIGN_MANAGER")),
    ).resolves.toEqual({ available_balance: 100 });
    await expect(
      controller.requestBrandReturn(request("CAMPAIGN_MANAGER"), {
        amount: 25,
        idempotency_identity: "6c786ed8-938c-4cb7-99eb-f9f49946c1aa",
      }),
    ).rejects.toThrow("Financial mutation denied");
    expect(brandReturns.requestReturn).not.toHaveBeenCalled();
  });
});
