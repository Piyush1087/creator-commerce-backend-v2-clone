import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CollaborationPayoutMode,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import type {
  EscrowCurrency,
  EscrowTdsPercentage,
  VaultRowLock,
} from "../types";
import { EscrowComputationEngine } from "./escrow-computation.engine";
import { EscrowSubscriptionContextService } from "./escrow-subscription-context.service";

export interface ExecuteLockAllocationInput {
  collaborationId: string;
  brandProfileId: string;
  grossCreatorQuote: number;
  expectedTdsPercentage: EscrowTdsPercentage;
}

export interface ExecuteTrancheDisbursalInput {
  collaborationId: string;
  tranche: "ADVANCE_30" | "FINAL_70";
}

@Injectable()
export class BrandEscrowComputationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly computationEngine: EscrowComputationEngine,
    private readonly escrowBilling: EscrowSubscriptionContextService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
  ) {}

  async executeStage2Lock(
    input: ExecuteLockAllocationInput,
  ): Promise<Record<string, unknown>> {
    return this.executeCanonicalReserve(input);
    /* istanbul ignore next -- retained below only until P3 removes legacy payout coupling */
    await this.subscriptionCapabilities.assertCapability(
      input.brandProfileId,
      "ESCROW_RESERVE",
    );
    return this.prisma.$transaction(async (tx) => {
      const vault = await tx.brandEscrowVault.findUnique({
        where: { brandProfileId: input.brandProfileId },
      });

      if (!vault) {
        throw new NotFoundException(
          "Escrow vault not initialized for this brand",
        );
      }

      const collaboration = await tx.collaboration.findUnique({
        where: { id: input.collaborationId },
        include: { commercials: true },
      });

      if (!collaboration) {
        throw new NotFoundException("Collaboration not found");
      }

      if (collaboration.brandProfileId !== input.brandProfileId) {
        throw new BadRequestException(
          "Collaboration does not belong to this brand",
        );
      }

      if (collaboration.payoutMode !== CollaborationPayoutMode.ESCROW) {
        throw new BadRequestException(
          "Collaboration is not in ESCROW payout mode",
        );
      }

      const existingLock = await tx.collaborationEscrowLock.findUnique({
        where: { collaborationId: input.collaborationId },
      });

      if (existingLock) {
        throw new ConflictException(
          "An escrow lock already exists for this collaboration",
        );
      }

      const billingContext =
        await this.escrowBilling.assertEscrowBillingAuthorized(
          input.brandProfileId,
        );

      const metrics = this.computationEngine.calculateStructure({
        grossCreatorQuote: input.grossCreatorQuote,
        currency: vault.currency as EscrowCurrency,
        expectedTdsPercentage: input.expectedTdsPercentage,
        platformTakeRate: billingContext.platformTakeRate,
      });

      const projectedAggregateLock = vault.lockedCampaignFunds.add(
        metrics.totalEscrowLockedAmount,
      );
      if (
        projectedAggregateLock.greaterThan(
          new Decimal(billingContext.aggregateCap),
        )
      ) {
        throw new BadRequestException(
          `Transaction blocked: Active plan tier ${billingContext.tier} caps aggregate escrow locks at ${billingContext.aggregateCap}.`,
        );
      }

      if (vault.availableBalance.lessThan(metrics.totalEscrowLockedAmount)) {
        throw new BadRequestException(
          `Insufficient escrow balance. Required ${metrics.totalEscrowLockedAmount.toFixed(4)}, available ${vault.availableBalance.toFixed(4)}`,
        );
      }

      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          availableBalance: { decrement: metrics.totalEscrowLockedAmount },
          lockedCampaignFunds: { increment: metrics.totalEscrowLockedAmount },
        },
      });

      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: input.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "CONTRACT_LOCK_RESERVE",
          amount: metrics.totalEscrowLockedAmount,
          currency: vault.currency,
          idempotencyKey: randomUUID(),
          transactionStatus: "CLEARED",
        },
      });

      const lock = await tx.collaborationEscrowLock.create({
        data: {
          collaborationId: input.collaborationId,
          brandProfileId: input.brandProfileId,
          grossCreatorQuote: metrics.grossCreatorQuote,
          platformCommissionFee: metrics.platformCommissionFee,
          platformCommissionGst: metrics.platformCommissionGst,
          totalEscrowLockedAmount: metrics.totalEscrowLockedAmount,
          expectedTdsPercentage: new Decimal(input.expectedTdsPercentage),
          calculatedTdsDeduction: metrics.calculatedTdsDeduction,
          netCreatorPayoutPool: metrics.netCreatorPayoutPool,
        },
      });

      if (collaboration.commercials) {
        await tx.collaborationCommercial.update({
          where: { collaborationId: input.collaborationId },
          data: {
            escrowVaultId: vault.id,
            escrowStatus: CollaborationEscrowStatus.FUNDED,
            finalQuote: metrics.grossCreatorQuote,
            advance30Amount: metrics.netCreatorPayoutPool.mul(0.3),
            balance70Amount: metrics.netCreatorPayoutPool.mul(0.7),
          },
        });
      }

      return {
        lock_id: lock.id,
        collaboration_id: lock.collaborationId,
        gross_creator_quote: lock.grossCreatorQuote.toNumber(),
        platform_commission_fee: lock.platformCommissionFee.toNumber(),
        platform_commission_gst: lock.platformCommissionGst.toNumber(),
        total_escrow_locked_amount: lock.totalEscrowLockedAmount.toNumber(),
        calculated_tds_deduction: lock.calculatedTdsDeduction.toNumber(),
        net_creator_payout_pool: lock.netCreatorPayoutPool.toNumber(),
      };
    });
  }

  private async executeCanonicalReserve(input: ExecuteLockAllocationInput) {
    await this.subscriptionCapabilities.assertCapability(
      input.brandProfileId,
      "ESCROW_RESERVE",
    );
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<VaultRowLock[]>`
        SELECT vault_id, brand_id, total_pooled_balance, locked_campaign_funds,
               available_balance, currency
        FROM brand_escrow_vaults
        WHERE brand_id = ${input.brandProfileId}
        FOR UPDATE
      `;
      if (!rows.length) throw new NotFoundException("Escrow vault not found");
      const row = rows[0];
      const vaultId = String(row.vault_id);
      const currency = String(row.currency) as EscrowCurrency;
      const available = new Decimal(row.available_balance);
      const locked = new Decimal(row.locked_campaign_funds);
      const collaboration = await tx.collaboration.findUnique({
        where: { id: input.collaborationId },
        include: { commercials: true },
      });
      if (!collaboration)
        throw new NotFoundException("Collaboration not found");
      if (collaboration.brandProfileId !== input.brandProfileId)
        throw new BadRequestException(
          "Collaboration does not belong to this brand",
        );
      if (collaboration.payoutMode !== CollaborationPayoutMode.ESCROW)
        throw new BadRequestException(
          "Collaboration is not in ESCROW payout mode",
        );
      const gross = collaboration.commercials?.finalQuote;
      if (!gross || gross.lessThanOrEqualTo(0))
        throw new BadRequestException(
          "Accepted positive final quote is required",
        );
      const metrics = this.computationEngine.calculateStructure({
        grossCreatorQuote: gross.toNumber(),
        currency,
        expectedTdsPercentage: 0,
        platformTakeRate: 0.07,
      });
      const existing = await tx.collaborationEscrowLock.findUnique({
        where: { collaborationId: input.collaborationId },
      });
      if (existing) {
        if (
          !existing.grossCreatorQuote.equals(gross) ||
          !existing.totalEscrowLockedAmount.equals(
            metrics.totalEscrowLockedAmount,
          )
        )
          throw new ConflictException(
            "Existing reserve conflicts with accepted commercials",
          );
        const state = existing.lockReleasedViaRefund
          ? "REFUNDED"
          : existing.finalTrancheDisbursed
            ? collaboration.commercials!.advance30Amount.greaterThan(0) &&
              !existing.advanceTrancheDisbursed
              ? "PARTIAL_RELEASE"
              : "SETTLED"
            : existing.advanceTrancheDisbursed
              ? "PARTIAL_RELEASE"
              : "FUNDED";
        return this.mapReserve(existing, state, available);
      }
      if (collaboration.currentStage !== "STAGE_2_SECUREMENT")
        throw new BadRequestException(
          "Collaboration is not eligible for securement",
        );
      if (
        currency === "INR" &&
        locked.add(metrics.totalEscrowLockedAmount).greaterThan(500000)
      )
        throw new BadRequestException(
          "INR aggregate reserve cap of 500000 exceeded",
        );
      if (available.lessThan(metrics.totalEscrowLockedAmount)) {
        await tx.collaborationCommercial.update({
          where: { collaborationId: input.collaborationId },
          data: { escrowStatus: CollaborationEscrowStatus.AWAITING_FUNDS },
        });
        return {
          state: "AWAITING_FUNDS",
          collaboration_id: input.collaborationId,
          required_reserve: metrics.totalEscrowLockedAmount.toNumber(),
          available_balance: available.toNumber(),
          shortfall: metrics.totalEscrowLockedAmount.sub(available).toNumber(),
        };
      }
      await tx.brandEscrowVault.update({
        where: { id: vaultId },
        data: {
          availableBalance: { decrement: metrics.totalEscrowLockedAmount },
          lockedCampaignFunds: { increment: metrics.totalEscrowLockedAmount },
        },
      });
      const lock = await tx.collaborationEscrowLock.create({
        data: {
          collaborationId: input.collaborationId,
          brandProfileId: input.brandProfileId,
          grossCreatorQuote: gross,
          platformCommissionFee: metrics.platformCommissionFee,
          platformCommissionGst: metrics.platformCommissionGst,
          totalEscrowLockedAmount: metrics.totalEscrowLockedAmount,
          expectedTdsPercentage: new Decimal(0),
          calculatedTdsDeduction: new Decimal(0),
          netCreatorPayoutPool: gross,
        },
      });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId,
          brandProfileId: input.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "RESERVE",
          amount: metrics.totalEscrowLockedAmount,
          currency,
          idempotencyKey: `reserve:${input.collaborationId}`,
          transactionStatus: "CLEARED",
        },
      });
      await tx.collaborationCommercial.update({
        where: { collaborationId: input.collaborationId },
        data: {
          escrowVaultId: vaultId,
          escrowStatus: CollaborationEscrowStatus.FUNDED,
        },
      });
      return this.mapReserve(
        lock,
        "FUNDED",
        available.sub(metrics.totalEscrowLockedAmount),
      );
    });
  }

  private mapReserve(
    lock: {
      id: string;
      collaborationId: string;
      grossCreatorQuote: Decimal;
      platformCommissionFee: Decimal;
      platformCommissionGst: Decimal;
      totalEscrowLockedAmount: Decimal;
      calculatedTdsDeduction: Decimal;
      netCreatorPayoutPool: Decimal;
    },
    state: string,
    available: Decimal,
  ) {
    return {
      state,
      lock_id: lock.id,
      collaboration_id: lock.collaborationId,
      creator_gross: lock.grossCreatorQuote.toNumber(),
      platform_commission: lock.platformCommissionFee.toNumber(),
      commission_gst: lock.platformCommissionGst.toNumber(),
      total_reserve: lock.totalEscrowLockedAmount.toNumber(),
      calculated_tds_deduction: lock.calculatedTdsDeduction.toNumber(),
      creator_payout_pool: lock.netCreatorPayoutPool.toNumber(),
      available_balance: available.toNumber(),
    };
  }

  async executeTrancheDisbursal(input: ExecuteTrancheDisbursalInput) {
    throw new BadRequestException(
      "Legacy disbursal is disabled; use authenticated creator payout approval",
    );
    /* istanbul ignore next -- unreachable historical implementation retained for read compatibility */
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.collaborationEscrowLock.findUnique({
        where: { collaborationId: input.collaborationId },
      });

      if (!lock) {
        throw new NotFoundException("Escrow lock not found for collaboration");
      }

      const vault = await tx.brandEscrowVault.findUnique({
        where: { brandProfileId: lock.brandProfileId },
      });

      if (!vault) {
        throw new NotFoundException("Escrow vault not found");
      }

      const advanceMultiplier = new Decimal(0.3);
      const finalMultiplier = new Decimal(0.7);

      if (input.tranche === "ADVANCE_30") {
        if (lock.advanceTrancheDisbursed) {
          throw new ConflictException("Advance tranche already disbursed");
        }

        const advancePayoutAmount =
          lock.netCreatorPayoutPool.mul(advanceMultiplier);

        await tx.brandEscrowVault.update({
          where: { id: vault.id },
          data: {
            lockedCampaignFunds: { decrement: advancePayoutAmount },
            totalPooledBalance: { decrement: advancePayoutAmount },
          },
        });

        await tx.collaborationEscrowLock.update({
          where: { id: lock.id },
          data: { advanceTrancheDisbursed: true },
        });

        const ledger = await tx.escrowTransactionLedger.create({
          data: {
            vaultId: vault.id,
            brandProfileId: lock.brandProfileId,
            collaborationId: input.collaborationId,
            transactionType: "TRANCHE_ADVANCE_RELEASE",
            payoutTrancheTarget: "ADVANCE_30",
            amount: advancePayoutAmount,
            currency: vault.currency,
            idempotencyKey: randomUUID(),
            transactionStatus: "CLEARED",
          },
        });

        return {
          transaction_id: ledger.id,
          tranche: "ADVANCE_30",
          amount: advancePayoutAmount.toNumber(),
        };
      }

      if (lock.finalTrancheDisbursed) {
        throw new ConflictException("Final tranche already disbursed");
      }

      const finalPayoutAmount = lock.netCreatorPayoutPool.mul(finalMultiplier);
      const commissionCharge = lock.platformCommissionFee.add(
        lock.platformCommissionGst,
      );
      const totalRemainingDeductionFromLock = finalPayoutAmount
        .add(commissionCharge)
        .add(lock.calculatedTdsDeduction);

      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: totalRemainingDeductionFromLock },
          totalPooledBalance: {
            decrement: finalPayoutAmount.add(commissionCharge),
          },
          availableBalance: { increment: lock.calculatedTdsDeduction },
          tdsBufferBalance: { increment: lock.calculatedTdsDeduction },
        },
      });

      await tx.collaborationEscrowLock.update({
        where: { id: lock.id },
        data: { finalTrancheDisbursed: true },
      });

      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: lock.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "TRANCHE_FINAL_RELEASE",
          payoutTrancheTarget: "FINAL_70",
          amount: finalPayoutAmount,
          currency: vault.currency,
          idempotencyKey: randomUUID(),
          transactionStatus: "CLEARED",
        },
      });

      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: lock.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "PLATFORM_FEE_CAPTURE",
          payoutTrancheTarget: "PLATFORM_COMMISSION",
          amount: commissionCharge,
          currency: vault.currency,
          idempotencyKey: randomUUID(),
          transactionStatus: "CLEARED",
        },
      });

      const tdsLedger = await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: lock.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "TDS_BUFFER_REVERSAL",
          amount: lock.calculatedTdsDeduction,
          currency: vault.currency,
          idempotencyKey: randomUUID(),
          transactionStatus: "CLEARED",
        },
      });

      if (lock.collaborationId) {
        await tx.collaborationCommercial.updateMany({
          where: { collaborationId: lock.collaborationId },
          data: { escrowStatus: CollaborationEscrowStatus.SETTLED },
        });
      }

      return {
        transaction_id: tdsLedger.id,
        tranche: "FINAL_70",
        final_payout_amount: finalPayoutAmount.toNumber(),
        commission_captured: commissionCharge.toNumber(),
        tds_returned: lock.calculatedTdsDeduction.toNumber(),
      };
    });
  }
}
