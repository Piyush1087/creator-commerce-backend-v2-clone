import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  BrandIntelligenceJobStatus,
  BrandIntelligenceStage,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  BrandDnaSnapshotSchema,
  type BrandDnaSnapshot,
} from "./stage2/brand-dna.schema";

export type IntelligenceStatusResponse = {
  leadId: string;
  brandProfileId: string | null;
  currentStage: BrandIntelligenceStage | null;
  brandDna: BrandDnaSnapshot | null;
  error: string | null;
  /** Latest Stage 1B job — UI must keep waiting while QUEUED/RUNNING (retries). */
  jobStatus: BrandIntelligenceJobStatus | null;
  jobAttempt: number | null;
};

/**
 * Polling surface for the Brand DNA page (Phase 4–7 pipeline status).
 */
@Injectable()
export class IntelligenceStatusService {
  private readonly logger = new Logger(IntelligenceStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getByLeadId(leadId: string): Promise<IntelligenceStatusResponse> {
    const lead = await this.prisma.discoveryLead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) {
      throw new NotFoundException("Discovery lead not found");
    }

    const [scan, latestJob] = await Promise.all([
      this.prisma.brandIntelligenceScan.findUnique({
        where: { discoveryLeadId: leadId },
      }),
      this.prisma.brandIntelligenceJob.findFirst({
        where: { discoveryLeadId: leadId },
        orderBy: { queuedAt: "desc" },
        select: { status: true, attempt: true },
      }),
    ]);

    if (!scan) {
      return {
        leadId,
        brandProfileId: null,
        currentStage: null,
        brandDna: null,
        error: null,
        jobStatus: latestJob?.status ?? null,
        jobAttempt: latestJob?.attempt ?? null,
      };
    }

    let brandDna: BrandDnaSnapshot | null = null;
    if (scan.brandDnaVerifiedSnapshot) {
      const parsed = BrandDnaSnapshotSchema.safeParse(
        scan.brandDnaVerifiedSnapshot,
      );
      if (parsed.success) {
        brandDna = parsed.data;
      } else {
        this.logger.warn(
          `intelligence.invalid_verified_snapshot leadId=${leadId}`,
        );
      }
    }

    return {
      leadId,
      brandProfileId: scan.brandProfileId,
      currentStage: scan.currentStage,
      brandDna,
      error: scan.errorLogs,
      jobStatus: latestJob?.status ?? null,
      jobAttempt: latestJob?.attempt ?? null,
    };
  }
}
