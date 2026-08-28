import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import type { EscrowCurrency, VaultRowLock } from "../types";
import type { ExecuteLockAllocationInput } from "./brand-escrow-computation.service";
import { EscrowComputationEngine } from "./escrow-computation.engine";
import { EscrowSubscriptionContextService } from "./escrow-subscription-context.service";
import { IdempotencyManager } from "./idempotency.manager";

@Injectable()
export class BrandEscrowHardenedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotencyManager: IdempotencyManager,
    private readonly computationEngine: EscrowComputationEngine,
    private readonly escrowBilling: EscrowSubscriptionContextService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
  ) {}

  async secureCollaborationFundsHardened(
    input: ExecuteLockAllocationInput,
    idempotencyKey: string,
  ): Promise<Record<string, unknown>> {
    const routePath = "/api/v1/hardened-escrow/lock-funds";
    await this.subscriptionCapabilities.assertCapability(
      input.brandProfileId,
      "ESCROW_RESERVE",
    );
    await this.idempotencyManager.registerIntent(idempotencyKey, routePath);

    try {
      const operationResult = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<VaultRowLock[]>`
          SELECT vault_id, brand_id, total_pooled_balance, locked_campaign_funds, available_balance, currency
          FROM brand_escrow_vaults
          WHERE brand_id = ${input.brandProfileId}
          FOR UPDATE
        `;

        if (!rows.length) {
          throw new NotFoundException(
            "Escrow vault not initialized for this brand",
          );
        }

        const rawVault = rows[0];
        const vaultId = String(rawVault.vault_id);
        const availableBalance = new Decimal(rawVault.available_balance);
        const lockedFunds = new Decimal(rawVault.locked_campaign_funds);
        const currency = String(rawVault.currency) as EscrowCurrency;

        const billingContext =
          await this.escrowBilling.assertEscrowBillingAuthorized(
            input.brandProfileId,
          );

        const metrics = this.computationEngine.calculateStructure({
          grossCreatorQuote: input.grossCreatorQuote,
          currency,
          expectedTdsPercentage: input.expectedTdsPercentage,
          platformTakeRate: billingContext.platformTakeRate,
        });

        if (
          lockedFunds
            .add(metrics.totalEscrowLockedAmount)
            .greaterThan(new Decimal(billingContext.aggregateCap))
        ) {
          throw new BadRequestException(
            `Transaction blocked: Active plan tier ${billingContext.tier} caps aggregate escrow locks at ${billingContext.aggregateCap}.`,
          );
        }

        if (availableBalance.lessThan(metrics.totalEscrowLockedAmount)) {
          throw new BadRequestException(
            `Inadequate escrow balance. Deficit ${metrics.totalEscrowLockedAmount.sub(availableBalance).toFixed(4)}`,
          );
        }

        const targetNewAvailable = availableBalance.sub(
          metrics.totalEscrowLockedAmount,
        );
        const targetNewLocked = lockedFunds.add(
          metrics.totalEscrowLockedAmount,
        );

        await tx.$executeRaw`
          UPDATE brand_escrow_vaults
          SET available_balance = ${targetNewAvailable},
              locked_campaign_funds = ${targetNewLocked},
              updated_at = NOW()
          WHERE vault_id = ${vaultId}
        `;

        const transactionRecord = await tx.escrowTransactionLedger.create({
          data: {
            vaultId,
            brandProfileId: input.brandProfileId,
            collaborationId: input.collaborationId,
            transactionType: "CONTRACT_LOCK_RESERVE",
            amount: metrics.totalEscrowLockedAmount,
            currency,
            idempotencyKey,
            transactionStatus: "CLEARED",
          },
        });

        const lockRecord = await tx.collaborationEscrowLock.create({
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

        return {
          status: "COLLABORATION_ESCROW_SEALED",
          ledger_tracking_id: transactionRecord.id,
          allocated_lock_id: lockRecord.id,
          total_reserved_liquidity: metrics.totalEscrowLockedAmount.toNumber(),
          net_creator_allocation: metrics.netCreatorPayoutPool.toNumber(),
        };
      });

      await this.idempotencyManager.finalizeExecution(
        idempotencyKey,
        operationResult,
      );
      return operationResult;
    } catch (error) {
      await this.idempotencyManager.rollbackIntent(idempotencyKey);
      throw error;
    }
  }
}
