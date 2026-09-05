import { ForbiddenException, NotAcceptableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { BRAND_PAYOUTS_V2_MEDIA_TYPE } from "./contracts/brand-payouts-v2.contract";
import { BrandPayoutsController } from "./brand-payouts.controller";

const ownerScope = {
  kind: "FULL_FINANCIAL",
  role: "BRAND_OWNER",
  brandProfileId: "brand-a",
  membershipId: "membership-owner",
  authorizationVersion: "membership:2026-09-04T10:00:00.000Z",
  authorizedAsOf: new Date("2026-09-04T10:00:00.000Z"),
} as const;
const managerScope = {
  kind: "NO_FINANCIAL_ROWS",
  role: "CAMPAIGN_MANAGER",
  reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE",
  brandProfileId: "brand-a",
  membershipId: "membership-manager",
  authorizationVersion: "membership:2026-09-04T10:00:00.000Z",
  authorizedAsOf: new Date("2026-09-04T10:00:00.000Z"),
} as const;

function response() {
  const instance = {
    setHeader: vi.fn(),
    type: vi.fn(),
    status: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
  instance.type.mockReturnValue(instance);
  instance.status.mockReturnValue(instance);
  return instance;
}

function request(): RequestWithAuthUser {
  return { user: { id: "user-a" } } as RequestWithAuthUser;
}

function setup(scope: typeof ownerScope | typeof managerScope = ownerScope) {
  const legacy = { getPayoutsHub: vi.fn().mockResolvedValue({ legacy: true }) };
  const authorization = { resolve: vi.fn().mockResolvedValue(scope) };
  const query = {
    readOverview: vi
      .fn()
      .mockResolvedValue({ schema_version: "brand-payouts.v2" }),
    listActivity: vi.fn().mockResolvedValue({}),
    listObligations: vi.fn().mockResolvedValue({}),
    readObligation: vi.fn().mockResolvedValue({}),
    readActivity: vi.fn().mockResolvedValue({}),
    listBrandReturns: vi.fn().mockResolvedValue({}),
    readBrandReturn: vi.fn().mockResolvedValue({}),
    listReserveRequests: vi.fn().mockResolvedValue({}),
    readActivityCsv: vi.fn(),
  };
  const controller = new BrandPayoutsController(
    legacy as never,
    authorization as never,
    query as never,
  );
  return { controller, legacy, authorization, query };
}

describe("BrandPayoutsController P1 negotiation and authorization", () => {
  it("resolves current membership before serving the explicitly negotiated V2 root", async () => {
    const { controller, legacy, authorization, query } = setup();
    const res = response();
    await expect(
      controller.getPayoutsHub(
        request(),
        BRAND_PAYOUTS_V2_MEDIA_TYPE,
        res as never,
      ),
    ).resolves.toMatchObject({ schema_version: "brand-payouts.v2" });
    expect(authorization.resolve).toHaveBeenCalledOnce();
    expect(query.readOverview).toHaveBeenCalledWith(
      expect.objectContaining({ authorization: ownerScope }),
    );
    expect(legacy.getPayoutsHub).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Vary", "Accept");
  });

  it("keeps the legacy root only for an authorized Owner or Finance member", async () => {
    const owner = setup(ownerScope);
    await expect(
      owner.controller.getPayoutsHub(
        request(),
        "application/json",
        response() as never,
      ),
    ).resolves.toEqual({ legacy: true });
    expect(owner.legacy.getPayoutsHub).toHaveBeenCalledOnce();

    const manager = setup(managerScope);
    await expect(
      manager.controller.getPayoutsHub(
        request(),
        "application/json",
        response() as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.legacy.getPayoutsHub).not.toHaveBeenCalled();
  });

  it("requires the exact V2 media type on JSON subresources before querying", async () => {
    const { controller, authorization, query } = setup();
    await expect(
      controller.listActivity(
        request(),
        "application/json",
        { limit: 50 },
        response() as never,
      ),
    ).rejects.toBeInstanceOf(NotAcceptableException);
    expect(authorization.resolve).not.toHaveBeenCalled();
    expect(query.listActivity).not.toHaveBeenCalled();
  });

  it("authorizes before every V2 protected query", async () => {
    const { controller, authorization, query } = setup();
    const res = response();
    await controller.listObligations(
      request(),
      BRAND_PAYOUTS_V2_MEDIA_TYPE,
      { limit: 25 },
      res as never,
    );
    expect(authorization.resolve).toHaveBeenCalledOnce();
    expect(query.listObligations).toHaveBeenCalledWith(
      expect.objectContaining({ authorization: ownerScope, limit: 25 }),
    );
  });

  it("requires explicit CSV negotiation and denies Campaign Manager before export", async () => {
    const missing = setup(ownerScope);
    await expect(
      missing.controller.readActivityCsv(
        request(),
        "*/*",
        {
          from: "2026-09-01T00:00:00.000Z",
          to: "2026-09-02T00:00:00.000Z",
        },
        response() as never,
      ),
    ).rejects.toBeInstanceOf(NotAcceptableException);
    expect(missing.authorization.resolve).not.toHaveBeenCalled();

    const manager = setup(managerScope);
    await expect(
      manager.controller.readActivityCsv(
        request(),
        "text/csv",
        {
          from: "2026-09-01T00:00:00.000Z",
          to: "2026-09-02T00:00:00.000Z",
        },
        response() as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.query.readActivityCsv).not.toHaveBeenCalled();
  });

  it("declares the static CSV route before the activity detail route", async () => {
    const source = await import("node:fs/promises").then(({ readFile }) =>
      readFile(
        "src/features/brand-payouts/brand-payouts.controller.ts",
        "utf8",
      ),
    );
    expect(source.indexOf('@Get("activity.csv")')).toBeLessThan(
      source.indexOf('@Get("activity/:activityId")'),
    );
  });
});
