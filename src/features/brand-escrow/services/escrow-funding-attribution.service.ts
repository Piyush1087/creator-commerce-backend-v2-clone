import { ConflictException, Injectable } from "@nestjs/common";
import type {
  EscrowFundingProvenanceStatus,
  EscrowFundingLotSourceType,
  Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const ZERO = new Decimal(0);

type CreditEvidence = {
  loadId: string;
  vaultId: string;
  brandProfileId: string;
  sourceType: EscrowFundingLotSourceType;
  currency: string;
  requestedPrincipal: Decimal;
  creditedPrincipal: Decimal;
  capturedAmount?: Decimal | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  providerPaymentCaptured?: boolean | null;
  provenanceStatus: EscrowFundingProvenanceStatus;
  provenanceDiagnostic?: Prisma.InputJsonValue;
  creditedAt: Date;
};

@Injectable()
export class EscrowFundingAttributionService {
  async recordFundingCredit(
    tx: Prisma.TransactionClient,
    evidence: CreditEvidence,
  ) {
    const existing = await tx.escrowFundingLot.findUnique({
      where: { fundingLoadId: evidence.loadId },
    });
    if (existing) {
      if (
        existing.vaultId !== evidence.vaultId ||
        existing.brandProfileId !== evidence.brandProfileId ||
        existing.currency !== evidence.currency ||
        !existing.creditedPrincipal.equals(evidence.creditedPrincipal)
      ) {
        throw new ConflictException(
          "Funding credit evidence does not match its existing economic lot",
        );
      }
      if (existing.provenanceStatus === "PROVEN_SOURCE") return existing;
      return tx.escrowFundingLot.update({
        where: { id: existing.id },
        data: {
          capturedAmount: evidence.capturedAmount,
          providerRefundableAmount:
            evidence.provenanceStatus === "PROVEN_SOURCE"
              ? evidence.creditedPrincipal
              : ZERO,
          providerOrderId: evidence.providerOrderId,
          providerPaymentId: evidence.providerPaymentId,
          providerPaymentCaptured: evidence.providerPaymentCaptured,
          provenanceStatus: evidence.provenanceStatus,
          provenanceDiagnostic: evidence.provenanceDiagnostic,
        },
      });
    }

    return tx.escrowFundingLot.create({
      data: {
        vaultId: evidence.vaultId,
        brandProfileId: evidence.brandProfileId,
        fundingLoadId: evidence.loadId,
        sourceType: evidence.sourceType,
        provenanceStatus: evidence.provenanceStatus,
        currency: evidence.currency,
        requestedPrincipal: evidence.requestedPrincipal,
        creditedPrincipal: evidence.creditedPrincipal,
        capturedAmount: evidence.capturedAmount,
        providerRefundableAmount:
          evidence.provenanceStatus === "PROVEN_SOURCE"
            ? evidence.creditedPrincipal
            : ZERO,
        providerOrderId: evidence.providerOrderId,
        providerPaymentId: evidence.providerPaymentId,
        providerPaymentCaptured: evidence.providerPaymentCaptured,
        availableAmount: evidence.creditedPrincipal,
        economicAt: evidence.creditedAt,
        creditedAt: evidence.creditedAt,
        provenanceDiagnostic: evidence.provenanceDiagnostic,
      },
    });
  }

  async reserveAvailable(
    tx: Prisma.TransactionClient,
    input: {
      vaultId: string;
      brandProfileId: string;
      collaborationId: string;
      currency: string;
      amount: Decimal;
    },
  ): Promise<void> {
    const lots = await tx.escrowFundingLot.findMany({
      where: {
        vaultId: input.vaultId,
        currency: input.currency,
        availableAmount: { gt: ZERO },
      },
      orderBy: [{ economicAt: "asc" }, { id: "asc" }],
    });
    let remaining = input.amount;
    for (const lot of lots) {
      if (!remaining.greaterThan(0)) break;
      const allocated = Decimal.min(remaining, lot.availableAmount);
      await tx.escrowFundingLot.update({
        where: { id: lot.id },
        data: {
          availableAmount: { decrement: allocated },
          lockedAmount: { increment: allocated },
        },
      });
      await tx.collaborationFundingLotAllocation.upsert({
        where: {
          collaborationId_fundingLotId: {
            collaborationId: input.collaborationId,
            fundingLotId: lot.id,
          },
        },
        create: {
          collaborationId: input.collaborationId,
          fundingLotId: lot.id,
          reservedAmount: allocated,
          lockedAmount: allocated,
        },
        update: {
          reservedAmount: { increment: allocated },
          lockedAmount: { increment: allocated },
        },
      });
      remaining = remaining.sub(allocated);
    }
    if (remaining.greaterThan(0)) {
      throw new ConflictException(
        "Funding-lot AVAILABLE authority does not reconcile with the vault",
      );
    }
  }

  async releaseCollaborationLocked(
    tx: Prisma.TransactionClient,
    input: {
      vaultId: string;
      collaborationId: string;
      currency: string;
      amount: Decimal;
    },
  ): Promise<void> {
    await this.ensureLegacyCollaborationCapacity(tx, input);
    const allocations = await tx.collaborationFundingLotAllocation.findMany({
      where: {
        collaborationId: input.collaborationId,
        fundingLot: { vaultId: input.vaultId, currency: input.currency },
      },
      include: { fundingLot: true, payoutAllocations: true },
      orderBy: [{ fundingLot: { economicAt: "asc" } }, { fundingLotId: "asc" }],
    });
    let remaining = input.amount;
    for (const allocation of allocations) {
      if (!remaining.greaterThan(0)) break;
      const creatorClaim = allocation.payoutAllocations.reduce(
        (total, row) =>
          total.add(
            row.allocatedAmount.sub(row.consumedAmount).sub(row.reversedAmount),
          ),
        ZERO,
      );
      const releasable = Decimal.max(
        ZERO,
        allocation.lockedAmount.sub(creatorClaim),
      );
      const released = Decimal.min(remaining, releasable);
      if (!released.greaterThan(0)) continue;
      await tx.collaborationFundingLotAllocation.update({
        where: { id: allocation.id },
        data: {
          lockedAmount: { decrement: released },
          releasedAmount: { increment: released },
        },
      });
      await tx.escrowFundingLot.update({
        where: { id: allocation.fundingLotId },
        data: {
          lockedAmount: { decrement: released },
          availableAmount: { increment: released },
        },
      });
      remaining = remaining.sub(released);
    }
    if (remaining.greaterThan(0)) {
      throw new ConflictException(
        "Collaboration refund lacks exact unassigned source-lineage authority",
      );
    }
  }

  async allocateCreatorObligation(
    tx: Prisma.TransactionClient,
    input: {
      obligationId: string;
      vaultId: string;
      collaborationId: string;
      currency: string;
      amount: Decimal;
    },
  ): Promise<void> {
    await this.ensureLegacyCollaborationCapacity(tx, input);
    const allocations = await tx.collaborationFundingLotAllocation.findMany({
      where: {
        collaborationId: input.collaborationId,
        fundingLot: { vaultId: input.vaultId, currency: input.currency },
      },
      include: { fundingLot: true, payoutAllocations: true },
      orderBy: [{ fundingLot: { economicAt: "asc" } }, { fundingLotId: "asc" }],
    });
    let remaining = input.amount;
    for (const allocation of allocations) {
      if (!remaining.greaterThan(0)) break;
      const claimedLocked = allocation.payoutAllocations.reduce(
        (total, row) =>
          total.add(
            row.allocatedAmount.sub(row.consumedAmount).sub(row.reversedAmount),
          ),
        ZERO,
      );
      const unassigned = Decimal.max(
        ZERO,
        allocation.lockedAmount.sub(claimedLocked),
      );
      const assigned = Decimal.min(remaining, unassigned);
      if (!assigned.greaterThan(0)) continue;
      await tx.creatorPayoutFundingAllocation.create({
        data: {
          obligationId: input.obligationId,
          collaborationAllocationId: allocation.id,
          fundingLotId: allocation.fundingLotId,
          allocatedAmount: assigned,
        },
      });
      remaining = remaining.sub(assigned);
    }
    if (remaining.greaterThan(0)) {
      throw new ConflictException(
        "Creator obligation lacks exact source-lineage authority",
      );
    }
  }

  async consumeCreatorSettlement(
    tx: Prisma.TransactionClient,
    input: {
      obligationId: string;
      vaultId: string;
      collaborationId: string;
      currency: string;
      amount: Decimal;
    },
  ): Promise<void> {
    let allocations = await this.creatorAllocations(tx, input.obligationId);
    if (!allocations.length) {
      await this.allocateCreatorObligation(tx, input);
      allocations = await this.creatorAllocations(tx, input.obligationId);
    }
    let remaining = input.amount;
    for (const allocation of allocations) {
      if (!remaining.greaterThan(0)) break;
      const lockedClaim = Decimal.max(
        ZERO,
        allocation.allocatedAmount
          .sub(allocation.consumedAmount)
          .sub(allocation.reversedAmount),
      );
      const consumed = Decimal.min(remaining, lockedClaim);
      if (!consumed.greaterThan(0)) continue;
      await tx.creatorPayoutFundingAllocation.update({
        where: { id: allocation.id },
        data: { consumedAmount: { increment: consumed } },
      });
      await tx.collaborationFundingLotAllocation.update({
        where: { id: allocation.collaborationAllocationId },
        data: {
          lockedAmount: { decrement: consumed },
          consumedAmount: { increment: consumed },
        },
      });
      await tx.escrowFundingLot.update({
        where: { id: allocation.fundingLotId },
        data: {
          lockedAmount: { decrement: consumed },
          consumedAmount: { increment: consumed },
        },
      });
      remaining = remaining.sub(consumed);
    }
    if (remaining.greaterThan(0)) {
      throw new ConflictException(
        "Creator settlement lacks exact locked source-lineage authority",
      );
    }
  }

  async restoreCreatorReversal(
    tx: Prisma.TransactionClient,
    obligationId: string,
    amount: Decimal,
  ): Promise<void> {
    const allocations = await this.creatorAllocations(tx, obligationId);
    let remaining = amount;
    for (const allocation of allocations) {
      if (!remaining.greaterThan(0)) break;
      const restored = Decimal.min(remaining, allocation.consumedAmount);
      if (!restored.greaterThan(0)) continue;
      await tx.creatorPayoutFundingAllocation.update({
        where: { id: allocation.id },
        data: {
          consumedAmount: { decrement: restored },
          reversedAmount: { increment: restored },
        },
      });
      await tx.collaborationFundingLotAllocation.update({
        where: { id: allocation.collaborationAllocationId },
        data: {
          consumedAmount: { decrement: restored },
          lockedAmount: { increment: restored },
        },
      });
      await tx.escrowFundingLot.update({
        where: { id: allocation.fundingLotId },
        data: {
          consumedAmount: { decrement: restored },
          lockedAmount: { increment: restored },
        },
      });
      remaining = remaining.sub(restored);
    }
    if (remaining.greaterThan(0)) {
      throw new ConflictException(
        "Route reversal lacks exact consumed source-lineage authority",
      );
    }
  }

  private creatorAllocations(
    tx: Prisma.TransactionClient,
    obligationId: string,
  ) {
    return tx.creatorPayoutFundingAllocation.findMany({
      where: { obligationId },
      include: { fundingLot: true },
      orderBy: [{ fundingLot: { economicAt: "asc" } }, { fundingLotId: "asc" }],
    });
  }

  private async ensureLegacyCollaborationCapacity(
    tx: Prisma.TransactionClient,
    input: {
      vaultId: string;
      collaborationId: string;
      currency: string;
      amount: Decimal;
    },
  ): Promise<void> {
    const existing = await tx.collaborationFundingLotAllocation.aggregate({
      where: {
        collaborationId: input.collaborationId,
        fundingLot: { vaultId: input.vaultId, currency: input.currency },
      },
      _sum: { lockedAmount: true },
    });
    let missing = Decimal.max(
      ZERO,
      input.amount.sub(existing._sum.lockedAmount ?? ZERO),
    );
    if (!missing.greaterThan(0)) return;

    const legacyLots = await tx.escrowFundingLot.findMany({
      where: {
        vaultId: input.vaultId,
        currency: input.currency,
        provenanceStatus: "LEGACY_SOURCE_UNKNOWN",
        lockedAmount: { gt: ZERO },
      },
      include: { collaborationAllocations: true },
      orderBy: [{ economicAt: "asc" }, { id: "asc" }],
    });
    for (const lot of legacyLots) {
      if (!missing.greaterThan(0)) break;
      const assigned = lot.collaborationAllocations.reduce(
        (total, row) => total.add(row.lockedAmount),
        ZERO,
      );
      const unassigned = Decimal.max(ZERO, lot.lockedAmount.sub(assigned));
      const amount = Decimal.min(missing, unassigned);
      if (!amount.greaterThan(0)) continue;
      await tx.collaborationFundingLotAllocation.upsert({
        where: {
          collaborationId_fundingLotId: {
            collaborationId: input.collaborationId,
            fundingLotId: lot.id,
          },
        },
        create: {
          collaborationId: input.collaborationId,
          fundingLotId: lot.id,
          reservedAmount: amount,
          lockedAmount: amount,
        },
        update: {
          reservedAmount: { increment: amount },
          lockedAmount: { increment: amount },
        },
      });
      missing = missing.sub(amount);
    }
  }
}
