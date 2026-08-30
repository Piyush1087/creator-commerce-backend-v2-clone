import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const ZERO = new Decimal(0);

type FinancialAuthority = {
  totalEscrowLockedAmount: Decimal;
  netCreatorPayoutPool: Decimal;
};

@Injectable()
export class EscrowFinancialAllocationService {
  async assertCreatorAllocation(
    tx: Prisma.TransactionClient,
    collaborationId: string,
    authority: FinancialAuthority,
    requestedAmount: Decimal,
  ) {
    const ownership = await this.readEconomicOwnership(tx, collaborationId);
    if (
      ownership.creator
        .add(requestedAmount)
        .greaterThan(authority.netCreatorPayoutPool)
    ) {
      throw new ConflictException(
        "Cumulative Creator payout instructions exceed the canonical Creator pool",
      );
    }
    this.assertLockedAuthority(
      ownership.total.add(requestedAmount),
      authority.totalEscrowLockedAmount,
    );
  }

  async assertRefundAllocation(
    tx: Prisma.TransactionClient,
    collaborationId: string,
    authority: FinancialAuthority,
    requestedAmount: Decimal,
  ) {
    const ownership = await this.readEconomicOwnership(tx, collaborationId);
    this.assertLockedAuthority(
      ownership.total.add(requestedAmount),
      authority.totalEscrowLockedAmount,
    );
  }

  private assertLockedAuthority(allocated: Decimal, authority: Decimal) {
    if (allocated.greaterThan(authority)) {
      throw new ConflictException(
        "Combined financial instructions exceed the Collaboration locked authority",
      );
    }
  }

  private async readEconomicOwnership(
    tx: Prisma.TransactionClient,
    collaborationId: string,
  ) {
    const [obligations, refunds, legacyLedger] = await Promise.all([
      tx.creatorPayoutObligation.findMany({
        where: { collaborationId },
        select: {
          entitlementAmount: true,
          transfers: {
            select: {
              reversals: {
                where: { state: "PROCESSED" },
                select: { amount: true },
              },
            },
          },
        },
      }),
      tx.collaborationRefundInstruction.aggregate({
        where: { collaborationId },
        _sum: { amount: true },
      }),
      tx.escrowTransactionLedger.findMany({
        where: {
          collaborationId,
          transactionStatus: { in: ["CLEARED", "CREDITED"] },
          transactionType: {
            in: [
              "CREATOR_PAYOUT",
              "TRANCHE_ADVANCE_RELEASE",
              "TRANCHE_FINAL_RELEASE",
              "PLATFORM_COMMISSION",
              "GST",
              "PLATFORM_FEE_CAPTURE",
              "TDS_BUFFER_REVERSAL",
              "COLLAB_REFUND",
              "REVERSAL_CORRECTION",
            ],
          },
        },
        select: {
          transactionType: true,
          amount: true,
          idempotencyKey: true,
        },
      }),
    ]);

    const creatorObligations = obligations.reduce((total, obligation) => {
      const confirmedReversal = obligation.transfers.reduce(
        (transferTotal, transfer) =>
          transfer.reversals.reduce(
            (reversalTotal, reversal) => reversalTotal.add(reversal.amount),
            transferTotal,
          ),
        ZERO,
      );
      const remaining = Decimal.max(
        ZERO,
        obligation.entitlementAmount.sub(confirmedReversal),
      );
      return total.add(remaining);
    }, ZERO);

    let legacyCreator = ZERO;
    let legacyCreatorReversals = ZERO;
    let legacyOther = ZERO;
    for (const entry of legacyLedger) {
      if (
        [
          "CREATOR_PAYOUT",
          "TRANCHE_ADVANCE_RELEASE",
          "TRANCHE_FINAL_RELEASE",
        ].includes(entry.transactionType)
      ) {
        legacyCreator = legacyCreator.add(entry.amount);
      } else if (entry.transactionType === "REVERSAL_CORRECTION") {
        legacyCreatorReversals = legacyCreatorReversals.add(entry.amount);
      } else if (
        entry.transactionType !== "COLLAB_REFUND" ||
        !entry.idempotencyKey.startsWith("collab-refund-instruction:")
      ) {
        legacyOther = legacyOther.add(entry.amount);
      }
    }

    const creator = creatorObligations.add(
      Decimal.max(ZERO, legacyCreator.sub(legacyCreatorReversals)),
    );
    const refund = refunds._sum.amount ?? ZERO;
    return {
      creator,
      total: creator.add(refund).add(legacyOther),
    };
  }
}
