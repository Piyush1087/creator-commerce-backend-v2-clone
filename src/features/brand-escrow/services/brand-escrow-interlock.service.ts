import {
  GoneException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { CollaborationMessageKind, UceMilestoneStage } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

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
    void input;
    throw new GoneException(
      "Legacy refund execution is retired; canonical Collaboration financial resolution is required",
    );
  }
}
