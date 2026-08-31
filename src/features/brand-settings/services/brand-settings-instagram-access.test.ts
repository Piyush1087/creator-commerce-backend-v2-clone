import { ForbiddenException } from "@nestjs/common";
import { BrandRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { BrandSettingsAccessService } from "./brand-settings-access.service";

describe("Brand Settings Instagram role matrix", () => {
  const service = new BrandSettingsAccessService({} as never, {} as never);

  it("allows the Owner full Instagram authority", () => {
    for (const action of [
      "READ",
      "INITIAL_CONNECT",
      "SAME_ID_RECONNECT",
      "CONTROLLED_ACCOUNT_CHANGE",
      "LEGACY_IDENTITY_RECONCILIATION",
      "DISCONNECT",
      "DELETE_MY_DATA",
    ] as const) {
      expect(() =>
        service.assertInstagramAction(BrandRole.BRAND_OWNER, action),
      ).not.toThrow();
    }
  });

  it("limits Campaign Manager to read and same-ID reconnect", () => {
    expect(() =>
      service.assertInstagramAction(BrandRole.CAMPAIGN_MANAGER, "READ"),
    ).not.toThrow();
    expect(() =>
      service.assertInstagramAction(
        BrandRole.CAMPAIGN_MANAGER,
        "SAME_ID_RECONNECT",
      ),
    ).not.toThrow();
    for (const action of [
      "INITIAL_CONNECT",
      "CONTROLLED_ACCOUNT_CHANGE",
      "LEGACY_IDENTITY_RECONCILIATION",
      "DISCONNECT",
      "DELETE_MY_DATA",
    ] as const) {
      expect(() =>
        service.assertInstagramAction(BrandRole.CAMPAIGN_MANAGER, action),
      ).toThrow(ForbiddenException);
    }
  });

  it("makes Finance read-only", () => {
    expect(() =>
      service.assertInstagramAction(BrandRole.FINANCE_ADMIN, "READ"),
    ).not.toThrow();
    for (const action of [
      "INITIAL_CONNECT",
      "SAME_ID_RECONNECT",
      "CONTROLLED_ACCOUNT_CHANGE",
      "LEGACY_IDENTITY_RECONCILIATION",
      "DISCONNECT",
      "DELETE_MY_DATA",
    ] as const) {
      expect(() =>
        service.assertInstagramAction(BrandRole.FINANCE_ADMIN, action),
      ).toThrow(ForbiddenException);
    }
  });
});
