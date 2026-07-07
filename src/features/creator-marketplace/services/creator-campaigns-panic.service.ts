import { Injectable } from "@nestjs/common";
import {
  UceProductionPhase,
  UceWorkflowActionRole,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

const CACHE_TTL_MS = 5 * 60 * 1000;
const ACTIVE_PHASES: UceProductionPhase[] = [
  UceProductionPhase.LOGISTICS_TRANSIT,
  UceProductionPhase.CONTENT_DRAFTING,
  UceProductionPhase.SAFETY_REVIEW,
  UceProductionPhase.LIVE_SCRAPING,
];

type PanicPayload = {
  hasUrgentAlerts: boolean;
  alertCount: number;
  alerts: Array<{
    id: string;
    campaign_id: string;
    campaign_name: string;
    current_phase: UceProductionPhase;
    production_deadline_at: string | null;
  }>;
};

type CacheEntry = { expiresAt: number; payload: PanicPayload };

@Injectable()
export class CreatorCampaignsPanicService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async evaluatePanicPanelTelemetry(
    creatorProfileId: string,
  ): Promise<PanicPayload> {
    const cacheKey = `creator:campaigns:panic:${creatorProfileId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const breaches = await this.prisma.uceCampaignCollaboration.findMany({
      where: {
        creatorProfileId,
        actionRequiredByRole: UceWorkflowActionRole.CREATOR,
        currentPhase: { in: ACTIVE_PHASES },
        OR: [
          { productionDeadlineAt: { lt: now } },
          {
            currentPhase: UceProductionPhase.CONTENT_DRAFTING,
            productionDeadlineAt: { lte: twoDaysFromNow },
          },
        ],
      },
      select: {
        id: true,
        campaignId: true,
        currentPhase: true,
        productionDeadlineAt: true,
        campaign: { select: { name: true } },
      },
      orderBy: { productionDeadlineAt: "asc" },
      take: 5,
    });

    const payload: PanicPayload = {
      hasUrgentAlerts: breaches.length > 0,
      alertCount: breaches.length,
      alerts: breaches.map((row) => ({
        id: row.id,
        campaign_id: row.campaignId,
        campaign_name: row.campaign.name,
        current_phase: row.currentPhase,
        production_deadline_at: row.productionDeadlineAt?.toISOString() ?? null,
      })),
    };

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return payload;
  }

  invalidateCreatorCache(creatorProfileId: string): void {
    this.cache.delete(`creator:campaigns:panic:${creatorProfileId}`);
  }
}
