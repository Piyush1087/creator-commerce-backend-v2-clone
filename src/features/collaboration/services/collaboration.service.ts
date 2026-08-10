import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CollaborationIndustryType,
  CollaborationMediaReviewStatus,
  CollaborationMessageKind,
  CollaborationPayoutMode,
  Prisma,
  UceMilestoneStage,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { splitEscrowQuote } from "../../brand-uce/utils/uce-decimal.util";
import type {
  AcceptCommercialsDto,
  BrandCounterOfferDto,
  DispatchLogisticsDto,
  FundEscrowDto,
  PostCollaborationMessageDto,
  ReportFulfillmentIssueDto,
  ReviewCollaborationMediaDto,
  SubmitCollaborationMediaDto,
  SubmitCollaborationReviewDto,
  SubmitCreatorQuoteDto,
  SubmitLivePostDto,
  UploadReceiptDto,
} from "../dto/collaboration-actions.dto";
import { ListCollaborationThreadsQueryDto } from "../dto/collaboration-query.dto";
import {
  assertAdvanceReceiptNotUploaded,
  assertBrandCanCounter,
  assertComplianceNotVerified,
  assertCreatorCanSubmitQuote,
  assertEscrowNotFunded,
  assertLivePostNotSubmitted,
  assertLogisticsNotDispatched,
  assertNoPendingMedia,
  assertReceiptNotConfirmed,
  logisticsIsDispatched,
} from "../utils/collaboration-action-guards";
import {
  mapCollaborationDetail,
  mapCollaborationThreadRow,
  mapMessageRow,
  toDecimal,
} from "../utils/collaboration-thread.mapper";
import {
  COLLABORATION_THREAD_INCLUDE,
  CollaborationAccessService,
} from "./collaboration-access.service";
import { CollaborationRealtimeService } from "./collaboration-realtime.service";

const LIVE_URL_DOMAINS = [/instagram\.com/i, /tiktok\.com/i, /youtube\.com/i];

