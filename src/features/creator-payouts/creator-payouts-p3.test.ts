import { readFileSync } from "node:fs";

import type { PrismaService } from "../../prisma/prisma.service";
import { describe, expect, it } from "vitest";

import { PrismaCreatorPayoutMethodSummaryService } from "../creator-settings/payouts/prisma-creator-payout-method-summary.service";

const base = {
  id: "destination-1",
  version: 1,
  maskedDisplay: "•••• 1234",
  destinationType: "BANK_ACCOUNT" as const,
  countryCode: "IN",
  currencyCode: "INR",
  isPrimary: true,
  state: "CONFIGURED_UNVERIFIED" as const,
  reasonCode: null,
  updatedAt: new Date("2026-09-08T12:00:00.000Z"),
};

describe("C06 P3 history and C05 payout method boundary", () => {
  it.each([
    ["NONE", []],
    ["CURRENT", [base]],
    [
      "ATTENTION",
      [{ ...base, state: "NEEDS_ATTENTION", reasonCode: "DETAILS_CHANGED" }],
    ],
    ["DISABLED", [{ ...base, isPrimary: false, state: "DISABLED" }]],
    [
      "UNSUPPORTED",
      [
        {
          ...base,
          destinationType: "PAYPAL",
          countryCode: "US",
          currencyCode: "USD",
        },
      ],
    ],
    ["AMBIGUOUS", [base, { ...base, id: "destination-2", version: 2 }]],
    [
      "STALE",
      [
        base,
        {
          ...base,
          id: "destination-2",
          version: 2,
          isPrimary: false,
          state: "DISABLED",
        },
      ],
    ],
  ] as const)(
    "projects the C05 %s state without secrets",
    async (status, rows) => {
      const service = new PrismaCreatorPayoutMethodSummaryService({
        creatorPayoutDestination: { findMany: async () => rows },
      } as unknown as PrismaService);
      const result = await service.read("creator-1", true);
      expect(result.status).toBe(status);
      expect(result.manage_settings_href).toBe("/creator/settings/payouts");
      expect(JSON.stringify(result)).not.toMatch(
        /beneficiary|account_number|routing|encrypted|provider|kyc|legal/i,
      );
    },
  );

  it("uses an explicit C05 select that cannot retrieve prohibited fields", () => {
    const source = readFileSync(
      "src/features/creator-settings/payouts/prisma-creator-payout-method-summary.service.ts",
      "utf8",
    );
    expect(source).toContain("select:");
    expect(source).not.toMatch(
      /beneficiaryName|secretPayloadEncrypted|encryptionKeyVersion|providerMappings|payeeType/,
    );
    expect(source).not.toMatch(/\.(create|update|delete|upsert)\s*\(/);
  });

  it("projects fixed-as-of history without a history table or unsafe output fields", () => {
    const source = readFileSync(
      "src/features/creator-payouts/services/creator-payouts-history-projection.service.ts",
      "utf8",
    );
    expect(source).toMatch(/creatorPayoutObligation\.findMany/);
    expect(source).toMatch(/routeTransferAttempt\.findMany/);
    expect(source).toMatch(/escrowTransactionLedger\.findMany/);
    expect(source).toContain("reconciledReceipts");
    expect(source).toContain("reversals");
    expect(source).not.toMatch(
      /history(Table|Record)|providerState|diagnosticPayload|errorDiagnosticPayload|Brand Return|reserve approval/i,
    );
    expect(source).not.toMatch(
      /\.(create|update|delete|upsert|executeRaw)\s*\(/,
    );
  });
});
