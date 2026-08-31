import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  UceApplicationSource,
  UceApplicationStatus,
  UceCampaignCreatorIngestionMethod,
  UceCampaignCreatorSource,
  UceCampaignStatus,
  UceCollabStatus,
  UceMediaPlatform,
  UceMilestoneStage,
  UceNegotiationSubState,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { buildPhaseSyncPatch } from "../../../shared/uce/uce-production-phase.util";
import { CollaborationProvisionService } from "../../collaboration/services/collaboration-provision.service";
import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import { decimalToNumber, splitEscrowQuote } from "../utils/uce-decimal.util";
import {
  approveApplicationInputSchema,
  rejectApplicationInputSchema,
} from "../validation/applicants/application.schema";
import { BrandUceAccessService } from "./brand-uce-access.service";
import { BrandUcePipelineService } from "./brand-uce-pipeline.service";

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

function defaultMilestoneDeadline(days = 14): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class CampaignApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
    private readonly pipeline: BrandUcePipelineService,
    private readonly collaborationProvision: CollaborationProvisionService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
  ) {}

  /**
   * Explicit compatibility command. This is intentionally never invoked by a
   * Campaign Page GET/read path; callers must opt into legacy reconciliation.
   */
  async syncLegacyApplicantsCompatibilityCommand(campaignId: string) {
    const applicantRows = await this.prisma.uceCampaignCollaboration.findMany({
      where: {
        campaignId,
        collabStatus: {
          in: [
            UceCollabStatus.APPLICANT_PENDING,
            UceCollabStatus.APPLICANT_SHORTLISTED,
            UceCollabStatus.APPLICANT_REJECTED,
          ],
        },
      },
      include: { brief: true },
    });

    for (const row of applicantRows) {
      const normalized = normalizeHandle(row.instagramHandle);
      const creator = await this.prisma.uceCampaignCreator.upsert({
        where: {
          campaignId_platform_normalizedSocialHandle: {
            campaignId,
            platform: UceMediaPlatform.INSTAGRAM,
            normalizedSocialHandle: normalized,
          },
        },
        create: {
          campaignId,
          creatorProfileId: row.creatorProfileId,
          platform: UceMediaPlatform.INSTAGRAM,
          socialHandle: row.instagramHandle,
          normalizedSocialHandle: normalized,
          email: row.creatorEmail,
          source: UceCampaignCreatorSource.MANUAL,
          ingestionMethod: UceCampaignCreatorIngestionMethod.MANUAL_SINGLE,
        },
        update: {
          creatorProfileId: row.creatorProfileId ?? undefined,
          email: row.creatorEmail,
        },
      });

      const assetId = row.productId ?? row.brief.productId;
      if (!assetId) continue;

      const existing = await this.prisma.uceApplication.findFirst({
        where: {
          campaignId,
          campaignCreatorId: creator.id,
          briefId: row.briefId,
          status: {
            in: [
              UceApplicationStatus.PENDING,
              UceApplicationStatus.APPROVED,
              UceApplicationStatus.REJECTED,
            ],
          },
        },
      });
      if (existing) continue;

      const status =
        row.collabStatus === UceCollabStatus.APPLICANT_REJECTED
          ? UceApplicationStatus.REJECTED
          : UceApplicationStatus.PENDING;

      await this.prisma.uceApplication.create({
        data: {
          requestId: `legacy-${row.id}`,
          campaignId,
          campaignCreatorId: creator.id,
          campaignAssetId: assetId,
          briefId: row.briefId,
          status,
          source: UceApplicationSource.DIRECT,
          rejectedAt:
            status === UceApplicationStatus.REJECTED ? new Date() : null,
          snapshot: {
            create: {
              campaignContext: { campaignId },
              campaignAssetContext: { campaignAssetId: assetId },
              briefContext: { briefId: row.briefId },
              commercialContext: {},
              creatorIdentity: {
                socialHandle: row.instagramHandle,
                email: row.creatorEmail,
              },
            },
          },
        },
      });
    }
  }

  async listApplicants(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const rows = await this.prisma.uceApplication.findMany({
      where: {
        campaignId,
        status: {
          in: [
            UceApplicationStatus.PENDING,
            UceApplicationStatus.APPROVED,
            UceApplicationStatus.REJECTED,
            UceApplicationStatus.SUPERSEDED,
          ],
        },
      },
      include: { campaignCreator: true },
      orderBy: { appliedAt: "desc" },
      take: 50,
    });

    return {
      state: rows.length ? ("READY" as const) : ("EMPTY" as const),
      applicants: rows.map((row) => ({
        applicationId: row.id,
        campaignCreatorId: row.campaignCreatorId,
        name: row.campaignCreator.socialHandle,
        category: "Creator",
        followers: "—",
        engagement: "—",
        avatarInitials: row.campaignCreator.socialHandle
          .slice(0, 2)
          .toUpperCase(),
        applicationStatus: row.status as
          | "PENDING"
          | "APPROVED"
          | "REJECTED"
          | "SUPERSEDED"
          | "WITHDRAWN"
          | "EXPIRED",
        source: row.source,
        appliedAt: row.appliedAt.toISOString(),
        campaignAssetId: row.campaignAssetId,
        briefId: row.briefId,
        canonicalCampaignAssetId: null,
        canonicalBriefId: null,
        referenceAuthority: "LEGACY_COMPATIBILITY" as const,
        intelligenceStatus: "UNAVAILABLE" as const,
      })),
    };
  }

  async approve(
    brandProfileId: string,
    campaignId: string,
    applicationId: string,
    actorId: string,
  ) {
    const parsed = approveApplicationInputSchema.safeParse({ applicationId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    await this.subscriptionCapabilities.assertCapability(
      brandProfileId,
      "COLLABORATION_CREATE",
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const application = await tx.uceApplication.findFirst({
        where: { id: applicationId, campaignId },
        include: { campaignCreator: true },
      });
      if (!application) throw new NotFoundException("Application not found");
      if (application.status !== UceApplicationStatus.PENDING) {
        throw new BadRequestException(
          "Only PENDING applications can be approved",
        );
      }
      if (!application.campaignCreator.email?.trim()) {
        throw new BadRequestException(
          "Creator email is required before an Application can be approved",
        );
      }

      const campaign = await tx.uceCampaign.findFirst({
        where: { id: campaignId, brandProfileId },
      });
      if (!campaign) throw new NotFoundException("Campaign not found");
      if (
        campaign.status !== UceCampaignStatus.LIVE &&
        campaign.status !== UceCampaignStatus.PAUSED
      ) {
        throw new BadRequestException(
          "Applications can only be approved for LIVE or PAUSED Campaigns",
        );
      }

      const product = await tx.uceCampaignProduct.findFirst({
        where: {
          id: application.campaignAssetId,
          campaignId,
          isActive: true,
        },
      });
      if (!product) {
        throw new BadRequestException(
          "The Application Campaign Asset is no longer active",
        );
      }

      const brief = await tx.uceCampaignBrief.findFirst({
        where: {
          id: application.briefId,
          campaignId,
          productId: application.campaignAssetId,
          isActive: true,
        },
      });
      if (!brief) {
        throw new BadRequestException(
          "The Application Brief is no longer active for this Campaign Asset",
        );
      }

      const claimed = await tx.uceApplication.updateMany({
        where: {
          id: applicationId,
          campaignId,
          status: UceApplicationStatus.PENDING,
        },
        data: {
          status: UceApplicationStatus.APPROVED,
          approvedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          "Application approval was already resolved by another request",
        );
      }

      const now = new Date();
      await tx.uceApplication.updateMany({
        where: {
          campaignId,
          campaignCreatorId: application.campaignCreatorId,
          status: UceApplicationStatus.PENDING,
          id: { not: applicationId },
        },
        data: {
          status: UceApplicationStatus.SUPERSEDED,
          supersededByApplicationId: applicationId,
          supersededAt: now,
        },
      });

      const legacyCollab = await tx.uceCampaignCollaboration.findFirst({
        where: {
          campaignId,
          instagramHandle: {
            equals: application.campaignCreator.socialHandle,
            mode: "insensitive",
          },
        },
      });

      const commercials = await tx.uceCampaignCommercials.findUnique({
        where: { campaignId },
      });
      const advancePercent = commercials?.advancePaymentPercentage ?? 30;
      let totalQuote = 0;
      if (commercials) {
        totalQuote =
          commercials.compensationType === "FIXED_FEE"
            ? decimalToNumber(commercials.fixedFeeAmount)
            : decimalToNumber(commercials.negotiableMaxFee);
      }
      const { advance30Value, balance70Value } = splitEscrowQuote(
        totalQuote,
        advancePercent,
      );

      if (product.inventoryCount > 0) {
        await tx.uceCampaignProduct.update({
          where: { id: product.id },
          data: { inventoryCount: { decrement: 1 } },
        });
      }

      if (
        legacyCollab &&
        (legacyCollab.collabStatus === UceCollabStatus.APPLICANT_PENDING ||
          legacyCollab.collabStatus === UceCollabStatus.APPLICANT_SHORTLISTED)
      ) {
        const milestoneDeadline = defaultMilestoneDeadline(14);
        await tx.uceCampaignCollaboration.update({
          where: { id: legacyCollab.id },
          data: {
            collabStatus: UceCollabStatus.ACTIVE_WORKFLOW,
            currentMilestone: UceMilestoneStage.STAGE_1_NEGOTIATION,
            productId: application.campaignAssetId,
            totalQuote,
            advance30Value,
            balance70Value,
            negotiationState: UceNegotiationSubState.CREATOR_COUNTER,
            currentMilestoneDeadline: milestoneDeadline,
            ...buildPhaseSyncPatch({
              ...legacyCollab,
              collabStatus: UceCollabStatus.ACTIVE_WORKFLOW,
              currentMilestone: UceMilestoneStage.STAGE_1_NEGOTIATION,
              currentMilestoneDeadline: milestoneDeadline,
            }),
          },
        });

        await tx.uceCollaborationAuditLog.create({
          data: {
            collaborationId: legacyCollab.id,
            stageContext: UceMilestoneStage.STAGE_1_NEGOTIATION,
            systemEventTag: "APPLICANT_APPROVED",
            messagePayload: `Creator ${legacyCollab.instagramHandle} approved and Collaboration created`,
            actorIdentifier: actorId,
          },
        });

        await tx.uceCampaignPerformanceAggregate.update({
          where: { campaignId },
          data: {
            totalApplicantsCount: { decrement: 1 },
            totalActiveCollabsCount: { increment: 1 },
          },
        });
      }

      const creatorUserId =
        await this.collaborationProvision.ensureCreatorUserInTransaction(
          tx,
          application.campaignCreator.email,
          application.campaignCreator.socialHandle,
        );

      const workflow =
        await this.collaborationProvision.provisionFromUceApprovalInTransaction(
          tx,
          {
            brandProfileId,
            campaignId,
            briefId: application.briefId,
            creatorUserId,
            productId: application.campaignAssetId,
            ucePipelineCollaborationId: legacyCollab?.id,
            initialQuote: totalQuote,
            advancePercent,
            allowExisting: false,
            welcomeMessage: `Congrats @${application.campaignCreator.socialHandle}! You're approved. View your brief and secure your spot.`,
          },
        );

      return {
        workflowCollaborationId: workflow.collaboration_id,
      };
    });

    await this.collaborationProvision.broadcastProvisioned(
      result.workflowCollaborationId,
    );

    return {
      ok: true,
      applicationId,
      status: "APPROVED" as const,
      workflowCollaborationId: result.workflowCollaborationId,
    };
  }

  async reject(
    brandProfileId: string,
    campaignId: string,
    applicationId: string,
    actorId: string,
    reason?: string,
  ) {
    const parsed = rejectApplicationInputSchema.safeParse({ applicationId });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const application = await this.prisma.uceApplication.findFirst({
      where: { id: applicationId, campaignId },
      include: { campaignCreator: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    if (application.status !== UceApplicationStatus.PENDING) {
      throw new BadRequestException(
        "Only PENDING applications can be rejected",
      );
    }

    await this.prisma.uceApplication.update({
      where: { id: applicationId },
      data: {
        status: UceApplicationStatus.REJECTED,
        rejectedAt: new Date(),
      },
    });

    const collab = await this.prisma.uceCampaignCollaboration.findFirst({
      where: {
        campaignId,
        instagramHandle: {
          equals: application.campaignCreator.socialHandle,
          mode: "insensitive",
        },
      },
    });
    if (
      collab &&
      (collab.collabStatus === UceCollabStatus.APPLICANT_PENDING ||
        collab.collabStatus === UceCollabStatus.APPLICANT_SHORTLISTED)
    ) {
      await this.pipeline.rejectApplicant(
        brandProfileId,
        campaignId,
        collab.id,
        { rejection_reason: reason?.trim() || "Rejected" },
        actorId,
      );
    }

    return { ok: true, applicationId, status: "REJECTED" as const };
  }
}
