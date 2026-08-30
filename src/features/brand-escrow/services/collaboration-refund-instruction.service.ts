import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CollaborationMessageKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import { EscrowFinancialAllocationService } from "./escrow-financial-allocation.service";
import { EscrowFundingAttributionService } from "./escrow-funding-attribution.service";

export type CollaborationRefundInstruction = {
  instructionId: string;
  collaborationId: string;
  brandProfileId: string;
  amount: Decimal.Value;
  currency: string;
  issuedAt: Date;
  financialResolutionReference: string;
  triggeringUserId?: string | null;
};

@Injectable()
export class CollaborationRefundInstructionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationDispatchService,
    private readonly allocations: EscrowFinancialAllocationService,
    private readonly attribution: EscrowFundingAttributionService,
  ) {}

  async consumeRefundInstruction(input: CollaborationRefundInstruction) {
    const amount = new Decimal(input.amount);
    if (!input.instructionId.trim())
      throw new BadRequestException("Refund instruction ID is required");
    if (!input.financialResolutionReference.trim())
      throw new BadRequestException(
        "Trusted financial resolution reference is required",
      );
    if (!amount.greaterThan(0))
      throw new BadRequestException("Refund amount must be positive");
    if (input.currency !== "INR")
      throw new BadRequestException("Refund currency is not supported");

    return this.prisma.$transaction(async (tx) => {
      let vault = await tx.brandEscrowVault.findUnique({
        where: { brandProfileId: input.brandProfileId },
      });
      if (!vault || vault.currency !== input.currency)
        throw new ConflictException("Brand vault currency authority mismatch");
      await tx.$queryRaw`SELECT vault_id FROM brand_escrow_vaults WHERE vault_id = ${vault.id} FOR UPDATE`;
      vault = await tx.brandEscrowVault.findUniqueOrThrow({
        where: { id: vault.id },
      });
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`collaboration-refund-instruction:${input.instructionId}`}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-obligation:${input.collaborationId}`}))::text`;

      const existing = await tx.collaborationRefundInstruction.findUnique({
        where: { refundInstructionId: input.instructionId },
      });
      if (existing) {
        if (
          existing.collaborationId !== input.collaborationId ||
          existing.brandProfileId !== input.brandProfileId ||
          !existing.amount.equals(amount) ||
          existing.currency !== input.currency ||
          existing.financialResolutionReference !==
            input.financialResolutionReference
        ) {
          throw new ConflictException(
            "Refund instruction identity was reused with different economics",
          );
        }
        return existing;
      }

      const collaboration = await tx.collaboration.findUnique({
        where: { id: input.collaborationId },
        select: { brandProfileId: true },
      });
      if (!collaboration)
        throw new NotFoundException("Collaboration not found");
      if (collaboration.brandProfileId !== input.brandProfileId)
        throw new ConflictException(
          "Refund instruction does not match Collaboration authority",
        );

      const lock = await tx.collaborationEscrowLock.findUnique({
        where: { collaborationId: input.collaborationId },
      });
      if (!lock || lock.lockReleasedViaRefund)
        throw new ConflictException("Active Collaboration reserve is required");

      await this.allocations.assertRefundAllocation(
        tx,
        input.collaborationId,
        lock,
        amount,
      );
      if (vault.lockedCampaignFunds.lessThan(amount))
        throw new ConflictException("Locked vault authority is insufficient");

      await this.attribution.releaseCollaborationLocked(tx, {
        vaultId: vault.id,
        collaborationId: input.collaborationId,
        currency: input.currency,
        amount,
      });

      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: amount },
          availableBalance: { increment: amount },
        },
      });
      const ledger = await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: input.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "COLLAB_REFUND",
          amount,
          currency: input.currency,
          idempotencyKey: `collab-refund-instruction:${input.instructionId}`,
          transactionStatus: "CLEARED",
          errorDiagnosticPayload: {
            financialResolutionReference: input.financialResolutionReference,
          },
        },
      });
      const executed = await tx.collaborationRefundInstruction.create({
        data: {
          refundInstructionId: input.instructionId,
          collaborationId: input.collaborationId,
          vaultId: vault.id,
          brandProfileId: input.brandProfileId,
          amount,
          currency: input.currency,
          financialResolutionReference: input.financialResolutionReference,
          instructionIssuedAt: input.issuedAt,
          triggeringUserId: input.triggeringUserId,
          ledgerTransactionId: ledger.id,
        },
      });

      await tx.collaborationMessage.create({
        data: {
          collaborationId: input.collaborationId,
          kind: CollaborationMessageKind.SYSTEM,
          systemEventTag: "ESCROW_REFUND",
          body: `Canonical financial resolution executed an internal ${input.currency} ${amount.toFixed(2)} collaboration refund.`,
        },
      });
      await this.notifications.enqueueWithinTransaction(tx, {
        workspaceId: input.brandProfileId,
        eventType: "escrow.collaboration_refunded",
        source: {
          sourceType: "collaboration_refund_instruction",
          sourceId: executed.id,
          transitionId: "executed",
        },
        payload: { collaboration_id: input.collaborationId },
        triggerUserId: input.triggeringUserId,
      });
      return executed;
    });
  }
}
