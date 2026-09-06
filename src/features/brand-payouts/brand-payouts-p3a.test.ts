import { ConfigService } from "@nestjs/config";
import { Decimal } from "@prisma/client/runtime/library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BrandPayoutsFullFinancialAuthorizationScopeV1 } from "./contracts/brand-payouts-authorization.contract";
import { BrandPayoutsQueryService } from "./services/brand-payouts-query.service";
import { BrandPayoutsCursorCodec } from "./utils/brand-payouts-cursor";

const asOf = new Date("2026-09-05T12:00:00.000Z");
const scope: BrandPayoutsFullFinancialAuthorizationScopeV1 = {
  kind: "FULL_FINANCIAL",
  role: "BRAND_OWNER",
  brandProfileId: "brand-a",
  membershipId: "membership-a",
  authorizationVersion: "membership:v1",
  authorizedAsOf: asOf,
};
const vault = {
  id: "vault-a",
  brandProfileId: "brand-a",
  currency: "INR",
  availableBalance: new Decimal(1000),
  lockedCampaignFunds: new Decimal(200),
  activeReturnCommitment: new Decimal(0),
  updatedAt: new Date("2026-09-05T11:00:00.000Z"),
};

function query(vaultValue: typeof vault | null) {
  const prisma = {
    brandEscrowVault: {
      findUnique: vi.fn().mockResolvedValue(vaultValue),
    },
    escrowTransactionLedger: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return new BrandPayoutsQueryService(
    prisma as never,
    new BrandPayoutsCursorCodec(
      new ConfigService({ JWT_SECRET: "p3a-command-surface-test" }),
    ),
    { assertDatabaseUtc: vi.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    {} as never,
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("Brand Payouts P3A command-surface projection", () => {
  it.each([
    ["SETTINGS", ["OPEN_SETTINGS_ADD_FUNDS", "OPEN_SETTINGS_BRAND_RETURN"]],
    ["PAYOUTS", ["ADD_FUNDS", "REQUEST_BRAND_RETURN"]],
  ] as const)(
    "projects only %s actions from the same server flag",
    async (surface, expected) => {
      vi.stubEnv("BRAND_PAYOUTS_COMMAND_SURFACE", surface);
      const response = await query(vault).readOverview({
        authorization: scope,
        asOf,
      });
      expect(
        response.sections[0].available_actions.map((action) => action.action),
      ).toEqual(expected);
    },
  );

  it("allows only Add funds before a vault exists and defaults safely to Settings", async () => {
    vi.stubEnv("BRAND_PAYOUTS_COMMAND_SURFACE", "");
    const response = await query(null).readOverview({
      authorization: scope,
      asOf,
    });
    expect(
      response.sections[0].available_actions.map((action) => action.action),
    ).toEqual(["OPEN_SETTINGS_ADD_FUNDS"]);
  });
});
