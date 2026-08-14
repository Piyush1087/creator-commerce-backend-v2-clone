import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  Prisma,
  UceApplicationSource,
  UceApplicationStatus,
  UceCampaignCreatorIngestionMethod,
  UceCampaignCreatorSource,
  UceCollabStatus,
  UceLogisticsSubState,
  UceMediaPlatform,
  UceMilestoneStage,
  UceNegotiationSubState,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { buildPhaseSyncPatch } from "../../../shared/uce/uce-production-phase.util";
import { generateInvitationToken } from "../../creator-marketplace/utils/invitation-token.util";
import type {
  AddTrackingDto,
  ApproveApplicantDto,
  CreateProspectDto,
  PipelineQueryDto,
  PublishLivePostDto,
  RecordFulfillmentIssueDto,
  RejectApplicantDto,
  ReviewContentDto,
  SubmitContentDraftDto,
} from "../dto/brand-uce-pipeline.dto";
import { normalizeInstagramHandle } from "../utils/instagram-handle.util";
import { mapCollaborationRow } from "../utils/uce-collaboration-row.mapper";
import {
  decimalToNumber,
  splitEscrowQuote,
} from "../utils/uce-decimal.util";
import { CollaborationProvisionService } from "../../collaboration/services/collaboration-provision.service";
import { BrandUceAccessService } from "./brand-uce-access.service";

const PROSPECT_STATUSES: UceCollabStatus[] = [
  UceCollabStatus.PROSPECT_CURATED,
  UceCollabStatus.PROSPECT_INVITED,
];

const APPLICANT_STATUSES: UceCollabStatus[] = [
  UceCollabStatus.APPLICANT_PENDING,
  UceCollabStatus.APPLICANT_SHORTLISTED,
  UceCollabStatus.APPLICANT_REJECTED,
];

const COLLAB_INCLUDE = {
  brief: { select: { internalTitle: true } },
  product: { select: { skuCode: true, productName: true } },
} as const;

