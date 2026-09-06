import { ForbiddenException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  const escrow = {
    createCardTopUpIntent: vi.fn().mockResolvedValue({
      funding_load_id: "load-1",
    }),
  };
  const controller = new BrandEscrowController(
    {} as never,
    workspaceAuth as never,
    {} as never,
    escrow as never,
    {} as never,
    {} as never,
    {} as never,
    brandReturns as never,
  );
  return { brandReturns, controller, escrow, workspaceAuth };
}

afterEach(() => vi.unstubAllEnvs());

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

  it("atomically admits only the configured command surface for both mutations", async () => {
    vi.stubEnv("BRAND_PAYOUTS_COMMAND_SURFACE", "PAYOUTS");
    const { brandReturns, controller, escrow } = harness();
    const topUp = {
      target_allocation: 5000,
      idempotency_key: "6c786ed8-938c-4cb7-99eb-f9f49946c1aa",
    };
    const brandReturn = {
      amount: 25,
      idempotency_identity: "6c786ed8-938c-4cb7-99eb-f9f49946c1aa",
    };

    await expect(
      controller.createTopUpIntent(request("BRAND_OWNER"), topUp, "PAYOUTS"),
    ).resolves.toMatchObject({ funding_load_id: "load-1" });
    await expect(
      controller.requestBrandReturn(
        request("FINANCE_ADMIN"),
        brandReturn,
        "PAYOUTS",
      ),
    ).resolves.toMatchObject({ brand_return_request_id: "return-1" });

    await expect(
      controller.createTopUpIntent(request("BRAND_OWNER"), topUp, "SETTINGS"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "BRAND_FINANCIAL_COMMAND_SURFACE_INACTIVE",
      }),
    });
    await expect(
      controller.requestBrandReturn(
        request("BRAND_OWNER"),
        brandReturn,
        undefined,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "BRAND_FINANCIAL_COMMAND_SURFACE_INACTIVE",
      }),
    });
    expect(escrow.createCardTopUpIntent).toHaveBeenCalledOnce();
    expect(brandReturns.requestReturn).toHaveBeenCalledOnce();
  });

  it("keeps missing-header Settings compatibility during rollback", async () => {
    vi.stubEnv("BRAND_PAYOUTS_COMMAND_SURFACE", "SETTINGS");
    const { controller } = harness();
    await expect(
      controller.requestBrandReturn(request("BRAND_OWNER"), {
        amount: 25,
        idempotency_identity: "6c786ed8-938c-4cb7-99eb-f9f49946c1aa",
      }),
    ).resolves.toMatchObject({ brand_return_request_id: "return-1" });
  });
});
