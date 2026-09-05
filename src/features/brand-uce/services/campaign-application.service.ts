import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  UceApplicationAuthorityVersion,
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
import type { AuthUser } from "../../auth/types/auth-user";
import { ApplicationTerminalService } from "../../campaign-applications/application-terminal.service";
import { projectApplication } from "../../campaign-applications/application-history.service";
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

const CANONICAL_HANDOFF_NOT_AVAILABLE =
  "C03_CANONICAL_APPLICATION_HANDOFF_NOT_AVAILABLE";

type LegacyApplicationShape = {
  authorityVersion: UceApplicationAuthorityVersion;
  campaignCreatorId: string | null;
  legacyCampaignProductId: string | null;
  legacyBriefId: string | null;
  campaignCreator: { socialHandle: string; email?: string | null } | null;
};

function assertLegacyApplicationShape(
  application: LegacyApplicationShape,
): asserts application is LegacyApplicationShape & {
  authorityVersion: typeof UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY;
  campaignCreatorId: string;
  legacyCampaignProductId: string;
  legacyBriefId: string;
  campaignCreator: { socialHandle: string; email?: string | null };
} {
  if (
    application.authorityVersion !==
      UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY ||
    !application.campaignCreator ||
    !application.campaignCreatorId ||
    !application.legacyCampaignProductId ||
    !application.legacyBriefId
  ) {
    throw new ConflictException("C03_LEGACY_APPLICATION_SHAPE_INVALID");
  }
}

@Injectable()
export class CampaignApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
    private readonly pipeline: BrandUcePipelineService,
    private readonly collaborationProvision: CollaborationProvisionService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
    @Optional()
    private readonly canonicalTerminals?: ApplicationTerminalService,
  ) {}

  async routeDecision(
    user: AuthUser,
    brandProfileId: string,
    campaignId: string,
    applicationId: string,
    command: "APPROVE" | "REJECT",
    key: unknown,
    reason?: string,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);
    const row = await this.prisma.uceApplication.findFirst({
      where: { id: applicationId, campaignId },
      select: { authorityVersion: true },
    });
    if (!row) throw new NotFoundException({ code: "APPLICATION_NOT_FOUND" });
    if (row.authorityVersion === "C03_CANONICAL") {
      if (!this.canonicalTerminals)
        throw new ConflictException({ code: CANONICAL_HANDOFF_NOT_AVAILABLE });
      return this.canonicalTerminals.decide(
        user,
        campaignId,
        applicationId,
        command,
        key,
      );
    }
    return command === "APPROVE"
      ? this.approve(brandProfileId, campaignId, applicationId, user.id)
      : this.reject(brandProfileId, campaignId, applicationId, user.id, reason);
  }

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
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
          campaignCreatorId: creator.id,
          legacyBriefId: row.briefId,
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
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
          legacyRequestId: `legacy-${row.id}`,
          campaignId,
          campaignCreatorId: creator.id,
          legacyCampaignProductId: assetId,
          legacyBriefId: row.briefId,
          status,
          source: UceApplicationSource.DIRECT,
          legacyRejectedAt:
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

    const [rows, canonicalRows, canonicalCount] = await Promise.all([
      this.prisma.uceApplication.findMany({
        where: {
          campaignId,
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
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
      }),
      this.prisma.uceApplication.findMany({
        where: {
          campaignId,
          authorityVersion: UceApplicationAuthorityVersion.C03_CANONICAL,
        },
        include: { snapshot: true, collaboration: { select: { id: true } } },
        orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
        take: 50,
      }),
      this.prisma.uceApplication.count({
        where: {
          campaignId,
          authorityVersion: UceApplicationAuthorityVersion.C03_CANONICAL,
        },
      }),
    ]);

    const applicants = rows.map((row) => {
      assertLegacyApplicationShape(row);
      return {
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
        campaignAssetId: row.legacyCampaignProductId,
        briefId: row.legacyBriefId,
        canonicalCampaignAssetId: null,
        canonicalBriefId: null,
        referenceAuthority: "LEGACY_COMPATIBILITY" as const,
        intelligenceStatus: "UNAVAILABLE" as const,
      };
    });

    const canonical = canonicalRows.map((row) => {
      const projection = projectApplication(row);
      return {
        ...projection,
        name:
          typeof projection.creator.displayName === "string"
            ? projection.creator.displayName
            : "Creator",
        applicationStatus: row.status,
        source: row.source,
        campaignAssetId: row.canonicalCampaignAssetId,
        briefId: row.canonicalBriefId,
        canApprove: row.status === "PENDING",
        canApprovePending: row.status === "PENDING",
        canReject: row.status === "PENDING",
      };
    });
    return {
      state:
        rows.length || canonical.length
          ? ("READY" as const)
          : ("EMPTY" as const),
      reason: null,
      canonicalApplicationCount: canonicalCount,
      applicants: [...applicants, ...canonical].sort(
        (a, b) =>
          b.appliedAt.localeCompare(a.appliedAt) ||
          b.applicationId.localeCompare(a.applicationId),
      ),
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
        where: {
          id: applicationId,
          campaignId,
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
        },
        include: { campaignCreator: true },
      });
      if (!application) throw new NotFoundException("Application not found");
      assertLegacyApplicationShape(application);
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
          id: application.legacyCampaignProductId,
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
          id: application.legacyBriefId,
          campaignId,
          productId: application.legacyCampaignProductId,
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
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
          status: UceApplicationStatus.PENDING,
        },
        data: {
          status: UceApplicationStatus.APPROVED,
          legacyApprovedAt: new Date(),
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
          authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
          campaignCreatorId: application.campaignCreatorId,
          status: UceApplicationStatus.PENDING,
          id: { not: applicationId },
        },
        data: {
          status: UceApplicationStatus.SUPERSEDED,
          supersededByApplicationId: applicationId,
          legacySupersededAt: now,
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
            productId: application.legacyCampaignProductId,
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
            briefId: application.legacyBriefId,
            creatorUserId,
            productId: application.legacyCampaignProductId,
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
      where: {
        id: applicationId,
        campaignId,
        authorityVersion: UceApplicationAuthorityVersion.LEGACY_COMPATIBILITY,
      },
      include: { campaignCreator: true },
    });
    if (!application) throw new NotFoundException("Application not found");
    assertLegacyApplicationShape(application);
    if (application.status !== UceApplicationStatus.PENDING) {
      throw new BadRequestException(
        "Only PENDING applications can be rejected",
      );
    }

    await this.prisma.uceApplication.update({
      where: { id: applicationId },
      data: {
        status: UceApplicationStatus.REJECTED,
        legacyRejectedAt: new Date(),
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
