import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandCentreJobStatus,
  BrandCentreJobType,
  LeakPlannerStatus,
  Prisma,
  ScanStatus,
} from "@prisma/client";
import { subDays, subHours } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandCentreJobDispatcherService } from "./brand-centre-job-dispatcher.service";

const STALE_HOURS = 24;
const ARCHIVE_RETENTION_DAYS = 30;
/** QUEUED jobs older than this are re-dispatched (survives process restarts). */
const ORPHAN_QUEUED_MS = 2 * 60 * 1000;

@Injectable()
export class BrandCentreIntelligenceService {
  private readonly logger = new Logger(BrandCentreIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: BrandCentreJobDispatcherService,
  ) {}

  async getIntelligence(brandProfileId: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { scanStatus: true, deepIntelStatus: true },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    if (profile.scanStatus !== ScanStatus.READY) {
      throw new BadRequestException(
        "Intelligence is available after deep scan completes",
      );
    }

    const baseline = await this.prisma.brandIntelligenceBaseline.findUnique({
      where: { brandProfileId },
    });

    const leaks = await this.prisma.brandPerformanceLeak.findMany({
      where: { brandProfileId, isArchived: false },
      orderBy: [{ priorityRank: "asc" }, { createdAt: "desc" }],
    });

    await this.reconcileOrphanedIntelligenceJobs(brandProfileId);

    if (this.shouldRefresh(baseline?.refreshedAt, leaks.length)) {
      const reason = this.refreshReason(baseline?.refreshedAt, leaks.length);
      this.logger.log(
        `intelligence-refresh.trigger brandProfileId=${brandProfileId} reason=${reason} activeLeaks=${leaks.length}`,
      );
      await this.enqueueRefresh(brandProfileId);
    }

    const activeJob = await this.prisma.brandCentreJob.findFirst({
      where: {
        brandProfileId,
        type: BrandCentreJobType.INTELLIGENCE_REFRESH,
        status: {
          in: [BrandCentreJobStatus.QUEUED, BrandCentreJobStatus.RUNNING],
        },
      },
      orderBy: { queuedAt: "desc" },
    });

    return {
      systemStatus: "ACTIVE",
      dateRangeLabel: "Last 30 Days",
      dataRefreshedAt: baseline?.refreshedAt?.toISOString() ?? null,
      deepIntelStatus: profile.deepIntelStatus,
      refreshJob: activeJob
        ? {
            id: activeJob.id,
            status: activeJob.status,
            queuedAt: activeJob.queuedAt.toISOString(),
          }
        : null,
      baseline: baseline
        ? {
            growthImpactMatrix: baseline.growthImpactMatrix,
            baselineHealth: baseline.baselineHealth,
            shareOfVoice: baseline.shareOfVoice,
            source: baseline.source,
          }
        : null,
      leaks: leaks.map((l) => this.mapLeakSummary(l)),
    };
  }

  private shouldRefresh(
    refreshedAt: Date | null | undefined,
    leakCount: number,
  ): boolean {
    if (!refreshedAt || leakCount === 0) {
      return true;
    }
    return refreshedAt < subHours(new Date(), STALE_HOURS);
  }

  private refreshReason(
    refreshedAt: Date | null | undefined,
    leakCount: number,
  ): string {
    if (!refreshedAt) {
      return "never_refreshed";
    }
    if (leakCount === 0) {
      return "zero_active_leaks";
    }
    return "stale_over_24h";
  }

  async enqueueRefresh(brandProfileId: string): Promise<{ jobId: string }> {
    await this.reconcileOrphanedIntelligenceJobs(brandProfileId);

    const active = await this.prisma.brandCentreJob.findFirst({
      where: {
        brandProfileId,
        type: BrandCentreJobType.INTELLIGENCE_REFRESH,
        status: {
          in: [BrandCentreJobStatus.QUEUED, BrandCentreJobStatus.RUNNING],
        },
      },
    });
    if (active) {
      this.logger.log(
        `intelligence-refresh.already-active brandProfileId=${brandProfileId} jobId=${active.id} status=${active.status}`,
      );
      return { jobId: active.id };
    }

    const job = await this.prisma.brandCentreJob.create({
      data: {
        brandProfileId,
        type: BrandCentreJobType.INTELLIGENCE_REFRESH,
        status: BrandCentreJobStatus.QUEUED,
      },
    });

    this.dispatcher.dispatchInBackground(
      job.id,
      BrandCentreJobType.INTELLIGENCE_REFRESH,
    );
    this.logger.log(
      `intelligence-refresh.queued brandProfileId=${brandProfileId} jobId=${job.id}`,
    );
    return { jobId: job.id };
  }

