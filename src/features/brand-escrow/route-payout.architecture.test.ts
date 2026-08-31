import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("BS-09 P3C2 Route payout architecture", () => {
  it("does not contain a RazorpayX payout implementation", () => {
    const module = source("src/features/brand-escrow/brand-escrow.module.ts");
    const adapter = source(
      "src/features/brand-escrow/services/razorpay-route.adapter.ts",
    );
    expect(module).not.toContain("RazorpayXPayoutAdapter");
    expect(adapter).not.toContain("/v1/payouts");
    expect(adapter).not.toContain("/v1/contacts");
    expect(adapter).not.toContain("/v1/fund_accounts");
  });

  it("removes stage-driven payout initiation", () => {
    const interlock = source(
      "src/features/brand-escrow/services/brand-escrow-interlock.service.ts",
    );
    expect(interlock).not.toContain('tranche: "ADVANCE_30"');
    expect(interlock).not.toContain("executeTrancheDisbursal({");
    const computation = source(
      "src/features/brand-escrow/services/brand-escrow-computation.service.ts",
    );
    expect(computation).toContain("legacyTrancheDisbursalDisabled = true");
    const collaboration = source(
      "src/features/collaboration/services/collaboration.service.ts",
    );
    const compliance = collaboration.slice(
      collaboration.indexOf("async verifyCompliance"),
      collaboration.indexOf("async submitReview"),
    );
    expect(compliance).not.toContain("isFinalPayoutReleased");
    expect(compliance).not.toContain("CollaborationEscrowStatus.SETTLED");
  });

  it("separates instruction, transfer, settlement and reversal persistence", () => {
    const schema = source("prisma/schema.prisma");
    expect(schema).toContain("model CreatorPayoutObligation");
    expect(schema).toContain("model RouteTransferAttempt");
    expect(schema).toContain("model RouteTransferReversal");
    expect(schema).toContain("settlementInstructionId");
    expect(schema).toContain("PARTIALLY_REVERSED");
    expect(schema).toContain("RELEASE_ELIGIBLE");
  });

  it("keeps reversal operations out of public controllers", () => {
    const controllers = [
      source("src/features/brand-escrow/brand-escrow.controller.ts"),
      source("src/features/brand-escrow/route-webhook.controller.ts"),
    ].join("\n");
    expect(controllers).not.toContain('@Post("reverse');
    expect(controllers).not.toContain('@Post("refund');
  });
});
