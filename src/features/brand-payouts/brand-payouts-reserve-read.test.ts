import { describe, expect, it, vi } from "vitest";

import type { BrandPayoutsAuthorizationScopeV1 } from "./contracts/brand-payouts-authorization.contract";
import { BrandPayoutsQueryService } from "./services/brand-payouts-query.service";

const AS_OF = new Date("2026-09-12T12:00:00.000Z");
const INSTRUCTION_ID = "00000000-0000-4000-8000-000000000101";

function scope(
  role: "BRAND_OWNER" | "FINANCE_ADMIN" | "CAMPAIGN_MANAGER",
): BrandPayoutsAuthorizationScopeV1 {
  const common = {
    brandProfileId: "brand-a",
    membershipId: `membership-${role}`,
    authorizedAsOf: AS_OF,
    authorizationVersion: "membership:v3",
  } as const;
  return role === "CAMPAIGN_MANAGER"
    ? {
        ...common,
        role,
        kind: "NO_FINANCIAL_ROWS",
        reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
      }
    : { ...common, role, kind: "FULL_FINANCIAL" };
}

function instruction(
  overrides: Partial<{
    status: string;
    supersededBy: Array<{ id: string; requestedAt: Date }>;
    payoutReserveApproval: {
      status: "COMPLETED";
      failureCode: null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }> = {},
) {
  return {
    id: INSTRUCTION_ID,
    requestId: "reserve-business-request-1",
    collaborationId: "collaboration-a",
    brandProfileId: "brand-a",
    campaignId: "campaign-a",
    currency: "INR",
    reserveAmount: { toFixed: () => "1250.0000" },
    instructionVersion: 4,
    status: "REQUESTED",
    requestedAt: new Date("2026-09-12T10:00:00.000Z"),
    supersededBy: [],
    payoutReserveApproval: null,
    ...overrides,
  };
}

function service(rows: readonly ReturnType<typeof instruction>[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const databaseUtc = vi.fn().mockResolvedValue(undefined);
  const query = new BrandPayoutsQueryService(
    { collaborationReserveInstruction: { findMany } } as never,
    {
      decode: vi.fn().mockImplementation(({ requestAsOf }) => ({
        asOf: requestAsOf,
        lastRecordedAt: null,
        lastStableId: null,
      })),
      encode: vi.fn().mockReturnValue("signed-cursor"),
    } as never,
    { assertDatabaseUtc: databaseUtc } as never,
    {} as never,
    {} as never,
  );
  return { databaseUtc, findMany, query };
}

describe("Brand Payouts reserve-request read correction", () => {
  it.each(["BRAND_OWNER", "FINANCE_ADMIN"] as const)(
    "projects one %s approval action with distinct business, display, and command identities",
    async (role) => {
      const { findMany, query } = service([instruction()]);
      const response = await query.listReserveRequests({
        authorization: scope(role),
        asOf: AS_OF,
        limit: 25,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ brandProfileId: "brand-a" }),
        }),
      );
      const section = response.sections[0];
      expect(section.coverage).toBe("COMPLETE");
      expect(section.payload[0]).toMatchObject({
        reserve_request_id: "reserve-business-request-1",
        reserve_instruction_id: INSTRUCTION_ID,
        public_reference: "reserve-request:reserve-business-request-1",
        resource_version: "reserve-instruction:v4",
        status: "APPROVAL_REQUIRED",
        approval_required: true,
        reserve_value: { amount: "1250.0000", currency: "INR" },
      });
      expect(section.available_actions).toEqual([
        {
          action: "APPROVE_RESERVE",
          resource_reference: INSTRUCTION_ID,
          resource_version: "reserve-instruction:v4",
          authorized_as_of: AS_OF.toISOString(),
        },
      ]);
    },
  );

  it("keeps Campaign Manager fail-closed without reading or revealing amounts", async () => {
    const { databaseUtc, findMany, query } = service([instruction()]);
    const response = await query.listReserveRequests({
      authorization: scope("CAMPAIGN_MANAGER"),
      asOf: AS_OF,
      limit: 25,
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(databaseUtc).not.toHaveBeenCalled();
    expect(response.sections[0]).toMatchObject({
      coverage: "UNAVAILABLE",
      available_actions: [],
      payload: [],
      page: { source_complete: false },
    });
  });

  it.each([
    instruction({
      supersededBy: [
        {
          id: "00000000-0000-4000-8000-000000000102",
          requestedAt: new Date("2026-09-12T11:00:00.000Z"),
        },
      ],
    }),
    instruction({
      payoutReserveApproval: {
        status: "COMPLETED",
        failureCode: null,
        createdAt: new Date("2026-09-12T11:00:00.000Z"),
        updatedAt: new Date("2026-09-12T11:01:00.000Z"),
      },
    }),
    instruction({ status: "INVALID_LEGACY_STATE" }),
  ])(
    "suppresses approval for superseded, completed, or non-current rows",
    async (row) => {
      const { query } = service([row]);
      const response = await query.listReserveRequests({
        authorization: scope("BRAND_OWNER"),
        asOf: AS_OF,
        limit: 25,
      });
      expect(response.sections[0].available_actions).toEqual([]);
      expect(response.sections[0].payload[0]?.approval_required).toBe(false);
    },
  );

  it("honors status filtering without changing the fixed response instant", async () => {
    const { query } = service([instruction()]);
    const response = await query.listReserveRequests({
      authorization: scope("BRAND_OWNER"),
      asOf: AS_OF,
      limit: 1,
      statuses: ["COMPLETED"],
    });
    expect(response.as_of).toBe(AS_OF.toISOString());
    expect(response.sections[0].payload).toEqual([]);
    expect(response.sections[0].available_actions).toEqual([]);
  });
});
