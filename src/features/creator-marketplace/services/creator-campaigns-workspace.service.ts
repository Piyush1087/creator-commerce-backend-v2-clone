import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import {
  UceCollabStatus,
  UceProductionPhase,
  UceWorkflowActionRole,
  UserRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  ACTIVE_PRODUCTION_PHASES,
  ARCHIVED_PRODUCTION_PHASES,
  PENDING_PRODUCTION_PHASES,
} from "../../../shared/uce/uce-production-phase.util";
import { decimalToNumber } from "../../brand-uce/utils/uce-decimal.util";
import type {
  CommandCenterQueryInput,
  HistoryArchiveQueryInput,
} from "../schemas/command-center.schema";
import {
  mapActiveMilestone,
  mapContentFormat,
  mapHistoryClosedLabel,
  mapPendingStatus,
} from "../utils/collaboration-row.mapper";
import { CreatorCampaignsPanicService } from "./creator-campaigns-panic.service";

type AuthUser = { id: string; email: string; role: UserRole };

@Injectable()
export class CreatorCampaignsWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panic: CreatorCampaignsPanicService,
  ) {}

  async getWorkspace(user: AuthUser, query: CommandCenterQueryInput) {
    this.assertCreator(user);
    const profile = await this.resolveProfile(user.id);
    if (!profile) {
      return this.emptyWorkspace();
    }

    const phaseFilter =
      query.currentView === "PENDING_APPLICATIONS"
        ? PENDING_PRODUCTION_PHASES
        : ACTIVE_PRODUCTION_PHASES;

    const dependencyRole =
      query.dependencyFilter === "AWAITING_CREATOR"
        ? UceWorkflowActionRole.CREATOR
        : query.dependencyFilter === "AWAITING_BRAND"
          ? UceWorkflowActionRole.BRAND
          : undefined;

    const collabs = await this.prisma.uceCampaignCollaboration.findMany({
      where: {
        creatorProfileId: profile.id,
        currentPhase: { in: phaseFilter },
        ...(dependencyRole ? { actionRequiredByRole: dependencyRole } : {}),
        ...(query.platformFilter
          ? { contentFormatType: query.platformFilter }
          : {}),
        ...(query.searchQuery
          ? {
              OR: [
                {
                  campaign: {
                    name: {
                      contains: query.searchQuery,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  campaign: {
                    brandProfile: {
                      name: {
                        contains: query.searchQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
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

    const [pendingCount, activeCount, historyCount, panicPanel] =
      await Promise.all([
        this.prisma.uceCampaignCollaboration.count({
          where: {
            creatorProfileId: profile.id,
            currentPhase: { in: PENDING_PRODUCTION_PHASES },
          },
        }),
        this.prisma.uceCampaignCollaboration.count({
          where: {
            creatorProfileId: profile.id,
            currentPhase: { in: ACTIVE_PRODUCTION_PHASES },
          },
        }),
        this.prisma.uceCampaignCollaboration.count({
          where: {
            creatorProfileId: profile.id,
            currentPhase: { in: ARCHIVED_PRODUCTION_PHASES },
          },
        }),
        this.panic.evaluatePanicPanelTelemetry(profile.id),
      ]);

    const activeCollabs = collabs.filter((c) =>
      ACTIVE_PRODUCTION_PHASES.includes(c.currentPhase),
    );
    const pendingCollabs = collabs.filter((c) =>
      PENDING_PRODUCTION_PHASES.includes(c.currentPhase),
    );

    const velocityAlerts = panicPanel.alerts.map((alert) => ({
      collaboration_id: alert.id,
      tone: "critical" as const,
      headline: "Critical Action Required: Overdue Deliverable",
      body: `[${alert.campaign_name}] requires your attention before the production deadline.`,
      cta_label: "Open Collaboration",
      campaign_id: alert.campaign_id,
      current_phase: alert.current_phase,
      production_deadline_at: alert.production_deadline_at,
    }));

    const active_rows = activeCollabs.map((c) => {
      const milestone = mapActiveMilestone(c);
      return {
        collaboration_id: c.id,
        campaign_id: c.campaignId,
        brand_name: c.campaign.brandProfile.name,
        brand_avatar_url: c.campaign.brandProfile.logoUrl,
        campaign_name: c.campaign.name,
        content_format: c.contentFormatType ?? mapContentFormat(c),
        current_phase: c.currentPhase,
        action_required_by_role: c.actionRequiredByRole,
        production_deadline_at: c.productionDeadlineAt?.toISOString() ?? null,
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
        current_phase: c.currentPhase,
        action_required_by_role: c.actionRequiredByRole,
        status_label: pending.status_label,
        context_copy: pending.context_copy,
        cta_label: pending.cta_label,
        kind: pending.kind,
        invitation_token:
          pending.kind === "invitation" ? c.invitationToken ?? null : null,
      };
    });

    return {
      current_view: query.currentView,
      active_count: activeCount,
      pending_count: pendingCount,
      completed_count: historyCount,
      panic_panel: panicPanel,
      velocity_alerts: velocityAlerts,
      active_rows,
      pending_rows,
    };
  }

  async getHistory(user: AuthUser, query: HistoryArchiveQueryInput) {
    this.assertCreator(user);
    const profile = await this.resolveProfile(user.id);
    if (!profile) {
      return {
        page: query.page,
        limit: query.limit,
        total: 0,
        stats: {
          total_escrow_extracted: null,
          deliverables_dispatched: null,
          avg_match_retention: null,
        },
        rows: [],
      };
    }

    const phaseFilter: UceProductionPhase[] =
      query.archiveStatus === "ARCHIVED_COMPLETED"
        ? [UceProductionPhase.ARCHIVED_COMPLETED]
        : query.archiveStatus === "ARCHIVED_CLOSED"
          ? [UceProductionPhase.ARCHIVED_CLOSED]
          : ARCHIVED_PRODUCTION_PHASES;

    const where = {
      creatorProfileId: profile.id,
      currentPhase: { in: phaseFilter },
    };

    const [total, collabs] = await Promise.all([
      this.prisma.uceCampaignCollaboration.count({ where }),
      this.prisma.uceCampaignCollaboration.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          campaign: {
            include: { brandProfile: { select: { name: true } } },
          },
        },
      }),
    ]);

    let totalEscrow = 0;
    let completedCount = 0;
    let matchTotal = 0;

    const rows = collabs.map((c) => {
      const quote = decimalToNumber(c.totalQuote);
      if (c.currentPhase === UceProductionPhase.ARCHIVED_COMPLETED) {
        totalEscrow += quote;
        completedCount += 1;
      }
      matchTotal += decimalToNumber(c.matchScore);
      return {
        collaboration_id: c.id,
        brand_name: c.campaign.brandProfile.name,
        campaign_name: c.campaign.name,
        current_phase: c.currentPhase,
        closed_label:
          c.currentPhase === UceProductionPhase.ARCHIVED_COMPLETED
            ? "Completed & Released"
            : mapHistoryClosedLabel(c.collabStatus),
        payout_amount:
          c.currentPhase === UceProductionPhase.ARCHIVED_COMPLETED && quote > 0
            ? quote
            : null,
        closed_at: c.updatedAt.toISOString(),
      };
    });

    return {
      page: query.page,
      limit: query.limit,
      total,
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

  private emptyWorkspace() {
    return {
      current_view: "ACTIVE_PRODUCTION" as const,
      active_count: 0,
      pending_count: 0,
      completed_count: 0,
      panic_panel: {
        hasUrgentAlerts: false,
        alertCount: 0,
        alerts: [],
      },
      velocity_alerts: [],
      active_rows: [],
      pending_rows: [],
    };
  }

  private async resolveProfile(userId: string) {
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { userId },
    });
    if (!profile?.instagramHandle) return null;
    return profile;
  }

  private assertCreator(user: AuthUser): void {
    if (user.role !== UserRole.CREATOR) {
      throw new ForbiddenException("Creator access required");
    }
  }
}
