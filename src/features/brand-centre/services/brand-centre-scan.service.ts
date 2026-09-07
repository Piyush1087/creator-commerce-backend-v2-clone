import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BrandCentreJobStatus,
  BrandCentreJobType,
  ScanStatus,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { SubscriptionCapabilityService } from "../../pricing/services/subscription-capability.service";
import { BrandCentreJobDispatcherService } from "./brand-centre-job-dispatcher.service";

export type ScanStatusResponse = {
  scanStatus: ScanStatus;
  deepIntelStatus: string;
  deepScanCompletedAt: string | null;
  job: {
    id: string;
    type: BrandCentreJobType;
    status: BrandCentreJobStatus;
    attempt: number;
    errorMessage: string | null;
    queuedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
  } | null;
};

@Injectable()
export class BrandCentreScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: BrandCentreJobDispatcherService,
    private readonly subscriptionCapabilities: SubscriptionCapabilityService,
  ) {}

  async getScanStatus(brandProfileId: string): Promise<ScanStatusResponse> {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        scanStatus: true,
        deepIntelStatus: true,
        deepScanCompletedAt: true,
      },
    });

    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const job = await this.prisma.brandCentreJob.findFirst({
      where: {
        brandProfileId,
        type: BrandCentreJobType.DEEP_SCAN,
      },
      orderBy: { queuedAt: "desc" },
    });

    return {
      scanStatus: profile.scanStatus,
      deepIntelStatus: profile.deepIntelStatus,
      deepScanCompletedAt: profile.deepScanCompletedAt?.toISOString() ?? null,
      job: job
        ? {
            id: job.id,
            type: job.type,
            status: job.status,
            attempt: job.attempt,
            errorMessage: job.errorMessage,
            queuedAt: job.queuedAt.toISOString(),
            startedAt: job.startedAt?.toISOString() ?? null,
            finishedAt: job.finishedAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  /**
   * Enqueue deep scan after email verify (Event 2 worker — Slice 4).
   * Creates job row only; worker implementation follows in next slice.
   */
  async enqueueDeepScan(brandProfileId: string): Promise<{ jobId: string }> {
    return this.enqueueDeepScanInternal(brandProfileId, true);
  }

  async enqueueOnboardingDeepScan(
    brandProfileId: string,
  ): Promise<{ jobId: string }> {
    return this.enqueueDeepScanInternal(brandProfileId, false);
  }

  private async enqueueDeepScanInternal(
    brandProfileId: string,
    enforceCapability: boolean,
  ): Promise<{ jobId: string }> {
    const active = await this.prisma.brandCentreJob.findFirst({
      where: {
        brandProfileId,
        type: BrandCentreJobType.DEEP_SCAN,
        status: {
          in: [BrandCentreJobStatus.QUEUED, BrandCentreJobStatus.RUNNING],
        },
      },
    });

    if (active) {
      return { jobId: active.id };
    }

    if (enforceCapability) {
      await this.subscriptionCapabilities.assertCapability(
        brandProfileId,
        "AI_SCAN_START",
      );
    }

    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.brandCentreJob.create({
        data: {
          brandProfileId,
          type: BrandCentreJobType.DEEP_SCAN,
          status: BrandCentreJobStatus.QUEUED,
        },
      });

      await tx.brandProfile.update({
        where: { id: brandProfileId },
        data: { scanStatus: ScanStatus.DEEP_SCAN_IN_PROGRESS },
      });

      return created;
    });

    this.dispatcher.dispatchInBackground(job.id, BrandCentreJobType.DEEP_SCAN);
    return { jobId: job.id };
  }

  async retryDeepScan(brandProfileId: string): Promise<{ jobId: string }> {
    const failed = await this.prisma.brandCentreJob.findFirst({
      where: {
        brandProfileId,
        type: BrandCentreJobType.DEEP_SCAN,
        status: BrandCentreJobStatus.FAILED,
      },
      orderBy: { queuedAt: "desc" },
    });

    if (!failed) {
      throw new BadRequestException(
        "No failed deep scan job to retry for this brand",
      );
    }

    return this.enqueueDeepScan(brandProfileId);
  }
}
