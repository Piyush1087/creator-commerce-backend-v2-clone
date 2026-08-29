import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("BS-05 P2A financial producer boundaries", () => {
  it("wires exactly the approved billing lifecycle events", () => {
    const billing = [
      source("src/features/pricing/services/pricing-webhook.service.ts"),
      source("src/features/pricing/services/pricing-invoice.service.ts"),
      source("src/features/pricing/services/subscription-lifecycle.service.ts"),
      source(
        "src/features/pricing/schedulers/subscription-lifecycle-reconciliation.scheduler.ts",
      ),
    ].join("\n");
    for (const event of [
      "billing.subscription_payment_failed",
      "billing.subscription_payment_recovered",
      "billing.trial_expired",
      "billing.subscription_halted",
      "billing.cancellation_scheduled",
      "billing.cancellation_effective",
      "billing.cancellation_reactivated",
      "billing.invoice_ready",
    ]) {
      expect(billing).toContain(`eventType: \"${event}\"`);
    }
  });

  it("wires only the approved escrow transitions", () => {
    const escrow = [
      source(
        "src/features/brand-escrow/services/brand-escrow-webhook.service.ts",
      ),
      source(
        "src/features/brand-escrow/services/brand-escrow-interlock.service.ts",
      ),
      source("src/features/collaboration/services/collaboration.service.ts"),
    ].join("\n");
    for (const event of [
      "escrow.funding_credited",
      "escrow.collaboration_awaiting_funds",
      "escrow.collaboration_refunded",
    ]) {
      expect(escrow).toContain(`eventType: \"${event}\"`);
    }
    expect(escrow).not.toContain("escrow.collaboration_reserved");
    expect(escrow).not.toContain("escrow.funding_attempt_failed");
  });

  it("uses the transaction-aware enqueue seam for same-transaction producers", () => {
    const transactional = [
      source("src/features/pricing/services/pricing-webhook.service.ts"),
      source("src/features/pricing/services/pricing-invoice.service.ts"),
      source("src/features/pricing/services/subscription-lifecycle.service.ts"),
      source(
        "src/features/pricing/schedulers/subscription-lifecycle-reconciliation.scheduler.ts",
      ),
      source(
        "src/features/brand-escrow/services/brand-escrow-webhook.service.ts",
      ),
      source(
        "src/features/brand-escrow/services/brand-escrow-interlock.service.ts",
      ),
    ].join("\n");
    expect(transactional).toContain("enqueueWithinTransaction");
    expect(transactional).not.toContain("notificationJob.create");
  });

  it("keeps awaiting-funds actor dispatch after the reserve call", () => {
    const collaboration = source(
      "src/features/collaboration/services/collaboration.service.ts",
    );
    expect(collaboration.indexOf("executeStage2Lock")).toBeLessThan(
      collaboration.indexOf('eventType: "escrow.collaboration_awaiting_funds"'),
    );
    expect(collaboration).toContain("triggerUserId: user.id");
  });
});
