import { describe, expect, it } from "vitest";

import { FailClosedCreatorPayoutProviderService } from "./services/fail-closed-creator-payout-provider.service";
import { kolkataPaymentDueAt } from "./utils/kolkata-due-date";

describe("Brand Payouts Wave B frozen boundaries", () => {
  it.each([
    ["NET_7", "2026-09-14T18:30:00.000Z"],
    ["NET_15", "2026-09-22T18:30:00.000Z"],
    ["NET_30", "2026-10-07T18:30:00.000Z"],
    ["NET_45", "2026-10-22T18:30:00.000Z"],
    ["NET_60", "2026-11-06T18:30:00.000Z"],
  ] as const)(
    "derives %s from the immutable Kolkata instant",
    (term, expected) => {
      expect(
        kolkataPaymentDueAt(
          new Date("2026-09-07T18:30:00.000Z"),
          term,
        ).toISOString(),
      ).toBe(expected);
    },
  );

  it("keeps the production provider unavailable without invoking an SDK/client", async () => {
    const provider = new FailClosedCreatorPayoutProviderService();
    await expect(provider.readCapabilities()).resolves.toMatchObject({
      availability: "UNAVAILABLE",
      transferCreate: false,
      transferRead: false,
      reversalRequest: false,
    });
    expect(provider.methodCounts).toEqual({
      readCapabilities: 1,
      createTransfer: 0,
      readTransfer: 0,
      requestReversal: 0,
    });
  });
});
