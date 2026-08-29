import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import {
  CollaborationMessageKind,
  CollaborationPayoutMode,
  UceMilestoneStage,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandEscrowComputationService } from "./brand-escrow-computation.service";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";

export type EscrowRefundReasonCode =
  | "BR_03_LOGISTICS_STRIKE"
  | "BR_04_HARD_STOP_REJECTION"
  | "MUTUAL_TERMINATION";

export interface TransitionStageInput {
  collaborationId: string;
  targetStage: UceMilestoneStage;
  initiatedByUserId: string;
}

export interface TriggerCancellationRefundInput {
  collaborationId: string;
  reasonCode: EscrowRefundReasonCode;
  diagnosticNotes: string;
}

@Injectable()
export class BrandEscrowInterlockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly computationService: BrandEscrowComputationService,
    private readonly notifications: NotificationDispatchService,
  ) {}

  async transitionCollaborationStage(input: TransitionStageInput) {
    return this.prisma.$transaction(async (tx) => {
      const collab = await tx.collaboration.findUnique({
        where: { id: input.collaborationId },
      });

      if (!collab) {
        throw new NotFoundException("Collaboration not found");
      }

      const currentStage = collab.currentStage;
      const targetStage = input.targetStage;

      if (
        currentStage === UceMilestoneStage.STAGE_2_SECUREMENT &&
        targetStage === UceMilestoneStage.STAGE_3_LOGISTICS
      ) {
        const fundingLock = await tx.collaborationEscrowLock.findUnique({
          where: { collaborationId: input.collaborationId },
        });

        if (!fundingLock) {
          throw new PreconditionFailedException(
            "Cannot advance to logistics: escrow funding lock is missing",
          );
        }

        const vault = await tx.brandEscrowVault.findUnique({
          where: { brandProfileId: collab.brandProfileId },
        });

        if (
          !vault ||
          vault.lockedCampaignFunds.lessThan(
            fundingLock.totalEscrowLockedAmount,
          )
        ) {
          throw new PreconditionFailedException(
            "Vault allocation does not match collaboration escrow lock",
          );
        }
      }

      const updatedCollab = await tx.collaboration.update({
        where: { id: input.collaborationId },
        data: {
          currentStage: targetStage,
          stageUpdatedAt: new Date(),
        },
      });

      if (
        collab.payoutMode === CollaborationPayoutMode.ESCROW &&
        (targetStage === UceMilestoneStage.STAGE_3_LOGISTICS ||
          targetStage === UceMilestoneStage.STAGE_4_CONTENT_REVIEW)
      ) {
        const lock = await tx.collaborationEscrowLock.findUnique({
          where: { collaborationId: input.collaborationId },
        });

        if (lock && !lock.advanceTrancheDisbursed) {
          await this.computationService.executeTrancheDisbursal({
            collaborationId: input.collaborationId,
            tranche: "ADVANCE_30",
          });
        }
      }

      await tx.collaborationMessage.create({
        data: {
          collaborationId: input.collaborationId,
          senderUserId: input.initiatedByUserId,
          kind: CollaborationMessageKind.SYSTEM,
          systemEventTag: "ESCROW_STAGE_TRANSITION",
          body: `Workflow stage advanced from [${currentStage}] to [${targetStage}].`,
        },
      });

      return {
        collaboration_id: updatedCollab.id,
        current_stage: updatedCollab.currentStage,
      };
    });
  }

  async executeAutomatedRefund(input: TriggerCancellationRefundInput) {
    return this.prisma.$transaction(async (tx) => {
      const lock = await tx.collaborationEscrowLock.findUnique({
        where: { collaborationId: input.collaborationId },
      });

      if (!lock) {
        throw new NotFoundException("Escrow lock not found for collaboration");
      }

      if (lock.lockReleasedViaRefund) {
        return {
          collaboration_id: input.collaborationId,
          refund_status: "ALREADY_REVERSED",
          amount_returned: 0,
        };
      }
      if (lock.finalTrancheDisbursed) {
        throw new BadRequestException(
          "Escrow lock has already been settled or reversed",
        );
      }

      const vault = await tx.brandEscrowVault.findUnique({
        where: { brandProfileId: lock.brandProfileId },
      });

      if (!vault) {
        throw new NotFoundException("Escrow vault not found");
      }

      let completedAdvance = new Decimal(0);
      if (lock.advanceTrancheDisbursed) {
        const commercial = await tx.collaborationCommercial.findUnique({
          where: { collaborationId: input.collaborationId },
        });
        const contractedAdvance = commercial?.advance30Amount;
        if (
          !commercial ||
          contractedAdvance === null ||
          contractedAdvance === undefined ||
          contractedAdvance.lessThan(0) ||
          contractedAdvance.greaterThan(lock.grossCreatorQuote) ||
          !commercial.finalQuote?.equals(lock.grossCreatorQuote)
        ) {
          throw new ConflictException(
            "Disbursed advance lacks valid contracted commercial authority",
          );
        }
        completedAdvance = contractedAdvance;
      }
      const refundAmount = lock.totalEscrowLockedAmount.sub(completedAdvance);

      if (refundAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestException("Calculated refund amount is invalid");
      }

      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: refundAmount },
          availableBalance: { increment: refundAmount },
        },
      });

      await tx.collaborationEscrowLock.update({
        where: { id: lock.id },
        data: { lockReleasedViaRefund: true },
      });

      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: lock.brandProfileId,
          collaborationId: input.collaborationId,
          transactionType: "COLLAB_REFUND",
          amount: refundAmount,
          currency: vault.currency,
          idempotencyKey: `collab-refund:${input.collaborationId}`,
          transactionStatus: "CLEARED",
          errorDiagnosticPayload: {
            reasonCode: input.reasonCode,
            notes: input.diagnosticNotes,
          },
        },
      });

      await tx.collaborationCommercial.updateMany({
        where: { collaborationId: input.collaborationId },
        data: { escrowStatus: "REFUNDED" },
      });

      await tx.collaborationMessage.create({
        data: {
          collaborationId: input.collaborationId,
          kind: CollaborationMessageKind.SYSTEM,
          systemEventTag: "ESCROW_REFUND",
          body: `Collaboration terminated under [${input.reasonCode}]. Refunding ${vault.currency} ${refundAmount.toFixed(2)} to available balance.`,
        },
      });

      await this.notifications?.enqueueWithinTransaction(tx, {
        workspaceId: lock.brandProfileId,
        eventType: "escrow.collaboration_refunded",
        source: {
          sourceType: "collaboration_escrow_refund",
          sourceId: input.collaborationId,
          transitionId: `collab-refund:${input.collaborationId}`,
        },
        payload: { collaboration_id: input.collaborationId },
        triggerUserId: null,
      });

      return {
        collaboration_id: input.collaborationId,
        refund_status: "REVERSED_AND_SETTLED",
        amount_returned: refundAmount.toNumber(),
      };
    });
  }
}
