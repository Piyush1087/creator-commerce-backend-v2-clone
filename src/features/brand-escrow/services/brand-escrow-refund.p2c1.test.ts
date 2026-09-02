import { GoneException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { BrandEscrowInterlockService } from "./brand-escrow-interlock.service";

describe("BS09 legacy collaboration refund compatibility boundary", () => {
  it("returns 410 without opening a transaction or mutating financial state", async () => {
    const prisma = {
      $transaction: vi.fn(),
      brandEscrowVault: { update: vi.fn() },
      collaborationEscrowLock: { update: vi.fn() },
      escrowTransactionLedger: { create: vi.fn() },
    };
    const service = new BrandEscrowInterlockService(prisma as never);

    const result = service.executeAutomatedRefund({
      collaborationId: "collab-1",
      reasonCode: "MUTUAL_TERMINATION",
      diagnosticNotes: "legacy caller",
    });

    await expect(result).rejects.toBeInstanceOf(GoneException);
    await expect(result).rejects.toThrow(
      "canonical Collaboration financial resolution is required",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.brandEscrowVault.update).not.toHaveBeenCalled();
    expect(prisma.collaborationEscrowLock.update).not.toHaveBeenCalled();
    expect(prisma.escrowTransactionLedger.create).not.toHaveBeenCalled();
  });
});
