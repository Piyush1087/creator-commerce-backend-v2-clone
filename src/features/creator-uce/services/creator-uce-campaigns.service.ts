import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UceApplicationScope,
  UceCampaignStatus,
  UceCollabStatus,
  UceMilestoneStage,
  UceNegotiationSubState,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { buildPhaseSyncPatch, mapContentFormatFromTags } from "../../../shared/uce/uce-production-phase.util";
import { CreatorEligibilityService } from "../../creator-marketplace/services/creator-eligibility.service";
import type { CreatorAudienceDemographicsMatrix } from "../../creator-marketplace/types/creator-audience.types";
import { isInvitedCollaboration } from "../../creator-marketplace/utils/visibility-scope.util";
import type { CreatorApplyToCampaignDto } from "../dto/creator-apply.dto";
import { normalizeInstagramHandle } from "../../brand-uce/utils/instagram-handle.util";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";

type AuthUser = { id: string; email: string; role: UserRole };

@Injectable()
export class CreatorUceCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eligibility: CreatorEligibilityService,
  ) {}

  async listOpenCampaigns(user: AuthUser) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile?.instagramHandle) {
      throw new BadRequestException(
        "Complete your creator profile with an Instagram handle before applying.",
      );
    }

    const handle = normalizeInstagramHandle(profile.instagramHandle);
    const existing = await this.prisma.uceCampaignCollaboration.findMany({
      where: { instagramHandle: handle },
      select: { campaignId: true, collabStatus: true },
    });
    const appliedCampaignIds = new Set(
      existing
        .filter((r) => r.collabStatus !== UceCollabStatus.APPLICANT_REJECTED)
        .map((r) => r.campaignId),
    );

    const campaigns = await this.prisma.uceCampaign.findMany({
      where: { status: UceCampaignStatus.LIVE },
      orderBy: { updatedAt: "desc" },
      include: {
        brandProfile: { select: { name: true } },
        strategy: { select: { coreObjective: true } },
        briefs: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return campaigns.map((c) => ({
      campaign_id: c.id,
      campaign_name: c.name,
      brand_name: c.brandProfile.name,
      core_objective: c.strategy?.coreObjective ?? null,
      already_applied: appliedCampaignIds.has(c.id),
      briefs: c.briefs.map((b) => ({
        brief_id: b.id,
        internal_title: b.internalTitle,
        creative_guidelines: b.creativeGuidelines,
        required_platforms: b.requiredPlatforms,
        deliverable_format_tags: b.deliverableFormatTags,
      })),
      products: c.products.map((p) => ({
        product_id: p.id,
        sku_code: p.skuCode,
        product_name: p.productName,
        inventory_count: p.inventoryCount,
        out_of_stock: p.inventoryCount <= 0,
      })),
    }));
  }

  async applyToCampaign(
    user: AuthUser,
    campaignId: string,
    dto: CreatorApplyToCampaignDto,
  ) {
    this.assertCreator(user);

    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile?.instagramHandle) {
      throw new BadRequestException(
        "Complete your creator profile with an Instagram handle before applying.",
      );
    }

    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, status: UceCampaignStatus.LIVE },
      include: { targeting: true },
    });
    if (!campaign || !campaign.targeting) {
      throw new NotFoundException("Campaign not found or not open for applications");
    }

    const handle = normalizeInstagramHandle(profile.instagramHandle);

    const creatorContext = {
      primaryRegion: profile.primaryRegion ?? "US",
      followerCount: profile.followerCount ?? 0,
      audienceDemographicsMatrix: (profile.audienceDemographicsMatrix ??
        {}) as CreatorAudienceDemographicsMatrix,
      instagramHandle: profile.instagramHandle,
    };

    const pipelineRow = await this.prisma.uceCampaignCollaboration.findUnique({
      where: {
        campaignId_instagramHandle: { campaignId, instagramHandle: handle },
      },
    });

    const isInvited =
      pipelineRow !== null && isInvitedCollaboration(pipelineRow.collabStatus);
    const eligibility = this.eligibility.evaluateTargeting(
      creatorContext,
      campaign.targeting,
      { creatorEmail: user.email },
    );
    const inviteBypass =
      campaign.targeting.applicationScope === UceApplicationScope.DIRECT_BYPASS;

    if (!eligibility.is_eligible && !(isInvited && inviteBypass)) {
      throw new BadRequestException(
        "Your profile does not meet this campaign's targeting criteria.",
      );
    }

    const brief = await this.prisma.uceCampaignBrief.findFirst({
      where: { id: dto.brief_id, campaignId, isActive: true },
    });
    if (!brief) {
      throw new BadRequestException("Brief not found for campaign");
    }

    if (dto.product_id) {
      const product = await this.prisma.uceCampaignProduct.findFirst({
        where: { id: dto.product_id, campaignId, isActive: true },
      });
      if (!product) {
        throw new BadRequestException("Product not found for campaign");
      }
      if (product.inventoryCount <= 0) {
        throw new BadRequestException(
          "Selected product is out of stock for this campaign.",
        );
      }
    }

    const existing = await this.prisma.uceCampaignCollaboration.findUnique({
      where: {
        campaignId_instagramHandle: { campaignId, instagramHandle: handle },
      },
    });
    if (
      existing &&
      existing.collabStatus !== UceCollabStatus.APPLICANT_REJECTED
    ) {
      throw new ConflictException("You already have a pipeline row for this campaign");
    }

    const milestoneDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const phaseSeed = {
      collabStatus: UceCollabStatus.APPLICANT_PENDING,
      currentMilestone: UceMilestoneStage.STAGE_1_NEGOTIATION,
      logisticsState: null as null,
      reviewState: null as null,
      contentDraftUrl: null as null,
      currentMilestoneDeadline: milestoneDeadline,
    };

    const collab = await this.prisma.$transaction(async (tx) => {
      if (existing?.collabStatus === UceCollabStatus.APPLICANT_REJECTED) {
        await tx.uceCampaignCollaboration.delete({ where: { id: existing.id } });
      }

      const created = await tx.uceCampaignCollaboration.create({
        data: {
          campaignId,
          briefId: dto.brief_id,
          productId: dto.product_id ?? null,
          instagramHandle: handle,
          creatorEmail: user.email,
          creatorProfileId: profile.id,
          contentFormatType: mapContentFormatFromTags(brief.deliverableFormatTags),
          matchScore: dto.match_score ?? 0,
          collabStatus: UceCollabStatus.APPLICANT_PENDING,
          negotiationState: UceNegotiationSubState.CREATOR_COUNTER,
          currentMilestoneDeadline: milestoneDeadline,
          ...buildPhaseSyncPatch(phaseSeed),
        },
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId: created.id,
          stageContext: UceMilestoneStage.STAGE_1_NEGOTIATION,
          systemEventTag: "CREATOR_APPLIED",
          messagePayload: `Creator @${handle} applied to campaign`,
          actorIdentifier: user.id,
        },
      });

      await tx.uceCampaignPerformanceAggregate.upsert({
        where: { campaignId },
        create: {
          campaignId,
          totalApplicantsCount: 1,
        },
        update: {
          totalApplicantsCount: { increment: 1 },
        },
      });

      return created;
    });

    return {
      collaboration_id: collab.id,
      campaign_id: collab.campaignId,
      collab_status: collab.collabStatus,
      match_score: decimalToNumber(collab.matchScore),
    };
  }

  private assertCreator(user: AuthUser): void {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }
}
