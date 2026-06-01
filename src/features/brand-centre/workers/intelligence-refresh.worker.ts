import { Injectable, Logger } from "@nestjs/common";
import {
  BrandCentreJobStatus,
  IntelStatus,
  LeakBucket,
  PerformanceColor,
  PriorityRank,
  Prisma,
} from "@prisma/client";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { PrismaService } from "../../../prisma/prisma.service";
import { loadBrandCentreSystemPrompt } from "../prompts/prompt-loader";
import { zodArrayToGeminiResponseSchema } from "../prompts/zod-to-gemini-response-schema.util";
import {
  IntelligenceLeakCardSchema,
  IntelligencePrompt2Schema,
} from "../schemas/intelligence-prompt2.schema";
import { buildFallbackIntelligenceLeaks } from "../utils/intelligence-fallback-leaks.util";
import { normalizeIntelligencePrompt2Payload } from "../utils/normalize-intelligence-prompt2-payload.util";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class IntelligenceRefreshWorker {
  private readonly logger = new Logger(IntelligenceRefreshWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiJsonClient,
  ) {}

  async run(jobId: string): Promise<void> {
    const job = await this.prisma.brandCentreJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== BrandCentreJobStatus.QUEUED) {
      return;
    }

    await this.prisma.brandCentreJob.update({
      where: { id: jobId },
      data: {
        status: BrandCentreJobStatus.RUNNING,
        startedAt: new Date(),
        attempt: { increment: 1 },
      },
    });

    this.logger.log(
      `intelligence-refresh.running jobId=${jobId} brandProfileId=${job.brandProfileId}`,
    );

    try {
      const baseline = await this.prisma.brandIntelligenceBaseline.findUnique({
        where: { brandProfileId: job.brandProfileId },
      });
      const budget = await this.prisma.brandBudgetConfiguration.findUnique({
        where: { brandProfileId: job.brandProfileId },
      });
      if (!baseline || !budget) {
        throw new Error("Intelligence baseline or budget not ready");
      }

      const userText = [
        `GENERATED_HEALTH_METRICS_JSON: ${JSON.stringify(baseline.baselineHealth)}`,
        `GENERATED_SOV_JSON: ${JSON.stringify(baseline.shareOfVoice)}`,
        `GENERATED_STRATEGY_MIX_JSON: ${JSON.stringify({
          assetMix: budget.assetMix,
          tierMix: budget.tierMix,
          objectiveMix: budget.objectiveMix,
        })}`,
      ].join("\n");

      const raw = await this.gemini.generateJson({
        systemInstruction: loadBrandCentreSystemPrompt(
          "intelligence-leaks.prompt.md",
        ),
        userText,
        responseSchema: zodArrayToGeminiResponseSchema(
          IntelligenceLeakCardSchema,
        ),
      });
      const normalized = normalizeIntelligencePrompt2Payload(raw);
      const parsed = IntelligencePrompt2Schema.safeParse(normalized);
      if (!parsed.success) {
        throw new Error(
          `Intelligence prompt schema validation failed: ${parsed.error.message}`,
        );
      }

      let cards = parsed.data.filter((c) => c.projectedLiftPercentage >= 1);
      const rawCount = Array.isArray(raw) ? raw.length : isRecord(raw) ? 1 : 0;
      const normalizedCount = Array.isArray(normalized) ? normalized.length : 0;

      if (cards.length === 0) {
        this.logger.warn(
          `intelligence-refresh.zero-cards jobId=${jobId} raw=${rawCount} normalized=${normalizedCount} parsed=${parsed.data.length} — applying baseline fallback`,
        );
        cards = buildFallbackIntelligenceLeaks({
          baselineHealth: baseline.baselineHealth,
          shareOfVoice: baseline.shareOfVoice,
          growthImpactMatrix: baseline.growthImpactMatrix,
          assetMix: budget.assetMix,
        });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.brandPerformanceLeak.deleteMany({
          where: {
            brandProfileId: job.brandProfileId,
            isArchived: false,
            plannerStatus: "PENDING_USER_REVIEW",
          },
        });

        for (const card of cards) {
          await tx.brandPerformanceLeak.create({
            data: {
              brandProfileId: job.brandProfileId,
              insightTitle: card.insightTitle,
              shortDescription: card.shortDescription20Words,
              priorityRank: card.priorityRank as PriorityRank,
              leakBucket: card.leakBucket as LeakBucket,
              performanceStatus: card.performanceStatus as PerformanceColor,
              projectedLiftPercentage: new Prisma.Decimal(
                card.projectedLiftPercentage,
              ),
              drawerDeepDive:
                card.drawerDeepDive as unknown as Prisma.InputJsonValue,
            },
          });
        }

        await tx.brandIntelligenceBaseline.update({
          where: { brandProfileId: job.brandProfileId },
          data: { refreshedAt: new Date() },
        });

        await tx.brandProfile.update({
          where: { id: job.brandProfileId },
          data: { deepIntelStatus: IntelStatus.COMPLETED },
        });
      });

      await this.prisma.brandCentreJob.update({
        where: { id: jobId },
        data: {
          status: BrandCentreJobStatus.COMPLETED,
          finishedAt: new Date(),
          errorMessage: null,
        },
      });

      this.logger.log(
        `intelligence-refresh.completed jobId=${jobId} leakCount=${cards.length}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      await this.prisma.brandCentreJob.update({
        where: { id: jobId },
        data: {
          status: BrandCentreJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message.slice(0, 2000),
        },
      });
      this.logger.error(
        `intelligence-refresh.failed jobId=${jobId} error=${message}`,
      );
    }
  }
}
