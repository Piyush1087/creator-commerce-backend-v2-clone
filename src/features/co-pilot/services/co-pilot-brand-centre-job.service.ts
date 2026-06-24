import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BrandCentreJobStatus } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type BrandCentreJobPollEvent =
  | { type: "QUEUED" | "RUNNING"; message: string }
  | { type: "COMPLETED"; message: string; resultPayload: unknown }
  | { type: "FAILED"; message: string };

@Injectable()
export class CoPilotBrandCentreJobService {
  constructor(private readonly prisma: PrismaService) {}

  async *pollJobEvents(
    jobId: string,
    options?: { timeoutMs?: number; intervalMs?: number },
  ): AsyncGenerator<BrandCentreJobPollEvent> {
    const timeoutMs = options?.timeoutMs ?? 120_000;
    const intervalMs = options?.intervalMs ?? 2_000;
    const started = Date.now();
    let lastStatus: BrandCentreJobStatus | null = null;

    while (Date.now() - started < timeoutMs) {
      const job = await this.prisma.brandCentreJob.findUnique({
        where: { id: jobId },
      });
      if (!job) {
        throw new NotFoundException("Background job not found.");
      }

      if (job.status !== lastStatus) {
        lastStatus = job.status;
        if (
          job.status === BrandCentreJobStatus.QUEUED ||
          job.status === BrandCentreJobStatus.RUNNING
        ) {
          yield {
            type: job.status,
            message:
              job.status === BrandCentreJobStatus.QUEUED
                ? "Queued — building your Campaign Planner card…"
                : "Running — Gemini is assembling the planner blueprint…",
          };
        }
      }

      if (job.status === BrandCentreJobStatus.COMPLETED) {
        yield {
          type: "COMPLETED",
          message: "Campaign Planner card is ready.",
          resultPayload: null,
        };
        return;
      }

      if (job.status === BrandCentreJobStatus.FAILED) {
        yield {
          type: "FAILED",
          message: job.errorMessage ?? "Background job failed.",
        };
        throw new BadRequestException(job.errorMessage ?? "Background job failed.");
      }

      await sleep(intervalMs);
    }

    throw new BadRequestException(
      "Timed out waiting for Campaign Planner to finish. Check Tab 3 in Brand Centre.",
    );
  }
}
