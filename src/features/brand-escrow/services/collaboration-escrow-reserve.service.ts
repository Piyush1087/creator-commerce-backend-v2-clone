import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { VaultRowLock } from "../types";

export type CollaborationEscrowReserveInput = {
  collaborationId: string;
  brandProfileId: string;
  currency: string;
  creatorGrossFee: Prisma.Decimal;
  platformCommissionAmount: Prisma.Decimal;
  platformCommissionGstAmount: Prisma.Decimal;
  requiredSecuredAmount: Prisma.Decimal;
};

export type CollaborationEscrowReserveResult =
  | {
      status: "RESERVED";
      escrowLockRef: string;
      confirmedAmount: Prisma.Decimal;
    }
  | {
      status: "INSUFFICIENT_AVAILABLE_BALANCE";
      availableAmount: Prisma.Decimal;
      shortfallAmount: Prisma.Decimal;
    };

@Injectable()
export class CollaborationEscrowReserveService {
  constructor(private readonly prisma: PrismaService) {}

  reserveFunds(input: CollaborationEscrowReserveInput) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<VaultRowLock[]>`
        SELECT vault_id, brand_id, total_pooled_balance, locked_campaign_funds, available_balance, currency
        FROM brand_escrow_vaults
        WHERE brand_id = ${input.brandProfileId}
        FOR UPDATE
      `;
      if (!rows.length) {
        throw new NotFoundException(
          "Escrow vault not initialized for this Brand",
        );
      }
      const vault = rows[0];
      const vaultId = String(vault.vault_id);
      const currency = String(vault.currency).toUpperCase();
      if (currency !== input.currency.toUpperCase()) {
        throw new Error(
          "Escrow vault currency does not match Collaboration currency",
        );
      }

      const existing = await tx.collaborationEscrowLock.findUnique({
        where: { collaborationId: input.collaborationId },
      });
      if (existing) {
        if (
          !existing.totalEscrowLockedAmount.equals(input.requiredSecuredAmount)
        ) {
          throw new Error(
            "Existing Escrow lock conflicts with locked Collaboration terms",
          );
        }
        return {
          status: "RESERVED" as const,
          escrowLockRef: existing.id,
          confirmedAmount: existing.totalEscrowLockedAmount,
        };
      }

      const available = new Prisma.Decimal(vault.available_balance);
      if (available.lessThan(input.requiredSecuredAmount)) {
        return {
          status: "INSUFFICIENT_AVAILABLE_BALANCE" as const,
          availableAmount: available,
          shortfallAmount: input.requiredSecuredAmount.minus(available),
        };
      }

      const updated = await tx.brandEscrowVault.updateMany({
        where: {
          id: vaultId,
          availableBalance: { gte: input.requiredSecuredAmount },
        },
        data: {
          availableBalance: { decrement: input.requiredSecuredAmount },
          lockedCampaignFunds: { increment: input.requiredSecuredAmount },
        },
      });
      if (updated.count !== 1) {
        throw new Error("Escrow reserve lost its concurrent balance lock");
      }
      const lock = await tx.collaborationEscrowLock.create({
        data: {
          collaborationId: input.collaborationId,
          brandProfileId: input.brandProfileId,
          grossCreatorQuote: input.creatorGrossFee,
          platformCommissionFee: input.platformCommissionAmount,
          platformCommissionGst: input.platformCommissionGstAmount,
          totalEscrowLockedAmount: input.requiredSecuredAmount,
          expectedTdsPercentage: new Prisma.Decimal(0),
          calculatedTdsDeduction: new Prisma.Decimal(0),
          netCreatorPayoutPool: input.creatorGrossFee,
        },
      });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId,
          brandProfileId: input.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "CONTRACT_LOCK_RESERVE",
          amount: input.requiredSecuredAmount,
          currency,
          gatewayProcessingSurcharge: new Prisma.Decimal(0),
          gatewaySurchargeGst: new Prisma.Decimal(0),
          idempotencyKey: `collaboration-reserve:${input.collaborationId}`,
          transactionStatus: "CLEARED",
        },
      });
      return {
        status: "RESERVED" as const,
        escrowLockRef: lock.id,
        confirmedAmount: lock.totalEscrowLockedAmount,
      };
    });
  }
}
