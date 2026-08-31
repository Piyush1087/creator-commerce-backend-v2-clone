import { describe, expect, it } from "vitest";

import { RazorpayRouteAdapter } from "./razorpay-route.adapter";
import { RouteProviderGateError } from "./razorpay-route.types";

describe("Razorpay Route runtime capability gate", () => {
  it("fails closed instead of falling back to RazorpayX", async () => {
    const adapter = new RazorpayRouteAdapter();
    await expect(
      adapter.createTransfer({
        linkedAccountId: "acc_synthetic",
        amountMinor: 100,
        currency: "INR",
        idempotencyKey: "synthetic-key",
        referenceId: "instruction-synthetic",
        onHold: false,
      }),
    ).rejects.toMatchObject<RouteProviderGateError>({
      code: "PROVIDER_CAPABILITY_UNAVAILABLE",
      capability: "DIRECT_TRANSFER",
    });
  });
});