@Injectable()
export class BrandUcePipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
    private readonly collaborationProvision: CollaborationProvisionService,
  ) {}

  async listProspects(
    brandProfileId: string,
    campaignId: string,
    query: PipelineQueryDto,
  ) {
    return this.listByStatuses(
      brandProfileId,
      campaignId,
      PROSPECT_STATUSES,
      query,
    );
  }

  async listApplicants(
    brandProfileId: string,
    campaignId: string,
    query: PipelineQueryDto,
  ) {
    return this.listByStatuses(
      brandProfileId,
      campaignId,
      APPLICANT_STATUSES,
      query,
    );
  }

  async listActiveCollabs(
    brandProfileId: string,
    campaignId: string,
    query: PipelineQueryDto,
  ) {
    return this.listByStatuses(
      brandProfileId,
      campaignId,
      [UceCollabStatus.ACTIVE_WORKFLOW],
      query,
    );
  }

  async getCollaborationDetail(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    const auditLogs = await this.prisma.uceCollaborationAuditLog.findMany({
      where: { collaborationId },
      orderBy: { loggedAt: "asc" },
      take: 50,
    });

    const row = mapCollaborationRow(collab);
    const [enriched] = await this.enrichRowsWithWorkflowIds([row]);
    return {
      row: enriched,
      drawer: {
        performance_matrix: {
          match_score: decimalToNumber(collab.matchScore),
          instagram_handle: collab.instagramHandle,
          creator_email: collab.creatorEmail,
        },
        vetting_criteria_check: {
          vetting_remark: collab.vettingRemark,
          pipeline_health: collab.pipelineHealth,
        },
        audit_timeline: auditLogs.map((log) => ({
          log_id: log.id,
          stage_context: log.stageContext,
          system_event_tag: log.systemEventTag,
          log_message_payload: log.messagePayload,
          actor_identifier: log.actorIdentifier,
          logged_at: log.loggedAt.toISOString(),
        })),
      },
    };
  }

  async createApplicant(
    brandProfileId: string,
    campaignId: string,
    dto: CreateProspectDto,
    actorId: string,
  ) {
    const row = await this.createProspect(
      brandProfileId,
      campaignId,
      dto,
      actorId,
    );

    const updated = await this.prisma.uceCampaignCollaboration.update({
      where: { id: row.collaboration_id },
      data: { collabStatus: UceCollabStatus.APPLICANT_PENDING },
      include: COLLAB_INCLUDE,
    });

    await this.prisma.uceCampaignPerformanceAggregate.update({
      where: { campaignId },
      data: {
        totalProspectsCount: { decrement: 1 },
        totalApplicantsCount: { increment: 1 },
      },
    });

    return mapCollaborationRow(updated);
  }

  async createProspect(
    brandProfileId: string,
    campaignId: string,
    dto: CreateProspectDto,
    actorId: string,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const handle = normalizeInstagramHandle(dto.instagram_handle);
    const existing = await this.prisma.uceCampaignCollaboration.findUnique({
      where: {
        campaignId_instagramHandle: { campaignId, instagramHandle: handle },
      },
    });
    if (existing) {
      throw new ConflictException("Creator already exists in this campaign pipeline");
    }

    const brief = await this.prisma.uceCampaignBrief.findFirst({
      where: { id: dto.brief_id, campaignId },
    });
    if (!brief) {
      throw new BadRequestException("Brief not found for campaign");
    }

    const milestoneDeadline = this.defaultMilestoneDeadline();

    const collab = await this.prisma.$transaction(async (tx) => {
      const created = await tx.uceCampaignCollaboration.create({
        data: {
          campaignId,
          briefId: dto.brief_id,
          productId: dto.product_id ?? null,
          instagramHandle: handle,
          creatorEmail: dto.creator_email,
          matchScore: dto.match_score ?? 0,
          collabStatus: UceCollabStatus.PROSPECT_CURATED,
          negotiationState: UceNegotiationSubState.CREATOR_COUNTER,
          currentMilestoneDeadline: milestoneDeadline,
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId: created.id,
          stageContext: UceMilestoneStage.STAGE_1_NEGOTIATION,
          systemEventTag: "PROSPECT_CURATED",
          messagePayload: `Prospect ${handle} added to campaign pipeline`,
          actorIdentifier: actorId,
        },
      });

      await tx.uceCampaignPerformanceAggregate.update({
        where: { campaignId },
        data: { totalProspectsCount: { increment: 1 } },
      });

      return created;
    });

    return mapCollaborationRow(collab);
  }

  async inviteProspect(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    actorId: string,
    outreachMessage?: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    if (!PROSPECT_STATUSES.includes(collab.collabStatus)) {
      throw new BadRequestException("Collaboration is not in prospect state");
    }

    if (outreachMessage) {
      const wordCount = outreachMessage.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 20) {
        throw new BadRequestException(
          "Outreach templates must stay under 20 words (PIC-03)",
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const invitationToken =
        collab.invitationToken ?? generateInvitationToken();

      const row = await tx.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          collabStatus: UceCollabStatus.PROSPECT_INVITED,
          invitationToken,
          invitationSourceChannel: collab.invitationSourceChannel ?? "BRAND_UCE_PIPELINE",
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId,
          stageContext: collab.currentMilestone,
          systemEventTag: "PROSPECT_INVITED",
          messagePayload: outreachMessage ?? "Priority DM invitation sent",
          actorIdentifier: actorId,
        },
      });

      return row;
    });

    return mapCollaborationRow(updated);
  }

  async approveApplicant(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: ApproveApplicantDto,
    actorId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    if (
      collab.collabStatus !== UceCollabStatus.APPLICANT_PENDING &&
      collab.collabStatus !== UceCollabStatus.APPLICANT_SHORTLISTED
    ) {
      throw new BadRequestException("Collaboration is not pending approval");
    }

    const commercials = await this.prisma.uceCampaignCommercials.findUnique({
      where: { campaignId },
    });
    const advancePercent = commercials?.advancePaymentPercentage ?? 30;

    let totalQuote = dto.total_quote ?? 0;
    if (totalQuote <= 0 && commercials) {
      if (commercials.compensationType === "FIXED_FEE") {
        totalQuote = decimalToNumber(commercials.fixedFeeAmount);
      } else {
        totalQuote = decimalToNumber(commercials.negotiableMaxFee);
      }
    }

    const { advance30Value, balance70Value } = splitEscrowQuote(
      totalQuote,
      advancePercent,
    );

    const productId = dto.product_id ?? collab.productId;

    if (!productId) {
      throw new BadRequestException(
        "Approved Applications require an explicit Campaign Asset/Product",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (productId) {
        const product = await tx.uceCampaignProduct.findFirst({
          where: { id: productId, campaignId },
        });
        if (!product) {
          throw new BadRequestException("Product not found");
        }
        if (product.inventoryCount > 0) {
          await tx.uceCampaignProduct.update({
            where: { id: productId },
            data: { inventoryCount: { decrement: 1 } },
          });
        }
      }

      const row = await tx.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          collabStatus: UceCollabStatus.ACTIVE_WORKFLOW,
          currentMilestone: UceMilestoneStage.STAGE_1_NEGOTIATION,
          productId,
          totalQuote,
          advance30Value,
          balance70Value,
          negotiationState: UceNegotiationSubState.CREATOR_COUNTER,
          currentMilestoneDeadline: this.defaultMilestoneDeadline(14),
          ...buildPhaseSyncPatch({
            ...collab,
            collabStatus: UceCollabStatus.ACTIVE_WORKFLOW,
            currentMilestone: UceMilestoneStage.STAGE_1_NEGOTIATION,
            currentMilestoneDeadline: this.defaultMilestoneDeadline(14),
          }),
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId,
          stageContext: UceMilestoneStage.STAGE_1_NEGOTIATION,
          systemEventTag: "APPLICANT_APPROVED",
          messagePayload: `Creator ${collab.instagramHandle} approved and portal link dispatched`,
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

      return row;
    });

    const creatorUserId = await this.collaborationProvision.ensureCreatorUser(
      collab.creatorEmail,
      collab.instagramHandle,
    );
    const normalizedHandle = collab.instagramHandle
      .trim()
      .replace(/^@/, "")
      .toLowerCase();

    const sourceApplication = await this.prisma.$transaction(async (tx) => {
      const campaignCreator = await tx.uceCampaignCreator.upsert({
        where: {
          campaignId_platform_normalizedSocialHandle: {
            campaignId,
            platform: UceMediaPlatform.INSTAGRAM,
            normalizedSocialHandle: normalizedHandle,
          },
        },
        update: {
          creatorUserId,
          email: collab.creatorEmail,
          creatorProfileId: collab.creatorProfileId ?? undefined,
        },
        create: {
          campaignId,
          creatorUserId,
          creatorProfileId: collab.creatorProfileId,
          platform: UceMediaPlatform.INSTAGRAM,
          socialHandle: collab.instagramHandle,
          normalizedSocialHandle: normalizedHandle,
          email: collab.creatorEmail,
          source: UceCampaignCreatorSource.MANUAL,
          ingestionMethod: UceCampaignCreatorIngestionMethod.MANUAL_SINGLE,
        },
      });

      const application = await tx.uceApplication.upsert({
        where: { legacyPipelineCollaborationId: collaborationId },
        update: {
          status: UceApplicationStatus.APPROVED,
          approvedAt: new Date(),
          proposedFee: totalQuote,
        },
        create: {
          requestId: `legacy-pipeline:${collaborationId}`,
          campaignId,
          campaignCreatorId: campaignCreator.id,
          campaignAssetId: productId,
          briefId: collab.briefId,
          legacyPipelineCollaborationId: collaborationId,
          status: UceApplicationStatus.APPROVED,
          source: UceApplicationSource.LEGACY_PIPELINE,
          proposedFee: totalQuote,
          approvedAt: new Date(),
        },
        include: { snapshot: true },
      });
      if (!application.snapshot) {
        await tx.uceApplicationSnapshot.create({
          data: {
            applicationId: application.id,
            campaignContext: { campaignId },
            campaignAssetContext: { campaignAssetId: productId },
            briefContext: { briefId: collab.briefId },
            commercialContext: { proposedFee: totalQuote },
            creatorIdentity: {
              creatorUserId,
              instagramHandle: collab.instagramHandle,
            },
          },
        });
      }

      const existingDeliverables = await tx.uceBriefDeliverable.findMany({
        where: { briefId: collab.briefId },
        orderBy: { displayOrder: "asc" },
      });
      if (existingDeliverables.length === 0) {
        const brief = await tx.uceCampaignBrief.findUnique({
          where: { id: collab.briefId },
          select: { deliverableFormatTags: true },
        });
        const tags = brief?.deliverableFormatTags ?? [];
        const formats = tags.length > 0 ? tags : ["UNSPECIFIED"];
        await tx.uceBriefDeliverable.createMany({
          data: formats.map((format, index) => ({
            briefId: collab.briefId,
            format,
            displayOrder: index,
          })),
        });
      }

      return application;
    });

    const workflow =
      await this.collaborationProvision.provisionFromApprovedApplication({
        sourceApplicationId: sourceApplication.id,
        deliverablePublishingApplicability:
          dto.deliverable_publishing_applicability.map((item) => ({
            sourceBriefDeliverableId: item.source_brief_deliverable_id,
            publishingRequired: item.publishing_required,
          })),
      });

    const row = mapCollaborationRow(updated);
    row.workflow_collaboration_id = workflow.collaboration_id;
    return row;
  }

  async rejectApplicant(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: RejectApplicantDto,
    actorId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          collabStatus: UceCollabStatus.APPLICANT_REJECTED,
          rejectionReason: dto.rejection_reason,
          ...buildPhaseSyncPatch({
            ...collab,
            collabStatus: UceCollabStatus.APPLICANT_REJECTED,
          }),
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId,
          stageContext: collab.currentMilestone,
          systemEventTag: "APPLICANT_REJECTED",
          messagePayload: dto.rejection_reason,
          actorIdentifier: actorId,
        },
      });

      return row;
    });

    return mapCollaborationRow(updated);
  }

  async addTracking(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: AddTrackingDto,
    actorId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    if (collab.currentMilestone !== UceMilestoneStage.STAGE_3_LOGISTICS) {
      throw new BadRequestException(
        "Tracking can only be added during logistics stage",
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          logisticsCarrier: dto.logistics_carrier,
          logisticsTrackingNumber: dto.logistics_tracking_number,
          logisticsState: UceLogisticsSubState.IN_TRANSIT,
          ...buildPhaseSyncPatch({
            ...collab,
            currentMilestone: UceMilestoneStage.STAGE_3_LOGISTICS,
            logisticsState: UceLogisticsSubState.IN_TRANSIT,
          }),
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId,
          stageContext: UceMilestoneStage.STAGE_3_LOGISTICS,
          systemEventTag: "TRACKING_ADDED",
          messagePayload: `${dto.logistics_carrier}: ${dto.logistics_tracking_number}`,
          actorIdentifier: actorId,
        },
      });

      return row;
    });

    return mapCollaborationRow(updated);
  }

  async submitContentDraft(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: SubmitContentDraftDto,
    actorId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    const autoDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          contentDraftUrl: dto.content_draft_url,
          currentMilestone: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
          reviewState: "INITIAL_DRAFT_SUBMITTED",
          autoApprovalDeadline72h: autoDeadline,
          ...buildPhaseSyncPatch({
            ...collab,
            currentMilestone: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
            reviewState: "INITIAL_DRAFT_SUBMITTED",
            contentDraftUrl: dto.content_draft_url,
          }),
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId,
          stageContext: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
          systemEventTag: "DRAFT_SUBMITTED",
          messagePayload: "72-hour auto-approval clock started (BR-01)",
          actorIdentifier: actorId,
        },
      });

      return row;
    });

    return mapCollaborationRow(updated);
  }

  async reviewContent(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: ReviewContentDto,
    actorId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    if (collab.currentMilestone !== UceMilestoneStage.STAGE_4_CONTENT_REVIEW) {
      throw new BadRequestException("Not in content review stage");
    }

    if (dto.action === "request_revision") {
      if (collab.revisionRoundCount >= 2) {
        throw new BadRequestException(
          "Creative modification limit reached (BR-04). Maximum 2 revision rounds.",
        );
      }
      const updated = await this.prisma.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          revisionRoundCount: { increment: 1 },
          reviewState: "REVISION_ROUND_ACTIVE",
          autoApprovalDeadline72h: null,
        },
        include: COLLAB_INCLUDE,
      });
      await this.writeAudit(
        collaborationId,
        UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
        "REVISION_REQUESTED",
        `Revision round ${updated.revisionRoundCount}`,
        actorId,
      );
      return mapCollaborationRow(updated);
    }

    if (dto.action === "reject") {
      if (collab.revisionRoundCount >= 2) {
        const updated = await this.terminateWithAdvanceOnly(
          collaborationId,
          actorId,
        );
        return mapCollaborationRow(updated);
      }
      throw new BadRequestException(
        "Use request_revision before final rejection threshold",
      );
    }

    const updated = await this.prisma.uceCampaignCollaboration.update({
      where: { id: collaborationId },
      data: {
        currentMilestone: UceMilestoneStage.STAGE_5_PUBLISHING,
        reviewState: null,
        publishingState: "AWAITING_LIVE_POST",
        autoApprovalDeadline72h: null,
      },
      include: COLLAB_INCLUDE,
    });
    await this.writeAudit(
      collaborationId,
      UceMilestoneStage.STAGE_5_PUBLISHING,
      "CONTENT_APPROVED",
      "Brand approved content draft",
      actorId,
    );
    return mapCollaborationRow(updated);
  }

  async publishLivePost(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: PublishLivePostDto,
    actorId: string,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          livePublishedUrl: dto.live_published_url,
          currentMilestone: UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
          publishingState: "COMPLIANCE_CHECK_ACTIVE",
          complianceVerified: true,
        },
        include: COLLAB_INCLUDE,
      });

      await tx.uceCollaborationAuditLog.create({
        data: {
          collaborationId,
          stageContext: UceMilestoneStage.STAGE_6_FEEDBACK_SYNC,
          systemEventTag: "LIVE_POST_VERIFIED",
          messagePayload: dto.live_published_url,
          actorIdentifier: actorId,
        },
      });

      return row;
    });

    return mapCollaborationRow(updated);
  }

  async recordFulfillmentIssue(
    brandProfileId: string,
    campaignId: string,
    collaborationId: string,
    dto: RecordFulfillmentIssueDto,
    actorId: string,
  ) {
    const collab = await this.access.assertCollaborationOwned(
      brandProfileId,
      campaignId,
      collaborationId,
    );

    const nextCount = collab.fulfillmentIssueCount + 1;
    if (nextCount >= 2) {
      const updated = await this.prisma.uceCampaignCollaboration.update({
        where: { id: collaborationId },
        data: {
          fulfillmentIssueCount: nextCount,
          collabStatus: UceCollabStatus.TERMINATED_CANCELED,
          logisticsState: "DELIVERY_EXCEPTION",
          pipelineHealth: "SYSTEM_HOLD",
        },
        include: COLLAB_INCLUDE,
      });
      await this.writeAudit(
        collaborationId,
        collab.currentMilestone,
        "TWO_STRIKE_CANCELED",
        dto.remark ?? "Two-strike shipping rule triggered (BR-03)",
        actorId,
      );
      return mapCollaborationRow(updated);
    }

    const updated = await this.prisma.uceCampaignCollaboration.update({
      where: { id: collaborationId },
      data: {
        fulfillmentIssueCount: nextCount,
        logisticsState: "DELIVERY_EXCEPTION",
        pipelineHealth: "ACTION_OVERDUE",
      },
      include: COLLAB_INCLUDE,
    });
    return mapCollaborationRow(updated);
  }

  private async listByStatuses(
    brandProfileId: string,
    campaignId: string,
    statuses: UceCollabStatus[],
    query: PipelineQueryDto,
  ) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const where: Prisma.UceCampaignCollaborationWhereInput = {
      campaignId,
      collabStatus: { in: statuses },
    };

    if (query.brief_id) {
      where.briefId = query.brief_id;
    }
    if (query.stage) {
      where.currentMilestone = query.stage;
    }
    if (query.health) {
      where.pipelineHealth = query.health;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { instagramHandle: { contains: term, mode: "insensitive" } },
        { creatorEmail: { contains: term, mode: "insensitive" } },
      ];
    }

    const rows = await this.prisma.uceCampaignCollaboration.findMany({
      where,
      orderBy: [{ matchScore: "desc" }, { updatedAt: "desc" }],
      include: COLLAB_INCLUDE,
    });

    const mapped = rows.map(mapCollaborationRow);
    const enriched = await this.enrichRowsWithWorkflowIds(mapped);

    return {
      overview: {
        total: enriched.length,
        mean_match_score:
          enriched.length > 0
            ? enriched.reduce((s, r) => s + r.match_score, 0) / enriched.length
            : 0,
      },
      rows: enriched,
    };
  }

  private async enrichRowsWithWorkflowIds<
    T extends { collaboration_id: string; workflow_collaboration_id: string | null },
  >(rows: T[]): Promise<T[]> {
    if (rows.length === 0) {
      return rows;
    }
    const pipelineIds = rows.map((r) => r.collaboration_id);
    const links = await this.prisma.collaboration.findMany({
      where: { ucePipelineCollaborationId: { in: pipelineIds } },
      select: { id: true, ucePipelineCollaborationId: true },
    });
    const byPipelineId = new Map(
      links
        .filter((l) => l.ucePipelineCollaborationId != null)
        .map((l) => [l.ucePipelineCollaborationId as string, l.id]),
    );
    return rows.map((row) => ({
      ...row,
      workflow_collaboration_id:
        byPipelineId.get(row.collaboration_id) ?? null,
    }));
  }

  private defaultMilestoneDeadline(days = 7): Date {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async writeAudit(
    collaborationId: string,
    stage: UceMilestoneStage,
    tag: string,
    message: string,
    actorId: string,
  ) {
    await this.prisma.uceCollaborationAuditLog.create({
      data: {
        collaborationId,
        stageContext: stage,
        systemEventTag: tag,
        messagePayload: message,
        actorIdentifier: actorId,
      },
    });
  }

  private async terminateWithAdvanceOnly(
    collaborationId: string,
    actorId: string,
  ) {
    const updated = await this.prisma.uceCampaignCollaboration.update({
      where: { id: collaborationId },
      data: {
        collabStatus: UceCollabStatus.TERMINATED_CANCELED,
        reviewState: "CONTENT_HALTED_LOCK",
        pipelineHealth: "SYSTEM_HOLD",
      },
      include: COLLAB_INCLUDE,
    });
    await this.writeAudit(
      collaborationId,
      UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
      "BR04_TERMINATED",
      "Third rejection — creator paid 30% advance, brand retains no distribution rights",
      actorId,
    );
    return updated;
  }
}
