import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

const contractSources = [
  "src/features/brand-payouts/contracts/brand-payouts-authorization.contract.ts",
  "src/features/brand-payouts/contracts/brand-payouts-v2.contract.ts",
  "src/features/brand-payouts/ports/collaboration-payout-instruction.port.ts",
  "src/features/brand-payouts/ports/brand-payouts-read.port.ts",
  "src/features/brand-payouts/ports/creator-payout-provider.port.ts",
  "src/features/brand-payouts/ports/creator-payout-readiness.port.ts",
] as const;

describe("Brand Payouts P0 architecture boundaries", () => {
  it("keeps the provider-neutral contracts independent of persistence and financial services", () => {
    const source = contractSources.map(read).join("\n");

    for (const forbidden of [
      "@prisma/client",
      "PrismaService",
      "BrandEscrowService",
      "BrandReturnService",
      "Razorpay",
      "@Controller",
      "@Post",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("exposes only read operations on the P0 application port", () => {
    const source = read(
      "src/features/brand-payouts/ports/brand-payouts-read.port.ts",
    );

    expect(source).toContain("interface BrandPayoutsQueryPortV2");
    expect(source).toContain("readOverview(");
    expect(source).toContain("listActivity(");
    expect(source).toContain("listObligations(");
    expect(source).toContain("readObligation(");
    expect(source).toContain("readActivity(");
    expect(source).toContain("listBrandReturns(");
    expect(source).toContain("readBrandReturn(");
    expect(source).toContain("listReserveRequests(");
    expect(source).toContain("readActivityCsv(");
    for (const forbidden of [
      "createTransfer(",
      "approveReserve(",
      "requestBrandReturn(",
      "addFunds(",
      "release(",
      "reverse(",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("wires only the accepted P1 read port beside the legacy fallback", () => {
    const runtime = [
      "src/features/brand-payouts/brand-payouts.controller.ts",
      "src/features/brand-payouts/brand-payouts.module.ts",
      "src/features/brand-payouts/services/brand-payouts.service.ts",
    ]
      .map(read)
      .join("\n");

    expect(runtime).toContain("BrandPayoutsQueryPortV2");
    expect(runtime).toContain("negotiateBrandPayoutsRepresentation");
    expect(runtime).not.toContain("CreatorPayoutReadinessPort");
    expect(runtime).not.toContain("CreatorPayoutProviderPort");
    expect(runtime).not.toContain("CollaborationPayoutInstructionIntakePortV1");
    expect(runtime).not.toContain("@Post");
    expect(runtime).not.toContain("approveReserve");
    expect(runtime).not.toContain("createTransfer");
  });

  it("keeps the current Campaign Manager fallback explicitly fail closed", () => {
    const authorization = read(
      "src/features/brand-payouts/contracts/brand-payouts-authorization.contract.ts",
    );

    expect(authorization).toContain('kind: "NO_FINANCIAL_ROWS"');
    expect(authorization).toContain(
      'reason: "CANONICAL_ENTITY_SCOPE_UNAVAILABLE"',
    );
    expect(authorization).not.toContain("SAME_BRAND_FALLBACK");
  });

  it("freezes narrow readiness, normalized execution, and immutable C-04 ports without adapters", () => {
    const source = contractSources.map(read).join("\n");

    expect(source).toContain("interface CreatorPayoutReadinessPort");
    expect(source).toContain("interface CreatorPayoutProviderPort");
    expect(source).toContain(
      "interface CollaborationPayoutInstructionIntakePortV1",
    );
    expect(source).toContain("CollaborationPayoutEntitlementInstructionV1");
    expect(source).toContain("CollaborationFinancialRecoveryInstructionV1");
    expect(source.toLowerCase()).not.toContain("razorpay");
    expect(source).not.toContain("FailClosedCreatorPayoutProvider");
  });
});
