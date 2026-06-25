import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  UceCollabStatus,
  UcePipelineHealthStatus,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { normalizeInstagramHandle } from "../../brand-uce/utils/instagram-handle.util";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import {
  mapActiveMilestone,
  mapContentFormat,
  mapHistoryClosedLabel,
  mapPendingStatus,
} from "../utils/collaboration-row.mapper";

type AuthUser = { id: string; email: string; role: UserRole };

const PENDING_STATUSES: UceCollabStatus[] = [
  UceCollabStatus.PROSPECT_CURATED,
  UceCollabStatus.PROSPECT_INVITED,
  UceCollabStatus.APPLICANT_PENDING,
  UceCollabStatus.APPLICANT_SHORTLISTED,
];

const HISTORY_STATUSES: UceCollabStatus[] = [
  UceCollabStatus.ARCHIVED_COMPLETE,
  UceCollabStatus.APPLICANT_REJECTED,
  UceCollabStatus.TERMINATED_CANCELED,
];

@Injectable()
export class CreatorCampaignsWorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(user: AuthUser) {
    this.assertCreator(user);
    const handle = await this.resolveHandle(user.id);
    if (!handle) {
      return {
        active_count: 0,
        pending_count: 0,
        completed_count: 0,
        velocity_alerts: [],
        active_rows: [],
        pending_rows: [],
      };
    }

    const collabs = await this.prisma.uceCampaignCollaboration.findMany({
      where: { instagramHandle: handle },
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: {
          include: {
            brandProfile: { select: { name: true, logoUrl: true } },
            strategy: { select: { platformDeliverables: true } },
          },
        },
        brief: {
          select: { internalTitle: true, deliverableFormatTags: true },
        },
        product: { select: { productName: true } },
        workflowCollaboration: { select: { id: true } },
      },
    });

    const activeCollabs = collabs.filter(
      (c) => c.collabStatus === UceCollabStatus.ACTIVE_WORKFLOW,
    );
    const pendingCollabs = collabs.filter((c) =>
      PENDING_STATUSES.includes(c.collabStatus),
    );
    const historyCollabs = collabs.filter((c) =>
      HISTORY_STATUSES.includes(c.collabStatus),
    );

    const velocityAlerts = activeCollabs
      .filter(
        (c) =>
          c.pipelineHealth === UcePipelineHealthStatus.ACTION_OVERDUE ||
          c.pipelineHealth === UcePipelineHealthStatus.APPROACHING_DEADLINE,
      )
      .slice(0, 5)
      .map((c) => ({
        collaboration_id: c.id,
        tone:
          c.pipelineHealth === UcePipelineHealthStatus.ACTION_OVERDUE
            ? ("critical" as const)
            : ("amber" as const),
        headline:
          c.pipelineHealth === UcePipelineHealthStatus.ACTION_OVERDUE
            ? "Critical Action Required: Overdue Deliverable"
            : "Approaching Deadline",
        body: `[${c.campaign.brandProfile.name}] ${c.campaign.name} milestone deadline requires attention.`,
        cta_label: "Open Collaboration",
        campaign_id: c.campaignId,
      }));

    const active_rows = activeCollabs.map((c) => {
      const milestone = mapActiveMilestone(c);
      return {
        collaboration_id: c.id,
        campaign_id: c.campaignId,
        brand_name: c.campaign.brandProfile.name,
        brand_avatar_url: c.campaign.brandProfile.logoUrl,
        campaign_name: c.campaign.name,
        content_format: mapContentFormat(c),
        milestone_label: milestone.milestone_label,
        milestone_subtext: milestone.milestone_subtext,
        cta_label: milestone.cta_label,
        cta_variant: milestone.cta_variant,
        workflow_collaboration_id: c.workflowCollaboration?.id ?? null,
      };
    });

    const pending_rows = pendingCollabs.map((c) => {
      const pending = mapPendingStatus(c);
      return {
        collaboration_id: c.id,
        campaign_id: c.campaignId,
        brand_name: c.campaign.brandProfile.name,
        brand_avatar_url: c.campaign.brandProfile.logoUrl,
        campaign_name: c.campaign.name,
        status_label: pending.status_label,
        context_copy: pending.context_copy,
        cta_label: pending.cta_label,
        kind: pending.kind,
        invitation_token:
          pending.kind === "invitation" ? c.invitationToken ?? null : null,
      };
    });

    return {
      active_count: active_rows.length,
      pending_count: pending_rows.length,
      completed_count: historyCollabs.length,
      velocity_alerts: velocityAlerts,
      active_rows,
      pending_rows,
    };
  }

  async getHistory(user: AuthUser) {
    this.assertCreator(user);
    const handle = await this.resolveHandle(user.id);
    if (!handle) {
      return {
        stats: {
          total_escrow_extracted: null,
          deliverables_dispatched: null,
          avg_match_retention: null,
        },
        rows: [],
      };
    }

    const collabs = await this.prisma.uceCampaignCollaboration.findMany({
      where: {
        instagramHandle: handle,
        collabStatus: { in: HISTORY_STATUSES },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: {
          include: { brandProfile: { select: { name: true } } },
        },
      },
    });

    let totalEscrow = 0;
    let completedCount = 0;
    let matchTotal = 0;

    const rows = collabs.map((c) => {
      const quote = decimalToNumber(c.totalQuote);
      if (c.collabStatus === UceCollabStatus.ARCHIVED_COMPLETE) {
        totalEscrow += quote;
        completedCount += 1;
      }
      matchTotal += decimalToNumber(c.matchScore);
      return {
        collaboration_id: c.id,
        brand_name: c.campaign.brandProfile.name,
        campaign_name: c.campaign.name,
        closed_label: mapHistoryClosedLabel(c.collabStatus),
        payout_amount:
          c.collabStatus === UceCollabStatus.ARCHIVED_COMPLETE && quote > 0
            ? quote
            : null,
        closed_at: c.updatedAt.toISOString(),
      };
    });

    return {
      stats: {
        total_escrow_extracted:
          completedCount > 0 ? totalEscrow : null,
        deliverables_dispatched:
          completedCount > 0 ? completedCount : null,
        avg_match_retention:
          rows.length > 0 ? Math.round(matchTotal / rows.length) : null,
      },
      rows,
    };
  }

  private async resolveHandle(userId: string): Promise<string | null> {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!profile?.instagramHandle) return null;
    return normalizeInstagramHandle(profile.instagramHandle);
  }

  private assertCreator(user: AuthUser): void {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }
}
