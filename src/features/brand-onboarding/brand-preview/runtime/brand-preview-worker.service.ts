import { randomUUID } from "node:crypto";

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { BrandPreviewRuntimeState } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import { BrandPreviewRuntimeService } from "./brand-preview-runtime.service";

const POLL_MS = 2_000;
const LEASE_MS = 300_000;

@Injectable()
export class BrandPreviewWorkerService implements OnModuleInit {
  private readonly logger = new Logger(BrandPreviewWorkerService.name);
  private polling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: BrandPreviewRuntimeService,
  ) {}

  onModuleInit(): void {
    this.logger.log(`brand-preview.worker.started intervalMs=${POLL_MS}`);
  }

  @Interval(POLL_MS)
  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const candidates = await this.prisma.brandPreviewRun.findMany({
        where: {
          state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { lt: new Date() } },
          ],
        },
        orderBy: { startedAt: "asc" },
        take: 3,
        select: { id: true },
      });
      for (const candidate of candidates) {
        const leaseToken = randomUUID();
        const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
        const claimed = await this.prisma.brandPreviewRun.updateMany({
          where: {
            id: candidate.id,
            state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
            OR: [
              { leaseExpiresAt: null },
              { leaseExpiresAt: { lt: new Date() } },
            ],
          },
          data: { leaseToken, leaseExpiresAt },
        });
        if (claimed.count === 1) {
          await this.runtime.execute(candidate.id, leaseToken);
        }
      }
    } finally {
      this.polling = false;
    }
  }
}
