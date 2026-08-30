import { Decimal } from "@prisma/client/runtime/library";
import { describe, expect, it, vi } from "vitest";

import { CreatorPayoutObligationService } from "./creator-payout-obligation.service";

describe("Creator payout settlement instruction identity", () => {
  const instruction = {
    instructionId: "resolution:collab-1:full",
    collaborationId: "collab-1",
    brandProfileId: "brand-1",
    creatorProfileId: "creator-1",
    obligationType: "FULL" as const,
    entitlementAmount: new Decimal(73_456),
    currency: "INR",
    issuedAt: new Date("2026-01-01T00:00:00Z"),
  };

  const harness = (existing: Record<string, unknown>) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      creatorPayoutObligation: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      collaboration: { findUnique: vi.fn() },
    };
    return {
      tx,
      service: new CreatorPayoutObligationService(
        {
          $transaction: (callback: (client: typeof tx) => unknown) =>
            callback(tx),
        } as never,
        {} as never,
      ),
    };
  };

  it("returns the same obligation for an identical immutable instruction", async () => {
    const existing = {
      id: "obligation-1",
      settlementInstructionId: instruction.instructionId,
      collaborationId: instruction.collaborationId,
      brandProfileId: instruction.brandProfileId,
      creatorProfileId: instruction.creatorProfileId,
      obligationType: instruction.obligationType,
      entitlementAmount: instruction.entitlementAmount,
      currency: instruction.currency,
    };
    const { service, tx } = harness(existing);
    await expect(
      service.consumeSettlementInstruction(instruction),
    ).resolves.toBe(existing);
    expect(tx.collaboration.findUnique).not.toHaveBeenCalled();
  });

  it("rejects semantic identity reuse with different economics", async () => {
    const { service } = harness({
      settlementInstructionId: instruction.instructionId,
      collaborationId: instruction.collaborationId,
      brandProfileId: instruction.brandProfileId,
      creatorProfileId: instruction.creatorProfileId,
      obligationType: instruction.obligationType,
      entitlementAmount: new Decimal(1),
      currency: instruction.currency,
    });
    await expect(
      service.consumeSettlementInstruction(instruction),
    ).rejects.toThrow(
      "Settlement instruction identity was reused with different economics",
    );
  });
});
