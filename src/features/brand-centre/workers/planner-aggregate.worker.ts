import { Injectable, Logger } from "@nestjs/common";
import {
  BrandCentreJobStatus,
  LeakPlannerStatus,
  PlannerCardType,
  PlannerWorkflowStatus,
  Prisma,
} from "@prisma/client";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { PrismaService } from "../../../prisma/prisma.service";
import { loadBrandCentreSystemPrompt } from "../prompts/prompt-loader";
import { zodToGeminiResponseSchema } from "../prompts/zod-to-gemini-response-schema.util";
import { PlannerPrompt3Schema } from "../schemas/planner-prompt3.schema";
import { normalizePlannerPrompt3Payload } from "../utils/normalize-planner-prompt3-payload.util";

@Injectable()
export class PlannerAggregateWorker {
  private readonly logger = new Logger(PlannerAggregateWorker.name);

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

    const payload = job.payload as { leakId?: string } | null;
    const leakId = payload?.leakId;
    if (!leakId) {
      await this.failJob(jobId, "Missing leakId in job payload");
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
      `planner-aggregate.running jobId=${jobId} brandProfileId=${job.brandProfileId} leakId=${leakId}`,
    );

    try {
      const leak = await this.prisma.brandPerformanceLeak.findFirst({
        where: { id: leakId, brandProfileId: job.brandProfileId },
      });
      if (!leak) {
        throw new Error("Leak not found");
      }

      const profile = await this.prisma.brandProfile.findUnique({
        where: { id: job.brandProfileId },
        include: {
          offerings: { where: { isActive: true }, take: 10 },
          budgetConfiguration: true,
        },
      });
      if (!profile) {
        throw new Error("Profile not found");
      }

      const activePlanner = await this.prisma.brandPlannerCard.findMany({
        where: {
          brandProfileId: job.brandProfileId,
          workflowStatus: {
            in: [
              PlannerWorkflowStatus.PENDING_USER_REVIEW,
              PlannerWorkflowStatus.PROCEEDED_TO_PIPELINE,
            ],
          },
        },
      });

      const userText = [
        `BRAND_DNA_PROFILE_JSON: ${JSON.stringify({
          name: profile.name,
          domain: profile.domain,
          routingType: profile.brandRoutingType,
          strategicDna: profile.strategicDna,
          offerings: profile.offerings,
        })}`,
        `APPROVED_LEAKS_INPUT_JSON: ${JSON.stringify([
          {
            insightTitle: leak.insightTitle,
            shortDescription: leak.shortDescription,
            leakBucket: leak.leakBucket,
            priorityRank: leak.priorityRank,
          },
        ])}`,
        `ACTIVE_RUNNING_CAMPAIGNS_JSON: ${JSON.stringify(
          activePlanner.map((c) => ({
            id: c.id,
            aggregationKey: c.aggregationKey,
            cardType: c.cardType,
          })),
        )}`,
      ].join("\n");

      const raw = await this.gemini.generateJson({
        systemInstruction: loadBrandCentreSystemPrompt(
          "planner-aggregator.prompt.md",
        ),
        userText,
        responseSchema: zodToGeminiResponseSchema(PlannerPrompt3Schema),
      });
      const normalized = normalizePlannerPrompt3Payload(raw);
      const parsed = PlannerPrompt3Schema.safeParse(normalized);
      if (!parsed.success) {
        throw new Error(
          `Planner prompt schema validation failed: ${parsed.error.message}`,
        );
      }
      const data = parsed.data;

      let workflowStatus: PlannerWorkflowStatus =
        PlannerWorkflowStatus.PENDING_USER_REVIEW;
      if (data.cardType === "AUTO_PAUSE_LOG") {
        workflowStatus = PlannerWorkflowStatus.AUTO_EXECUTED_BYPASS;
      } else if (data.workflowStatus) {
        workflowStatus = data.workflowStatus as PlannerWorkflowStatus;
      }

      const card = await this.prisma.$transaction(async (tx) => {
        const created = await tx.brandPlannerCard.create({
          data: {
            brandProfileId: job.brandProfileId,
            cardType: data.cardType as PlannerCardType,
            aggregationKey: data.aggregationKey as unknown as Prisma.InputJsonValue,
            existingTargetCampaignId: data.existingTargetCampaignId,
            campaignMetadata:
              data.campaignMetadata as unknown as Prisma.InputJsonValue,
            assetsAndBriefsMatrix:
              data.assetsAndBriefsMatrix as unknown as Prisma.InputJsonValue,
            workflowStatus,
            sourceLeakId: leakId,
          },
        });

        await tx.brandPerformanceLeak.update({
          where: { id: leakId },
          data: {
            plannerStatus: LeakPlannerStatus.PUSHED_TO_PLANNER,
            plannerCardId: created.id,
          },
        });

        return created;
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
        `planner-aggregate.completed jobId=${jobId} cardId=${card.id}`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown";
      await this.failJob(jobId, message);
      this.logger.error(
        `planner-aggregate.failed jobId=${jobId} error=${message}`,
      );
    }
  }

  private async failJob(jobId: string, message: string): Promise<void> {
    await this.prisma.brandCentreJob.update({
      where: { id: jobId },
      data: {
        status: BrandCentreJobStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message.slice(0, 2000),
      },
    });
  }
}
