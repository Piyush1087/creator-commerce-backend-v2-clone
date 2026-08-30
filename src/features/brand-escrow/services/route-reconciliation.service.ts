import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import {
  normalizeReversalState,
  normalizeTransferState,
} from "./razorpay-route-state.normalizer";

const transferRank = {
  UNKNOWN: 0,
  CREATED: 1,
  PENDING: 2,
  PROCESSED: 3,
  PARTIALLY_REVERSED: 4,
  REVERSED: 5,
  FAILED: 5,
} as const;

@Injectable()
export class RouteReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async reconcileTransfer(input: {
    transferId: string;
    providerState: string;
    onHold?: boolean;
    onHoldUntil?: Date | null;
  }) {
    const incoming = normalizeTransferState(input.providerState);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer-provider:${input.transferId}`}))::text`;
      const transfer = await tx.routeTransferAttempt.findUnique({
        where: { transferId: input.transferId },
      });
      if (!transfer) throw new NotFoundException("Route transfer not found");
      const mayAdvance = transferRank[incoming] >= transferRank[transfer.state];
      const nextState = mayAdvance ? incoming : transfer.state;
      return tx.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: {
          state: nextState,
          providerState: input.providerState,
          onHold: input.onHold ?? transfer.onHold,
          onHoldUntil: input.onHoldUntil ?? transfer.onHoldUntil,
          settlementState:
            input.onHold === true
              ? "HELD"
              : input.onHold === false && transfer.onHold
                ? "RELEASED"
                : transfer.settlementState,
          processedAt:
            nextState === "PROCESSED"
              ? (transfer.processedAt ?? new Date())
              : transfer.processedAt,
          failedAt:
            nextState === "FAILED"
              ? (transfer.failedAt ?? new Date())
              : transfer.failedAt,
        },
      });
    });
  }

  async confirmSettlement(input: {
    transferId: string;
    settlementId: string;
    providerState: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer-provider:${input.transferId}`}))::text`;
      let transfer = await tx.routeTransferAttempt.findUnique({
        where: { transferId: input.transferId },
        include: { obligation: true, reversals: true },
      });
      if (!transfer) throw new NotFoundException("Route transfer not found");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer:${transfer.id}`}))::text`;
      transfer = await tx.routeTransferAttempt.findUnique({
        where: { id: transfer.id },
        include: { obligation: true, reversals: true },
      });
      if (!transfer) throw new NotFoundException("Route transfer not found");
      if (transfer.settlementState === "SETTLED") {
        if (transfer.settlementId !== input.settlementId)
          throw new ConflictException(
            "Transfer has different settlement authority",
          );
        return transfer;
      }
      if (transfer.state !== "PROCESSED" || transfer.onHold)
        throw new ConflictException("Transfer is not settlement eligible");
      if (
        transfer.reversals.some((reversal) =>
          ["CREATED", "PENDING", "PROCESSED"].includes(reversal.state),
        )
      )
        throw new ConflictException(
          "Transfer settlement is blocked by reversal activity",
        );
      const obligation = transfer.obligation;
      if (obligation.status === "BLOCKED")
        throw new ConflictException("Blocked obligation cannot settle");
      const vault = await tx.brandEscrowVault.findUniqueOrThrow({
        where: { id: obligation.vaultId },
      });
      if (vault.lockedCampaignFunds.lessThan(transfer.amount))
        throw new ConflictException("Locked vault authority is insufficient");
      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: transfer.amount },
          totalPooledBalance: { decrement: transfer.amount },
        },
      });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: obligation.brandProfileId,
          collaborationId: obligation.collaborationId,
          transactionType: "CREATOR_PAYOUT_SETTLEMENT",
          amount: transfer.amount,
          currency: transfer.currency,
          idempotencyKey: `route-settlement:${input.settlementId}`,
          gatewayReferenceId: input.settlementId,
          transactionStatus: "CLEARED",
        },
      });
      const now = new Date();
      const updated = await tx.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: {
          settlementId: input.settlementId,
          settlementState: "SETTLED",
          providerState: input.providerState,
          settledAt: now,
        },
      });
      await tx.creatorPayoutObligation.update({
        where: { id: obligation.id },
        data: { status: "SETTLED", settledAt: now, terminalAt: now },
      });
      await this.notifications.enqueueWithinTransaction(tx, {
        workspaceId: obligation.brandProfileId,
        eventType: "escrow.creator_payout_settled",
        source: {
          sourceType: "route_settlement",
          sourceId: input.settlementId,
          transitionId: "settled",
        },
        payload: {
          collaboration_id: obligation.collaborationId,
          obligation_id: obligation.id,
          transfer_id: input.transferId,
        },
      });
      return updated;
    });
  }

  async reconcileReversal(input: {
    reversalId: string;
    providerState: string;
  }) {
    const incoming = normalizeReversalState(input.providerState);
    return this.prisma.$transaction(async (tx) => {
      let reversal = await tx.routeTransferReversal.findUnique({
        where: { reversalId: input.reversalId },
        include: {
          transferAttempt: { include: { obligation: true, reversals: true } },
        },
      });
      if (!reversal) throw new NotFoundException("Route reversal not found");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`route-transfer:${reversal.transferAttemptId}`}))::text`;
      reversal = await tx.routeTransferReversal.findUnique({
        where: { id: reversal.id },
        include: {
          transferAttempt: { include: { obligation: true, reversals: true } },
        },
      });
      if (!reversal) throw new NotFoundException("Route reversal not found");
      if (reversal.state === "PROCESSED") return reversal;
      const now = new Date();
      const updated = await tx.routeTransferReversal.update({
        where: { id: reversal.id },
        data: {
          state: incoming,
          providerState: input.providerState,
          processedAt: incoming === "PROCESSED" ? now : null,
          failedAt: incoming === "FAILED" ? now : null,
        },
      });
      if (incoming !== "PROCESSED") return updated;
      const transfer = reversal.transferAttempt;
      const obligation = transfer.obligation;
      const otherConfirmed = transfer.reversals
        .filter((row) => row.id !== reversal.id && row.state === "PROCESSED")
        .reduce((total, row) => total.add(row.amount), new Decimal(0));
      const confirmed = otherConfirmed.add(reversal.amount);
      if (confirmed.greaterThan(transfer.amount))
        throw new ConflictException(
          "Confirmed reversal exceeds transfer amount",
        );
      const full = confirmed.equals(transfer.amount);
      if (transfer.settlementState === "SETTLED") {
        await tx.brandEscrowVault.update({
          where: { id: obligation.vaultId },
          data: {
            totalPooledBalance: { increment: reversal.amount },
            lockedCampaignFunds: { increment: reversal.amount },
          },
        });
        await tx.escrowTransactionLedger.create({
          data: {
            vaultId: obligation.vaultId,
            brandProfileId: obligation.brandProfileId,
            collaborationId: obligation.collaborationId,
            transactionType: "CREATOR_PAYOUT_REVERSAL",
            amount: reversal.amount,
            currency: reversal.currency,
            idempotencyKey: `route-reversal:${input.reversalId}`,
            gatewayReferenceId: input.reversalId,
            transactionStatus: "REVERSED",
          },
        });
      }
      await tx.routeTransferAttempt.update({
        where: { id: transfer.id },
        data: { state: full ? "REVERSED" : "PARTIALLY_REVERSED" },
      });
      await tx.creatorPayoutObligation.update({
        where: { id: obligation.id },
        data: {
          status: full ? "REVERSED" : "PARTIALLY_REVERSED",
          terminalAt: full ? now : null,
        },
      });
      await this.notifications.enqueueWithinTransaction(tx, {
        workspaceId: obligation.brandProfileId,
        eventType: "escrow.creator_payout_reversed",
        source: {
          sourceType: "route_reversal",
          sourceId: input.reversalId,
          transitionId: "processed",
        },
        payload: {
          collaboration_id: obligation.collaborationId,
          obligation_id: obligation.id,
          transfer_id: transfer.transferId,
          reversal_id: input.reversalId,
          reversal_scope: full ? "FULL" : "PARTIAL",
        },
      });
      return updated;
    });
  }
}
