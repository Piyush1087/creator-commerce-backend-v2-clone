import {
  BadRequestException,
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
import { randomUUID } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandEscrowComputationService } from "./brand-escrow-computation.service";

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
          vault.lockedCampaignFunds.lessThan(fundingLock.totalEscrowLockedAmount)
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

      if (lock.lockReleasedViaRefund || lock.finalTrancheDisbursed) {
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

      let refundAmount = new Decimal(0);

      if (
        input.reasonCode === "BR_03_LOGISTICS_STRIKE" ||
        input.reasonCode === "MUTUAL_TERMINATION"
      ) {
        if (!lock.advanceTrancheDisbursed) {
          refundAmount = lock.totalEscrowLockedAmount;
        } else {
          const completedAdvance = lock.netCreatorPayoutPool.mul(0.3);
          refundAmount = lock.totalEscrowLockedAmount.sub(completedAdvance);
        }
      } else if (input.reasonCode === "BR_04_HARD_STOP_REJECTION") {
        const completedAdvance = lock.netCreatorPayoutPool.mul(0.3);
        refundAmount = lock.totalEscrowLockedAmount.sub(completedAdvance);
      }

      if (refundAmount.lessThanOrEqualTo(0)) {
        throw new BadRequestException("Calculated refund amount is invalid");
      }

      const lockedReleaseAmount = lock.advanceTrancheDisbursed
        ? lock.totalEscrowLockedAmount.sub(lock.netCreatorPayoutPool.mul(0.3))
        : lock.totalEscrowLockedAmount;

      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          lockedCampaignFunds: { decrement: lockedReleaseAmount },
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
          transactionType: "FAILED_COLLAB_REFUND",
          amount: refundAmount,
          currency: vault.currency,
          idempotencyKey: randomUUID(),
          transactionStatus: "CLEARED",
          errorDiagnosticPayload: {
            reasonCode: input.reasonCode,
            notes: input.diagnosticNotes,
          },
        },
      });

      await tx.collaborationMessage.create({
        data: {
          collaborationId: input.collaborationId,
          kind: CollaborationMessageKind.SYSTEM,
          systemEventTag: "ESCROW_REFUND",
          body: `Collaboration terminated under [${input.reasonCode}]. Refunding ${vault.currency} ${refundAmount.toFixed(2)} to available balance.`,
        },
      });

      return {
        collaboration_id: input.collaborationId,
        refund_status: "REVERSED_AND_SETTLED",
        amount_returned: refundAmount.toNumber(),
      };
    });
  }
}
