import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import type { AuthUser } from "../../auth/types/auth-user";
import { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";

const COLLABORATION_CONSUMER_SELECT = {
  id: true,
  brandProfileId: true,
  currentStage: true,
  negotiationRound: true,
  fulfillmentIssueCount: true,
  revisionCount: true,
  unreadCountBrand: true,
  lastMessageAt: true,
  stageUpdatedAt: true,
  isPaused: true,
  isTerminated: true,
  updatedAt: true,
  campaign: { select: { id: true, name: true } },
  brief: { select: { id: true, internalTitle: true } },
  product: { select: { id: true, productName: true } },
  creatorUser: {
    select: {
      name: true,
      creatorProfile: {
        select: { displayName: true, instagramHandle: true },
      },
    },
  },
  ucePipelineCollaboration: {
    select: {
      collabStatus: true,
      currentPhase: true,
      currentMilestone: true,
      pipelineHealth: true,
      actionRequiredByRole: true,
      currentMilestoneDeadline: true,
      autoApprovalDeadline72h: true,
      productionDeadlineAt: true,
    },
  },
} satisfies Prisma.CollaborationSelect;

type CollaborationConsumerRow = Prisma.CollaborationGetPayload<{
  select: typeof COLLABORATION_CONSUMER_SELECT;
}>;

@Injectable()
export class CollaborationConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: BrandWorkspaceAuthorizationService,
  ) {}

  async list(user: AuthUser) {
    const { brandProfileId } = await this.workspace.resolveBrandContext(user);
    const rows = await this.prisma.collaboration.findMany({
      where: { brandProfileId },
      select: COLLABORATION_CONSUMER_SELECT,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });
    return { collaborations: rows.map((row) => this.mapListRow(row)) };
  }

  async listForHome(user: AuthUser, limit: number) {
    const { brandProfileId } = await this.workspace.resolveBrandContext(user);
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const rows = await this.prisma.collaboration.findMany({
      where: { brandProfileId },
      select: COLLABORATION_CONSUMER_SELECT,
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: boundedLimit + 1,
    });
    return {
      collaborations: rows
        .slice(0, boundedLimit)
        .map((row) => this.mapListRow(row)),
      truncated: rows.length > boundedLimit,
    };
  }

  async read(user: AuthUser, collaborationId: string) {
    const { brandProfileId } = await this.workspace.resolveBrandContext(user);
    const row = await this.prisma.collaboration.findFirst({
      where: { id: collaborationId, brandProfileId },
      select: COLLABORATION_CONSUMER_SELECT,
    });
    if (!row) throw new NotFoundException("Collaboration not found");
    return this.mapReadRow(row);
  }

  private mapListRow(row: CollaborationConsumerRow) {
    const pipeline = this.requirePipeline(row);
    return {
      collaborationId: row.id,
      campaign: row.campaign,
      brief: { id: row.brief.id, title: row.brief.internalTitle },
      campaignProduct: row.product
        ? { id: row.product.id, name: row.product.productName }
        : null,
      creator: this.creator(row),
      lifecycle: {
        stage: row.currentStage,
        status: pipeline.collabStatus,
        phase: pipeline.currentPhase,
        paused: row.isPaused,
        terminated: row.isTerminated,
      },
      attention: {
        health: pipeline.pipelineHealth,
        actionRequiredBy: pipeline.actionRequiredByRole,
        reasonCodes: this.attentionReasonCodes(pipeline),
        dueAt: pipeline.currentMilestoneDeadline.toISOString(),
      },
      unreadCount: row.unreadCountBrand,
      // Message bodies are free-form and can contain credentials or logistics.
      // P5-A exposes the activity timestamp/count only, never message content.
      lastMessageSnippet: null,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      stageUpdatedAt: row.stageUpdatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapReadRow(row: CollaborationConsumerRow) {
    const pipeline = this.requirePipeline(row);
    return {
      collaborationId: row.id,
      campaign: row.campaign,
      brief: { id: row.brief.id, title: row.brief.internalTitle },
      campaignProduct: row.product
        ? { id: row.product.id, name: row.product.productName }
        : null,
      creator: this.creator(row),
      lifecycle: {
        stage: row.currentStage,
        status: pipeline.collabStatus,
        phase: pipeline.currentPhase,
        milestone: pipeline.currentMilestone,
        paused: row.isPaused,
        terminated: row.isTerminated,
        pipelineHealth: pipeline.pipelineHealth,
        actionRequiredBy: pipeline.actionRequiredByRole,
      },
      attention: {
        reasonCodes: this.attentionReasonCodes(pipeline),
        currentMilestoneDueAt: pipeline.currentMilestoneDeadline.toISOString(),
        autoApprovalDueAt:
          pipeline.autoApprovalDeadline72h?.toISOString() ?? null,
        productionDueAt: pipeline.productionDeadlineAt?.toISOString() ?? null,
      },
      activity: {
        negotiationRounds: row.negotiationRound,
        fulfillmentIssues: row.fulfillmentIssueCount,
        revisionRounds: row.revisionCount,
        unreadCount: row.unreadCountBrand,
        lastMessageSnippet: null,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        stageUpdatedAt: row.stageUpdatedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  private creator(row: CollaborationConsumerRow) {
    const profile = row.creatorUser.creatorProfile;
    const instagramHandle = this.nonEmpty(profile?.instagramHandle);
    return {
      displayName:
        this.nonEmpty(profile?.displayName) ??
        this.nonEmpty(row.creatorUser.name) ??
        instagramHandle ??
        "Creator",
      instagramHandle,
    };
  }

  private requirePipeline(row: CollaborationConsumerRow) {
    if (!row.ucePipelineCollaboration) {
      throw new ServiceUnavailableException(
        "Canonical Collaboration pipeline state is unavailable",
      );
    }
    return row.ucePipelineCollaboration;
  }

  private attentionReasonCodes(
    pipeline: NonNullable<CollaborationConsumerRow["ucePipelineCollaboration"]>,
  ): string[] {
    const reasons: string[] = [];
    if (pipeline.pipelineHealth !== "ON_TRACK") {
      reasons.push(pipeline.pipelineHealth);
    }
    if (pipeline.actionRequiredByRole === "BRAND") {
      reasons.push("BRAND_ACTION_REQUIRED");
    }
    return reasons;
  }

  private nonEmpty(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
