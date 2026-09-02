import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("BS04 architecture boundaries", () => {
  it("keeps withdrawal accounts, Collaboration refunds and Route reversals out of Brand Return execution", () => {
    const service = read(
      "src/features/brand-escrow/services/brand-return.service.ts",
    );
    expect(service).not.toContain("brandWithdrawalAccount");
    expect(service).not.toContain("collaborationRefundInstruction");
    expect(service).not.toContain("routeTransferReversal");
    expect(service).not.toContain("RazorpayRouteAdapter");
  });

  it("reuses canonical financial authorization for requests and read authority for projections", () => {
    const controller = read(
      "src/features/brand-escrow/brand-escrow.controller.ts",
    );
    expect(controller).toContain("this.workspaceAuth.assertFinancialMutation");
    expect(controller).toContain("this.workspaceAuth.resolveBrandContext");
  });

  it("ships one forward migration without modifying historical BS09 migrations", () => {
    const migration = read(
      "prisma/migrations/20260906120000_bs04_brand_return/migration.sql",
    );
    expect(migration).toContain("active_return_commitment");
    expect(migration).toContain("LEGACY_SOURCE_UNKNOWN");
    expect(migration).toContain(
      '"total_pooled_balance" = "available_balance" + "locked_campaign_funds" + "active_return_commitment"',
    );
    expect(migration).not.toContain('provider_payment_id" =');
  });

  it("preserves withdrawal Settings persistence while excluding it from source selection", () => {
    const settings = read(
      "src/features/brand-settings/services/brand-settings.service.ts",
    );
    const returns = read(
      "src/features/brand-escrow/services/brand-return.service.ts",
    );
    expect(settings).toContain("this.prisma.brandWithdrawalAccount.findFirst");
    expect(settings).toContain("this.prisma.brandWithdrawalAccount.create");
    expect(returns).not.toContain("brandWithdrawalAccount");
  });

  it("registers only bounded OWNER_FINANCE BS05 Brand Return notifications", () => {
    const registry = read(
      "src/features/notifications/config/notification-event-registry.ts",
    );
    for (const eventType of [
      "escrow.brand_return_action_required",
      "escrow.brand_return_partial",
      "escrow.brand_return_completed",
    ]) {
      const start = registry.indexOf(`\"${eventType}\": event({`);
      expect(start).toBeGreaterThan(-1);
      const definition = registry.slice(start, start + 500);
      expect(definition).toContain('category: "ESCROW_PAYOUTS"');
      expect(definition).toContain('recipientPolicy: "OWNER_FINANCE"');
    }
  });

  it("uses the vault row before source-specific financial authorities", () => {
    const paths = [
      [
        "src/features/brand-escrow/services/brand-escrow-computation.service.ts",
        "this.attribution.reserveAvailable",
      ],
      [
        "src/features/brand-escrow/services/brand-escrow-webhook.service.ts",
        "FROM escrow_funding_loads",
      ],
      [
        "src/features/brand-escrow/services/collaboration-refund-instruction.service.ts",
        "collaboration-refund-instruction:",
      ],
      [
        "src/features/brand-escrow/services/creator-payout-obligation.service.ts",
        "creator-payout-instruction:",
      ],
      [
        "src/features/brand-escrow/services/route-reconciliation.service.ts",
        "route-transfer-provider:",
      ],
    ] as const;
    for (const [path, sourceAuthority] of paths) {
      const service = read(path);
      const vaultLock = service.indexOf("FROM brand_escrow_vaults");
      expect(vaultLock).toBeGreaterThan(-1);
      expect(service.indexOf(sourceAuthority, vaultLock)).toBeGreaterThan(
        vaultLock,
      );
    }
  });
});
