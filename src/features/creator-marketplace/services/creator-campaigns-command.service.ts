import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UceCollabStatus,
  UceDraftReviewStatus,
  UceLogisticsSubState,
  UceMilestoneStage,
  UceProductionPhase,
  UceReviewSubState,
  UceWorkflowActionRole,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { buildPhaseSyncPatch } from "../../../shared/uce/uce-production-phase.util";
import { normalizeInstagramHandle } from "../../brand-uce/utils/instagram-handle.util";
import type {
  ClaimBrandInvitationInput,
  ConfirmLogisticsReceiptInput,
  SubmitContentDraftInput,
} from "../schemas/command-center.schema";
import { CreatorCampaignsPanicService } from "./creator-campaigns-panic.service";

type AuthUser = { id: string; email: string; role: UserRole };

@Injectable()
export class CreatorCampaignsCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panic: CreatorCampaignsPanicService,
  ) {}

  async claimBrandInvitation(user: AuthUser, input: ClaimBrandInvitationInput) {
    const profile = await this.requireCreatorProfile(user);
    const collab = await this.assertOwnedCollaboration(
      input.collaborationId,
      profile.id,
      profile.instagramHandle,
    );

    if (
      collab.collabStatus !== UceCollabStatus.PROSPECT_INVITED &&
      collab.collabStatus !== UceCollabStatus.PROSPECT_CURATED
    ) {
      throw new BadRequestException(
        "Invitation has already been claimed or is no longer valid.",
      );
    }

    if (input.creatorAction === "DECLINE") {
      const declined = await this.prisma.uceCampaignCollaboration.update({
        where: { id: collab.id },
        data: {
          collabStatus: UceCollabStatus.TERMINATED_CANCELED,
          currentPhase: UceProductionPhase.ARCHIVED_CLOSED,
          actionRequiredByRole: UceWorkflowActionRole.NONE,
          productionDeadlineAt: null,
        },
      });
      this.panic.invalidateCreatorCache(profile.id);
      return { collaboration_id: declined.id, declined: true };
    }

    const briefId = input.selectedBriefTrackId ?? collab.briefId;
    const productId = input.selectedProductId ?? collab.productId;

    if (input.selectedBriefTrackId) {
      const brief = await this.prisma.uceCampaignBrief.findFirst({
        where: { id: briefId, campaignId: collab.campaignId, isActive: true },
      });
      if (!brief) {
        throw new BadRequestException("Selected brief track not found");
      }
    }

    if (input.selectedProductId) {
      const product = await this.prisma.uceCampaignProduct.findFirst({
        where: {
          id: input.selectedProductId,
          campaignId: collab.campaignId,
          isActive: true,
        },
      });
      if (!product) {
        throw new BadRequestException("Selected product not found");
      }
    }

    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.uceCampaignCollaboration.update({
      where: { id: collab.id },
      data: {
        collabStatus: UceCollabStatus.APPLICANT_PENDING,
        briefId,
        productId,
        creatorProfileId: profile.id,
        currentPhase: UceProductionPhase.APPLICATION_REVIEW,
        actionRequiredByRole: UceWorkflowActionRole.BRAND,
        productionDeadlineAt: null,
        currentMilestoneDeadline: deadline,
      },
    });

    this.panic.invalidateCreatorCache(profile.id);
    return { collaboration_id: updated.id, claimed: true };
  }

  async confirmLogisticsReceipt(
    user: AuthUser,
    input: ConfirmLogisticsReceiptInput,
  ) {
    const profile = await this.requireCreatorProfile(user);
    const collab = await this.assertOwnedCollaboration(
      input.collaborationId,
      profile.id,
      profile.instagramHandle,
    );

    if (collab.currentPhase !== UceProductionPhase.LOGISTICS_TRANSIT) {
      throw new BadRequestException(
        "Package receipt can only be confirmed during logistics transit.",
      );
    }

    const draftingDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      if (collab.logisticsRegistry) {
        await tx.uceCollaborationLogistics.update({
          where: { collaborationId: collab.id },
          data: {
            isReceivedByCreator: true,
            isPackageDamaged: input.isPackageDamaged,
            actualDeliveredAt: new Date(),
          },
        });
      }

      return tx.uceCampaignCollaboration.update({
        where: { id: collab.id },
        data: {
          currentMilestone: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
          logisticsState: UceLogisticsSubState.IN_TRANSIT,
          currentPhase: UceProductionPhase.CONTENT_DRAFTING,
          actionRequiredByRole: UceWorkflowActionRole.CREATOR,
          productionDeadlineAt: draftingDeadline,
          currentMilestoneDeadline: draftingDeadline,
        },
      });
    });

    this.panic.invalidateCreatorCache(profile.id);
    return {
      collaboration_id: updated.id,
      current_phase: updated.currentPhase,
    };
  }

  async submitContentDraft(user: AuthUser, input: SubmitContentDraftInput) {
    const profile = await this.requireCreatorProfile(user);
    const collab = await this.assertOwnedCollaboration(
      input.collaborationId,
      profile.id,
      profile.instagramHandle,
    );

    if (collab.currentPhase !== UceProductionPhase.CONTENT_DRAFTING) {
      throw new BadRequestException(
        "Drafts can only be submitted during the content drafting phase.",
      );
    }

    const version =
      (await this.prisma.uceCollaborationContentDraft.count({
        where: { collaborationId: collab.id },
      })) + 1;

    const autoDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.uceCollaborationContentDraft.create({
        data: {
          collaborationId: collab.id,
          draftUrl: input.draftAssetUrl,
          submissionVersion: version,
          reviewState: UceDraftReviewStatus.AWAITING_REVIEW,
          submissionNotes: input.submissionNotes,
        },
      });

      return tx.uceCampaignCollaboration.update({
        where: { id: collab.id },
        data: {
          contentDraftUrl: input.draftAssetUrl,
          currentMilestone: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
          reviewState: UceReviewSubState.INITIAL_DRAFT_SUBMITTED,
          currentPhase: UceProductionPhase.SAFETY_REVIEW,
          actionRequiredByRole: UceWorkflowActionRole.BRAND,
          productionDeadlineAt: null,
          autoApprovalDeadline72h: autoDeadline,
        },
      });
    });

    this.panic.invalidateCreatorCache(profile.id);
    return {
      collaboration_id: updated.id,
      current_phase: updated.currentPhase,
      submission_version: version,
    };
  }

  /** Re-sync denormalized phase columns for a row after legacy milestone updates. */
  async syncPhaseColumns(collaborationId: string): Promise<void> {
    const collab = await this.prisma.uceCampaignCollaboration.findUnique({
      where: { id: collaborationId },
    });
    if (!collab) return;

    const patch = buildPhaseSyncPatch(collab);
    await this.prisma.uceCampaignCollaboration.update({
      where: { id: collaborationId },
      data: patch,
    });
  }

  private async requireCreatorProfile(user: AuthUser) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile?.instagramHandle) {
      throw new BadRequestException(
        "Complete your creator profile with an Instagram handle first.",
      );
    }
    return profile;
  }

  private async assertOwnedCollaboration(
    collaborationId: string,
    creatorProfileId: string,
    instagramHandle: string | null,
  ) {
    const collab = await this.prisma.uceCampaignCollaboration.findUnique({
      where: { id: collaborationId },
      include: { logisticsRegistry: true },
    });
    if (!collab) {
      throw new NotFoundException("Collaboration not found");
    }

    if (!instagramHandle) {
      throw new BadRequestException("Instagram handle is required");
    }
    const handle = normalizeInstagramHandle(instagramHandle);
    const owned =
      collab.creatorProfileId === creatorProfileId ||
      collab.instagramHandle === handle;

    if (!owned) {
      throw new ForbiddenException("Collaboration is not assigned to your profile");
    }

    return collab;
  }
}