@Injectable()
export class CollaborationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CollaborationAccessService,
    private readonly realtime: CollaborationRealtimeService,
  ) {}

  async listThreads(user: AuthUser, query: ListCollaborationThreadsQueryDto) {
    const where: Prisma.CollaborationWhereInput = {};

    if (user.role === UserRole.BRAND) {
      where.brandProfileId = await this.access.resolveBrandProfileId(user);
    } else if (user.role === UserRole.CREATOR) {
      where.creatorUserId = user.id;
    } else {
      throw new ForbiddenException("Unsupported role");
    }

    if (query.campaign_id) {
      where.campaignId = query.campaign_id;
    }
    if (query.brief_id) {
      where.briefId = query.brief_id;
    }
    if (query.stage) {
      where.currentStage = query.stage;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { campaign: { name: { contains: term, mode: "insensitive" } } },
        { brief: { internalTitle: { contains: term, mode: "insensitive" } } },
        {
          creatorUser: {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const rows = await this.prisma.collaboration.findMany({
      where,
      include: COLLABORATION_THREAD_INCLUDE,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });

    const viewerRole = user.role === UserRole.BRAND ? "BRAND" : "CREATOR";
    return {
      rows: rows.map((row) => mapCollaborationThreadRow(row, viewerRole)),
    };
  }

  async getThread(user: AuthUser, collaborationId: string) {
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    const viewerRole = user.role === UserRole.BRAND ? "BRAND" : "CREATOR";

    await this.clearUnread(user, collaborationId);

    return mapCollaborationDetail(thread);
  }

  async listMessages(user: AuthUser, collaborationId: string) {
    await this.access.assertThreadForUser(user, collaborationId);
    const messages = await this.prisma.collaborationMessage.findMany({
      where: { collaborationId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return { messages: messages.map(mapMessageRow) };
  }

  async postMessage(
    user: AuthUser,
    collaborationId: string,
    dto: PostCollaborationMessageDto,
  ) {
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    if (thread.isTerminated) {
      throw new BadRequestException("Collaboration is terminated");
    }

    const msg = await this.prisma.$transaction(async (tx) => {
      const created = await tx.collaborationMessage.create({
        data: {
          collaborationId,
          senderUserId: user.id,
          kind: CollaborationMessageKind.USER,
          body: dto.body.trim(),
        },
      });

      await tx.collaboration.update({
        where: { id: collaborationId },
        data: {
          lastMessageSnippet: dto.body.trim().slice(0, 200),
          lastMessageAt: new Date(),
          ...(user.role === UserRole.BRAND
            ? { unreadCountCreator: { increment: 1 } }
            : { unreadCountBrand: { increment: 1 } }),
        },
      });

      return created;
    });

    void this.realtime.broadcast(collaborationId, "message.created");
    return mapMessageRow(msg);
  }

  async submitCreatorQuote(
    user: AuthUser,
    collaborationId: string,
    dto: SubmitCreatorQuoteDto,
  ) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_1_NEGOTIATION);
    if (
      thread.payoutMode === CollaborationPayoutMode.BARTER &&
      dto.total_quote !== 0
    ) {
      throw new BadRequestException("Barter collaborations require zero quote");
    }
    if (thread.negotiationRound >= 2) {
      throw new BadRequestException("Negotiation round cap reached");
    }
    assertCreatorCanSubmitQuote(thread.negotiationRound, thread.commercials);

    const campaign = await this.prisma.uceCampaignCommercials.findUnique({
      where: { campaignId: thread.campaignId },
    });
    const advancePercent = campaign?.advancePaymentPercentage ?? 30;
    const { advance30Value, balance70Value } = splitEscrowQuote(
      dto.total_quote,
      advancePercent,
    );

    const isFinalOffer = thread.negotiationRound >= 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationCommercial.update({
        where: { collaborationId },
        data: {
          initialQuote:
            thread.commercials?.initialQuote ?? toDecimal(dto.total_quote),
          finalQuote: toDecimal(dto.total_quote),
          productRetailValue: toDecimal(
            dto.product_retail_value ??
              Number(thread.commercials?.productRetailValue ?? 0),
          ),
          advance30Amount: toDecimal(advance30Value),
          balance70Amount: toDecimal(balance70Value),
          isFinalOffer,
        },
      });
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: { negotiationRound: { increment: 1 } },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        isFinalOffer ? "CREATOR_FINAL_QUOTE" : "CREATOR_QUOTE_SUBMITTED",
        isFinalOffer
          ? `Final offer submitted: ₹${dto.total_quote}`
          : `Proposed quote: ₹${dto.total_quote}`,
        { unreadBrand: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async brandCounterOffer(
    user: AuthUser,
    collaborationId: string,
    dto: BrandCounterOfferDto,
  ) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_1_NEGOTIATION);
    if (thread.negotiationRound >= 2) {
      throw new BadRequestException("Negotiation round cap reached");
    }
    assertBrandCanCounter(thread.commercials);

    const campaign = await this.prisma.uceCampaignCommercials.findUnique({
      where: { campaignId: thread.campaignId },
    });
    const advancePercent = campaign?.advancePaymentPercentage ?? 30;
    const { advance30Value, balance70Value } = splitEscrowQuote(
      dto.counter_offer,
      advancePercent,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationCommercial.update({
        where: { collaborationId },
        data: {
          brandCounterOffer: toDecimal(dto.counter_offer),
          finalQuote: toDecimal(dto.counter_offer),
          advance30Amount: toDecimal(advance30Value),
          balance70Amount: toDecimal(balance70Value),
        },
      });
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: { negotiationRound: { increment: 1 } },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "BRAND_COUNTER_OFFER",
        `Brand counter-offer: ₹${dto.counter_offer}`,
        { unreadCreator: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async acceptCommercials(
    user: AuthUser,
    collaborationId: string,
    dto: AcceptCommercialsDto,
  ) {
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_1_NEGOTIATION);

    const finalQuote =
      dto.final_quote ??
      Number(
        thread.commercials?.finalQuote ??
          thread.commercials?.brandCounterOffer ??
          thread.commercials?.initialQuote ??
          0,
      );

    if (
      thread.payoutMode !== CollaborationPayoutMode.BARTER &&
      finalQuote <= 0
    ) {
      throw new BadRequestException("Final quote must be positive");
    }

    const nextStage =
      thread.payoutMode === CollaborationPayoutMode.BARTER
        ? UceMilestoneStage.STAGE_3_LOGISTICS
        : UceMilestoneStage.STAGE_2_SECUREMENT;

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationCommercial.update({
        where: { collaborationId },
        data: { finalQuote: toDecimal(finalQuote) },
      });
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: {
          currentStage: nextStage,
          stageUpdatedAt: new Date(),
        },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "COMMERCIALS_LOCKED",
        `Commercials locked at ₹${finalQuote}. Moving to ${nextStage}.`,
        { unreadBrand: true, unreadCreator: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async fundEscrow(
    user: AuthUser,
    collaborationId: string,
    dto: FundEscrowDto,
  ) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_2_SECUREMENT);
    if (thread.payoutMode !== CollaborationPayoutMode.ESCROW) {
      throw new BadRequestException(
        "Escrow funding only applies to ESCROW mode",
      );
    }
    assertEscrowNotFunded(thread.commercials);

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationCommercial.update({
        where: { collaborationId },
        data: {
          escrowVaultId: dto.escrow_vault_id ?? `vault_${collaborationId}`,
          escrowStatus: CollaborationEscrowStatus.FUNDED,
        },
      });
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: { currentStage: UceMilestoneStage.STAGE_3_LOGISTICS },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "ESCROW_FUNDED",
        "Escrow funded. Logistics stage unlocked.",
        { unreadCreator: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async uploadAdvanceReceipt(
    user: AuthUser,
    collaborationId: string,
    dto: UploadReceiptDto,
  ) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    if (thread.payoutMode !== CollaborationPayoutMode.MANUAL) {
      throw new BadRequestException(
        "Manual receipt upload requires MANUAL payout mode",
      );
    }
    this.assertStage(thread, UceMilestoneStage.STAGE_2_SECUREMENT);
    assertAdvanceReceiptNotUploaded(thread.commercials);

    await this.prisma.collaborationCommercial.update({
      where: { collaborationId },
      data: { advanceReceiptUrl: dto.receipt_url },
    });
    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async confirmManualAdvanceReceived(user: AuthUser, collaborationId: string) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    if (thread.payoutMode !== CollaborationPayoutMode.MANUAL) {
      throw new BadRequestException(
        "Manual confirmation requires MANUAL payout mode",
      );
    }
    if (!thread.commercials?.advanceReceiptUrl) {
      throw new BadRequestException(
        "Brand has not uploaded advance receipt yet",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: { currentStage: UceMilestoneStage.STAGE_3_LOGISTICS },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "MANUAL_ADVANCE_CONFIRMED",
        "Creator confirmed manual advance receipt.",
        { unreadBrand: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async dispatchLogistics(
    user: AuthUser,
    collaborationId: string,
    dto: DispatchLogisticsDto,
  ) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_3_LOGISTICS);
    assertLogisticsNotDispatched(thread.logistics);

    if (
      thread.industry === CollaborationIndustryType.D2C_ECOMMERCE &&
      !dto.tracking_id?.trim()
    ) {
      throw new BadRequestException(
        "tracking_id is required for D2C collaborations",
      );
    }
    if (
      thread.industry !== CollaborationIndustryType.D2C_ECOMMERCE &&
      !dto.digital_access_credentials?.trim() &&
      !dto.redemption_code?.trim() &&
      !dto.tracking_id?.trim()
    ) {
      throw new BadRequestException(
        "Provide digital access credentials, a redemption code, or a tracking ID.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationLogistics.update({
        where: { collaborationId },
        data: {
          trackingId: dto.tracking_id,
          courierName: dto.courier_name,
          digitalAccessCredentials: dto.digital_access_credentials,
          redemptionCode: dto.redemption_code,
        },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "LOGISTICS_DISPATCHED",
        "Brand dispatched logistics / access credentials.",
        { unreadCreator: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async confirmReceipt(user: AuthUser, collaborationId: string) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_3_LOGISTICS);
    assertReceiptNotConfirmed(thread.logistics);
    if (!logisticsIsDispatched(thread.logistics)) {
      throw new BadRequestException(
        "Brand has not dispatched logistics yet. Wait for tracking or access details.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationLogistics.update({
        where: { collaborationId },
        data: {
          isReceivedConfirmed: true,
          confirmedAt: new Date(),
        },
      });
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: { currentStage: UceMilestoneStage.STAGE_4_CONTENT_REVIEW },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "LOGISTICS_RECEIVED",
        "Creator confirmed receipt. Production unlocked.",
        { unreadBrand: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async reportFulfillmentIssue(
    user: AuthUser,
    collaborationId: string,
    dto: ReportFulfillmentIssueDto,
  ) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_3_LOGISTICS);
    assertReceiptNotConfirmed(thread.logistics);

    const nextCount = thread.fulfillmentIssueCount + 1;
    const deadlock = nextCount >= 2;

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationLogistics.update({
        where: { collaborationId },
        data: {
          lastReportedIssue: dto.issue_type,
          issueDescription: dto.description,
        },
      });
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: {
          fulfillmentIssueCount: nextCount,
          ...(deadlock ? { isTerminated: true, isPaused: true } : {}),
        },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        deadlock ? "LOGISTICS_DEADLOCK" : "LOGISTICS_ISSUE",
        dto.description,
        { unreadBrand: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async submitMedia(
    user: AuthUser,
    collaborationId: string,
    dto: SubmitCollaborationMediaDto,
  ) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_4_CONTENT_REVIEW);
    if (!thread.logistics?.isReceivedConfirmed) {
      throw new BadRequestException(
        "Confirm logistics receipt before uploading content",
      );
    }

    const pendingCount = await this.prisma.collaborationMedia.count({
      where: {
        collaborationId,
        status: CollaborationMediaReviewStatus.PENDING,
      },
    });
    assertNoPendingMedia(pendingCount);

    const versionNumber = thread.revisionCount + 1;
    const autoApprovalDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationMedia.create({
        data: {
          collaborationId,
          phase: dto.phase,
          versionNumber,
          mediaUrl: dto.media_url,
          deliverableType: dto.deliverable_type,
          isAspectRatioVerified: dto.is_aspect_ratio_verified ?? false,
          autoApprovalDeadline,
        },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "MEDIA_SUBMITTED",
        `Media submitted (v${versionNumber}). 72-hour review clock started.`,
        { unreadBrand: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async reviewMedia(
    user: AuthUser,
    collaborationId: string,
    dto: ReviewCollaborationMediaDto,
  ) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_4_CONTENT_REVIEW);

    const pending = await this.prisma.collaborationMedia.findFirst({
      where: {
        collaborationId,
        status: CollaborationMediaReviewStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) {
      throw new BadRequestException("No pending media to review");
    }

    const rejectTermination =
      dto.decision === "REJECTED" && thread.revisionCount >= 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationMedia.update({
        where: { id: pending.id },
        data: {
          status:
            dto.decision === "APPROVED"
              ? CollaborationMediaReviewStatus.APPROVED
              : CollaborationMediaReviewStatus.REJECTED,
          brandFeedback: dto.brand_feedback,
        },
      });

      if (dto.decision === "REJECTED") {
        await tx.collaboration.update({
          where: { id: collaborationId },
          data: {
            revisionCount: { increment: 1 },
            ...(rejectTermination
              ? { isTerminated: true, isPaused: true }
              : {}),
          },
        });
      } else {
        await tx.collaboration.update({
          where: { id: collaborationId },
          data: { currentStage: UceMilestoneStage.STAGE_5_PUBLISHING },
        });
      }

      await this.appendSystemMessage(
        tx,
        collaborationId,
        dto.decision === "APPROVED" ? "MEDIA_APPROVED" : "MEDIA_REJECTED",
        dto.brand_feedback ?? `Media ${dto.decision.toLowerCase()}`,
        { unreadCreator: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async submitLivePost(
    user: AuthUser,
    collaborationId: string,
    dto: SubmitLivePostDto,
  ) {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_5_PUBLISHING);
    assertLivePostNotSubmitted(thread.finalization);
    if (!LIVE_URL_DOMAINS.some((re) => re.test(dto.live_post_url))) {
      throw new BadRequestException(
        "live_post_url must be Instagram, TikTok, or YouTube",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationFinalization.update({
        where: { collaborationId },
        data: {
          livePostUrl: dto.live_post_url,
          partnershipAdCode: dto.partnership_ad_code,
        },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "LIVE_POST_SUBMITTED",
        "Creator submitted live post URL for brand compliance review.",
        { unreadBrand: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async verifyCompliance(user: AuthUser, collaborationId: string) {
    if (user.role !== UserRole.BRAND) {
      throw new ForbiddenException("Brand access required");
    }
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_5_PUBLISHING);
    assertComplianceNotVerified(thread.finalization);
    const fin = thread.finalization;
    if (!fin?.livePostUrl) {
      throw new BadRequestException("Live post URL missing");
    }
    if (!LIVE_URL_DOMAINS.some((re) => re.test(fin.livePostUrl!))) {
      throw new BadRequestException("Live URL domain verification failed");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.collaborationFinalization.update({
        where: { collaborationId },
        data: {
          isComplianceVerified: true,
          isFinalPayoutReleased:
            thread.payoutMode === CollaborationPayoutMode.ESCROW,
        },
      });
      if (thread.payoutMode === CollaborationPayoutMode.ESCROW) {
        await tx.collaborationCommercial.update({
          where: { collaborationId },
          data: { escrowStatus: CollaborationEscrowStatus.SETTLED },
        });
      }
      await tx.collaboration.update({
        where: { id: collaborationId },
        data: { currentStage: UceMilestoneStage.STAGE_6_FEEDBACK_SYNC },
      });
      await this.appendSystemMessage(
        tx,
        collaborationId,
        "COMPLIANCE_VERIFIED",
        "Compliance verified. Final settlement staged.",
        { unreadCreator: true },
      );
    });

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  async submitReview(
    user: AuthUser,
    collaborationId: string,
    dto: SubmitCollaborationReviewDto,
  ) {
    const thread = await this.access.assertThreadForUser(user, collaborationId);
    this.assertStage(thread, UceMilestoneStage.STAGE_6_FEEDBACK_SYNC);

    const fin = await this.prisma.collaborationFinalization.findUniqueOrThrow({
      where: { collaborationId },
    });

    if (user.role === UserRole.CREATOR && fin.creatorRating != null) {
      throw new BadRequestException("You already submitted your rating.");
    }
    if (user.role === UserRole.BRAND && fin.brandRating != null) {
      throw new BadRequestException("You already submitted your rating.");
    }

    const patch =
      user.role === UserRole.CREATOR
        ? {
            creatorRating: dto.rating,
            creatorReviewText: dto.review_text,
          }
        : {
            brandRating: dto.rating,
            brandReviewText: dto.review_text,
          };

    const updated = await this.prisma.collaborationFinalization.update({
      where: { collaborationId },
      data: patch,
    });

    const bothSubmitted =
      (user.role === UserRole.CREATOR
        ? updated.brandRating != null
        : updated.creatorRating != null) ||
      (updated.brandRating != null && updated.creatorRating != null);

    if (bothSubmitted) {
      await this.prisma.collaborationFinalization.update({
        where: { collaborationId },
        data: { reviewsVisible: true },
      });
    }

    return this.broadcastAndReturnThread(user, collaborationId);
  }

  private async broadcastAndReturnThread(
    user: AuthUser,
    collaborationId: string,
  ) {
    await this.realtime.broadcast(collaborationId, "thread.updated");
    return this.getThread(user, collaborationId);
  }

  private assertStage(
    thread: { currentStage: UceMilestoneStage; isTerminated: boolean },
    expected: UceMilestoneStage,
  ) {
    if (thread.isTerminated) {
      throw new BadRequestException("Collaboration is terminated");
    }
    if (thread.currentStage !== expected) {
      throw new BadRequestException(
        `Expected stage ${expected}, current ${thread.currentStage}`,
      );
    }
  }

  private async clearUnread(user: AuthUser, collaborationId: string) {
    if (user.role === UserRole.BRAND) {
      await this.prisma.collaboration.updateMany({
        where: { id: collaborationId },
        data: { unreadCountBrand: 0 },
      });
    } else if (user.role === UserRole.CREATOR) {
      await this.prisma.collaboration.updateMany({
        where: { id: collaborationId },
        data: { unreadCountCreator: 0 },
      });
    }
  }

  private async appendSystemMessage(
    tx: Prisma.TransactionClient,
    collaborationId: string,
    tag: string,
    body: string,
    unread: { unreadBrand?: boolean; unreadCreator?: boolean },
  ) {
    await tx.collaborationMessage.create({
      data: {
        collaborationId,
        kind: CollaborationMessageKind.SYSTEM,
        systemEventTag: tag,
        body,
      },
    });
    await tx.collaboration.update({
      where: { id: collaborationId },
      data: {
        lastMessageSnippet: body.slice(0, 200),
        lastMessageAt: new Date(),
        ...(unread.unreadBrand ? { unreadCountBrand: { increment: 1 } } : {}),
        ...(unread.unreadCreator
          ? { unreadCountCreator: { increment: 1 } }
          : {}),
      },
    });
  }
}