  async listLeaks(
    brandProfileId: string,
    filter: "active" | "archived" = "active",
  ) {
    const isArchived = filter === "archived";
    const archivedSince = subDays(new Date(), ARCHIVE_RETENTION_DAYS);
    const rows = await this.prisma.brandPerformanceLeak.findMany({
      where: {
        brandProfileId,
        isArchived,
        ...(isArchived
          ? { archivedAt: { gte: archivedSince } }
          : {}),
      },
      orderBy: [{ priorityRank: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((l) => this.mapLeakSummary(l));
  }

  async getLeak(brandProfileId: string, leakId: string) {
    const leak = await this.prisma.brandPerformanceLeak.findFirst({
      where: { id: leakId, brandProfileId },
    });
    if (!leak) {
      throw new NotFoundException("Leak not found");
    }
    return this.mapLeakDetail(leak);
  }

  async patchLeak(
    brandProfileId: string,
    leakId: string,
    data: {
      actionableStepsChecklist?: Array<{
        stepId: string;
        stepLabel: string;
        isCompleted: boolean;
      }>;
      isArchived?: boolean;
    },
  ) {
    const leak = await this.prisma.brandPerformanceLeak.findFirst({
      where: { id: leakId, brandProfileId },
    });
    if (!leak) {
      throw new NotFoundException("Leak not found");
    }

    const drawer = (leak.drawerDeepDive ?? {}) as Record<string, unknown>;
    if (data.actionableStepsChecklist) {
      drawer.actionableStepsChecklist = data.actionableStepsChecklist;
    }

    return this.prisma.brandPerformanceLeak.update({
      where: { id: leakId },
      data: {
        drawerDeepDive: drawer as unknown as Prisma.InputJsonValue,
        isArchived: data.isArchived ?? leak.isArchived,
        archivedAt: data.isArchived ? new Date() : leak.archivedAt,
      },
    });
  }

  async discardLeak(brandProfileId: string, leakId: string) {
    const leak = await this.prisma.brandPerformanceLeak.findFirst({
      where: { id: leakId, brandProfileId },
    });
    if (!leak) {
      throw new NotFoundException("Leak not found");
    }
    await this.prisma.brandPerformanceLeak.update({
      where: { id: leakId },
      data: {
        plannerStatus: LeakPlannerStatus.DISCARDED,
        isArchived: true,
        archivedAt: new Date(),
      },
    });
  }

  async moveToPlanner(
    brandProfileId: string,
    leakId: string,
    userId: string,
  ): Promise<{ jobId: string }> {
    const leak = await this.prisma.brandPerformanceLeak.findFirst({
      where: { id: leakId, brandProfileId, isArchived: false },
    });
    if (!leak) {
      throw new NotFoundException("Leak not found");
    }
    if (leak.plannerStatus === LeakPlannerStatus.PUSHED_TO_PLANNER) {
      throw new BadRequestException("Leak already moved to planner");
    }

    await this.prisma.brandPerformanceLeak.update({
      where: { id: leakId },
      data: {
        plannerStatus: LeakPlannerStatus.PUSHED_TO_PLANNER,
        movedByUserId: userId,
      },
    });

    const job = await this.prisma.brandCentreJob.create({
      data: {
        brandProfileId,
        type: BrandCentreJobType.PLANNER_AGGREGATE,
        status: BrandCentreJobStatus.QUEUED,
        payload: { leakId } as unknown as Prisma.InputJsonValue,
      },
    });

    this.dispatcher.dispatchInBackground(
      job.id,
      BrandCentreJobType.PLANNER_AGGREGATE,
    );
    return { jobId: job.id };
  }

  private async reconcileOrphanedIntelligenceJobs(
    brandProfileId: string,
  ): Promise<void> {
    const cutoff = new Date(Date.now() - ORPHAN_QUEUED_MS);
    const staleQueued = await this.prisma.brandCentreJob.findMany({
      where: {
        brandProfileId,
        type: BrandCentreJobType.INTELLIGENCE_REFRESH,
        status: BrandCentreJobStatus.QUEUED,
        queuedAt: { lt: cutoff },
      },
    });
    for (const job of staleQueued) {
      this.logger.warn(
        `intelligence-refresh.re-dispatch-orphan brandProfileId=${brandProfileId} jobId=${job.id}`,
      );
      this.dispatcher.dispatchInBackground(
        job.id,
        BrandCentreJobType.INTELLIGENCE_REFRESH,
      );
    }
  }

  private mapLeakSummary(leak: {
    id: string;
    insightTitle: string;
    shortDescription: string;
    priorityRank: string;
    leakBucket: string;
    performanceStatus: string;
    projectedLiftPercentage: Prisma.Decimal;
    plannerStatus: string;
    plannerCardId: string | null;
    isArchived: boolean;
  }) {
    return {
      id: leak.id,
      insightTitle: leak.insightTitle,
      shortDescription: leak.shortDescription,
      priorityRank: leak.priorityRank,
      leakBucket: leak.leakBucket,
      performanceStatus: leak.performanceStatus,
      projectedLiftPercentage: Number(leak.projectedLiftPercentage),
      plannerStatus: leak.plannerStatus,
      plannerCardId: leak.plannerCardId,
      isArchived: leak.isArchived,
    };
  }

  private mapLeakDetail(leak: {
    id: string;
    insightTitle: string;
    shortDescription: string;
    priorityRank: string;
    leakBucket: string;
    performanceStatus: string;
    projectedLiftPercentage: Prisma.Decimal;
    drawerDeepDive: Prisma.JsonValue;
    plannerStatus: string;
    plannerCardId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...this.mapLeakSummary(leak),
      drawerDeepDive: leak.drawerDeepDive,
      createdAt: leak.createdAt.toISOString(),
      updatedAt: leak.updatedAt.toISOString(),
    };
  }
}
