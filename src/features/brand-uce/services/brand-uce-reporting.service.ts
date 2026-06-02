import { Injectable } from "@nestjs/common";
import { UceCampaignObjective } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import { decimalToNumber } from "../utils/uce-decimal.util";
import { BrandUceAccessService } from "./brand-uce-access.service";

@Injectable()
export class BrandUceReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BrandUceAccessService,
  ) {}

  async getDashboard(brandProfileId: string, campaignId: string) {
    const campaign = await this.access.assertCampaignOwned(
      brandProfileId,
      campaignId,
    );

    const [strategy, snapshot, timeseries, assets, collabs] = await Promise.all([
      this.prisma.uceCampaignStrategy.findUnique({ where: { campaignId } }),
      this.prisma.uceCampaignReportingSnapshot.findFirst({
        where: { campaignId },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.uceCampaignReportingTimeseriesHourly.findMany({
        where: { campaignId },
        orderBy: { recordedHour: "asc" },
        take: 168,
      }),
      this.prisma.uceCampaignReportingAssetGallery.findMany({
        where: { campaignId },
        orderBy: { engagementRatePercentage: "desc" },
        take: 50,
      }),
      this.prisma.uceCampaignCollaboration.findMany({
        where: { campaignId, collabStatus: "ACTIVE_WORKFLOW" },
        orderBy: { matchScore: "desc" },
        take: 20,
      }),
    ]);

    const primaryObjective =
      strategy?.coreObjective ?? UceCampaignObjective.BRAND_AWARENESS;

    const lastSync = snapshot?.lastApiSyncTimestamp ?? new Date();
    const roiSummary = this.buildRoiSummary(primaryObjective, snapshot);

    const leaderboard = collabs.map((c, index) => ({
      rank_position: index + 1,
      collaboration_id: c.id,
      instagram_handle: c.instagramHandle,
      assigned_fee_investment: decimalToNumber(c.totalQuote),
      delivered_impressions_count: 0,
      cost_per_engagement_value: 0,
      roi_performance_index_score: Math.round(decimalToNumber(c.matchScore)),
    }));

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      primary_objective: primaryObjective,
      last_api_sync_timestamp: lastSync.toISOString(),
      elapsed_time_string: `Last updated ${formatDistanceToNow(lastSync, { addSuffix: true })}`,
      roi_summary_strip_payload: roiSummary,
      timeseries_hourly_feed: timeseries.map((t) => ({
        recorded_hour: t.recordedHour.toISOString(),
        hourly_likes_count: t.hourlyLikesCount,
        hourly_comments_count: t.hourlyCommentsCount,
        hourly_saves_count: t.hourlySavesCount,
        hourly_shares_count: t.hourlySharesCount,
        hourly_impressions_delta: t.hourlyImpressionsDelta,
      })),
      leaderboard_rankings: leaderboard,
      creative_gallery_grid: assets.map((a) => ({
        asset_id: a.id,
        collaboration_id: a.collaborationId,
        instagram_handle: a.instagramHandle,
        platform: a.platform,
        media_thumbnail_url: a.mediaThumbnailUrl,
        high_res_source_download_url: a.highResSourceDownloadUrl,
        engagement_rate_percentage: decimalToNumber(a.engagementRatePercentage),
        saves_count: a.savesCount,
        shares_count: a.sharesCount,
        story_sticker_clicks_count: a.storyStickerClicksCount,
        spark_ad_authorization_code: a.sparkAdAuthorizationCode,
        is_whitelisting_active: a.isWhitelistingActive,
      })),
    };
  }

  async forceRefreshSync(brandProfileId: string, campaignId: string) {
    await this.access.assertCampaignOwned(brandProfileId, campaignId);

    const strategy = await this.prisma.uceCampaignStrategy.findUnique({
      where: { campaignId },
    });
    const primaryObjective =
      strategy?.coreObjective ?? UceCampaignObjective.BRAND_AWARENESS;

    const snapshot = await this.prisma.uceCampaignReportingSnapshot.create({
      data: {
        campaignId,
        primaryObjective,
        lastApiSyncTimestamp: new Date(),
      },
    });

    return {
      ok: true,
      snapshot_id: snapshot.id,
      last_api_sync_timestamp: snapshot.lastApiSyncTimestamp.toISOString(),
    };
  }

  private buildRoiSummary(
    objective: UceCampaignObjective,
    snapshot: {
      totalSpendAllocated: { toString(): string };
      totalEarnedMediaValue: { toString(): string };
      totalVerifiedImpressions: bigint;
      totalVerifiedReach: bigint;
      calculatedCpmRate: { toString(): string };
      calculatedCpeRate: { toString(): string };
      totalTrackedLinkClicks: bigint;
      aggregatedCtrPercentage: { toString(): string };
      calculatedCpcRate: { toString(): string };
      attributedSalesRevenue: { toString(): string };
      attributedConversionCount: number;
      aggregatedConversionRate: { toString(): string };
      calculatedCacRate: { toString(): string };
    } | null,
  ) {
    const base = {
      total_spend_allocated: snapshot
        ? decimalToNumber(snapshot.totalSpendAllocated as never)
        : 0,
      total_earned_media_value: snapshot
        ? decimalToNumber(snapshot.totalEarnedMediaValue as never)
        : 0,
    };

    if (objective === UceCampaignObjective.TRAFFIC_CLICKS) {
      return {
        ...base,
        total_tracked_link_clicks: snapshot
          ? Number(snapshot.totalTrackedLinkClicks)
          : 0,
        aggregated_ctr_percentage: snapshot
          ? decimalToNumber(snapshot.aggregatedCtrPercentage as never)
          : 0,
        calculated_cpc_rate: snapshot
          ? decimalToNumber(snapshot.calculatedCpcRate as never)
          : 0,
      };
    }

    if (objective === UceCampaignObjective.SALES_CONVERSIONS) {
      return {
        ...base,
        attributed_sales_revenue: snapshot
          ? decimalToNumber(snapshot.attributedSalesRevenue as never)
          : 0,
        attributed_conversion_count: snapshot?.attributedConversionCount ?? 0,
        aggregated_conversion_rate: snapshot
          ? decimalToNumber(snapshot.aggregatedConversionRate as never)
          : 0,
        calculated_cac_rate: snapshot
          ? decimalToNumber(snapshot.calculatedCacRate as never)
          : 0,
      };
    }

    return {
      ...base,
      total_verified_impressions: snapshot
        ? Number(snapshot.totalVerifiedImpressions)
        : 0,
      total_verified_reach: snapshot
        ? Number(snapshot.totalVerifiedReach)
        : 0,
      calculated_cpm_rate: snapshot
        ? decimalToNumber(snapshot.calculatedCpmRate as never)
        : 0,
      calculated_cpe_rate: snapshot
        ? decimalToNumber(snapshot.calculatedCpeRate as never)
        : 0,
    };
  }
}
