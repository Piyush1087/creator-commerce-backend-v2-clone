import { Injectable, Logger } from "@nestjs/common";
import {
  BrandCentreJobStatus,
  BudgetAllocationPhase,
  IntelStatus,
  Prisma,
  ScanStatus,
} from "@prisma/client";

import { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { PrismaService } from "../../../prisma/prisma.service";
import { loadBrandCentreSystemPrompt } from "../prompts/prompt-loader";
import { zodToGeminiResponseSchema } from "../prompts/zod-to-gemini-response-schema.util";
import { DeepScanPrompt1Schema } from "../schemas/deep-scan-prompt1.schema";
import {
  applyPrompt1InventoryEntities,
  applyPrompt1OffersLedger,
  normalizeSocialHandle,
} from "../utils/apply-prompt1-inventory.util";
import { normalizeDeepScanGeminiPayload } from "../utils/normalize-deep-scan-payload.util";

@Injectable()
export class DeepScanWorker {
  private readonly logger = new Logger(DeepScanWorker.name);

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
      `deep-scan.running jobId=${jobId} brandProfileId=${job.brandProfileId}`,
    );

    try {
      const profile = await this.prisma.brandProfile.findUnique({
        where: { id: job.brandProfileId },
        include: {
          offerings: { where: { isActive: true } },
          competitors: { where: { isActive: true } },
        },
      });
      if (!profile) {
        throw new Error("Brand profile not found");
      }

      const brandUrl = `https://${profile.domain}`;
      const productsJson = profile.offerings.map((o) => ({
        id: o.id,
        type: o.type,
        name: o.name,
        url: o.url,
        description: o.description,
      }));
      const competitorsJson = profile.competitors.map((c) => ({
        name: c.name,
        websiteUrl: c.websiteUrl,
        whyCompetitor: c.whyCompetitor,
      }));

      const scrapeText =
        profile.surfaceScrapeBundles?.trim() ||
        JSON.stringify({
          name: profile.name,
          tagline: profile.tagline,
          description: profile.description,
          visualIdentity: profile.visualIdentity,
          targetAudience: profile.targetAudience,
          surfaceOffers: profile.surfaceOffers,
        });

      const userText = [
        `BRAND_URL: ${brandUrl}`,
        `BRAND_ROUTING_TYPE: ${profile.brandRoutingType}`,
        `COUNTRY: ${profile.countryCode ?? "US"}`,
        `CURRENCY: ${profile.currencyCode}`,
        `DISCOVERED_PRODUCTS_JSON: ${JSON.stringify(productsJson)}`,
        `DISCOVERED_COMPETITORS_JSON: ${JSON.stringify(competitorsJson)}`,
        `RAW_SURFACE_SCRAPE_TEXT: ${scrapeText}`,
      ].join("\n");

      const systemInstruction = loadBrandCentreSystemPrompt(
        "deep-scan-strategy.prompt.md",
      );
      const raw = await this.gemini.generateJson({
        systemInstruction,
        userText,
        responseSchema: zodToGeminiResponseSchema(DeepScanPrompt1Schema),
      });
      const normalized = normalizeDeepScanGeminiPayload(
        raw,
        profile.brandRoutingType,
        profile.offerings.map((o) => ({
          id: o.id,
          type: o.type,
          name: o.name,
          url: o.url,
          description: o.description,
        })),
      );
      const parsed = DeepScanPrompt1Schema.safeParse(normalized);
      if (!parsed.success) {
        throw new Error(
          `Deep scan schema validation failed: ${parsed.error.message}`,
        );
      }
      const data = parsed.data;

      const strategicDna = {
        narrative: data.strategicDNA.narrative,
        visuals: data.strategicDNA.visuals,
        complianceGuardrails: data.strategicDNA.complianceGuardrails,
      };

      const growthImpactMatrix = data.growthImpactMatrix;

      const profilePatch: Prisma.BrandProfileUpdateInput = {
        tagline: data.strategicDNA.narrative.tagline,
        description: data.strategicDNA.narrative.briefDescription,
        strategicDna: strategicDna as unknown as Prisma.InputJsonValue,
        visualIdentity: {
          colors: data.strategicDNA.visuals.palette,
          fonts: {
            heading: data.strategicDNA.visuals.fonts[0] ?? "Unknown",
            body:
              data.strategicDNA.visuals.fonts[1] ??
              data.strategicDNA.visuals.fonts[0] ??
              "Unknown",
          },
          toneOfVoice: data.strategicDNA.narrative.toneOfVoice.map(
            (label) => ({ label, description: "" }),
          ),
          aesthetic: data.strategicDNA.visuals.aesthetics,
        } as unknown as Prisma.InputJsonValue,
        scanStatus: ScanStatus.READY,
        deepIntelStatus: IntelStatus.COMPLETED,
        deepScanCompletedAt: new Date(),
        deepScanCount: { increment: 1 },
      };

      if (data.brandProfile?.logoUrl) {
        profilePatch.logoUrl = data.brandProfile.logoUrl;
      }
      if (data.brandProfile?.lifecycleStage) {
        profilePatch.lifecycleStage = data.brandProfile.lifecycleStage;
      }
      const ig = normalizeSocialHandle(data.brandProfile?.igHandle);
      const yt = normalizeSocialHandle(data.brandProfile?.ytHandle);
      const tiktok = normalizeSocialHandle(data.brandProfile?.tiktokHandle);
      if (ig) {
        profilePatch.igHandle = ig;
      }
      if (yt) {
        profilePatch.ytHandle = yt;
      }
      if (tiktok) {
        profilePatch.tiktokHandle = tiktok;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.brandProfile.update({
          where: { id: profile.id },
          data: profilePatch,
        });

        await tx.brandAudiencePersona.deleteMany({
          where: { brandProfileId: profile.id },
        });
        if (data.audiencePersonas.length > 0) {
          await tx.brandAudiencePersona.createMany({
            data: data.audiencePersonas.map((p, index) => ({
              brandProfileId: profile.id,
              personaName: p.personaName,
              demographicsJson:
                p.demographicsJson as unknown as Prisma.InputJsonValue,
              psychographicsText: p.psychographicsText ?? null,
              sortOrder: index,
            })),
          });
        }

        if (data.inventoryInfrastructure?.entities.length) {
          await applyPrompt1InventoryEntities(
            tx,
            profile.id,
            profile.currencyCode,
            data.inventoryInfrastructure.entities,
            profile.offerings.map((o) => ({ id: o.id, url: o.url })),
          );
        }

        if (data.offersLedger.length > 0) {
          await applyPrompt1OffersLedger(
            tx,
            profile.id,
            data.offersLedger,
          );
        }

        await tx.brandBudgetConfiguration.upsert({
          where: { brandProfileId: profile.id },
          create: {
            brandProfileId: profile.id,
            masterMonthlyBudget: new Prisma.Decimal(
              data.financials.masterMonthlyBudget,
            ),
            allocationPhase: BudgetAllocationPhase.PHASE_2_SELF_HEALING,
            assetMix: data.financials.strategyMix
              .assetMix as unknown as Prisma.InputJsonValue,
            tierMix: data.financials.strategyMix
              .tierMix as unknown as Prisma.InputJsonValue,
            objectiveMix: data.financials.strategyMix
              .objectiveMix as unknown as Prisma.InputJsonValue,
            aiExplanationText:
              "Budget and allocation mixes were inferred from your public footprint, industry routing template, and competitor context.",
          },
          update: {
            masterMonthlyBudget: new Prisma.Decimal(
              data.financials.masterMonthlyBudget,
            ),
            allocationPhase: BudgetAllocationPhase.PHASE_2_SELF_HEALING,
            assetMix: data.financials.strategyMix
              .assetMix as unknown as Prisma.InputJsonValue,
            tierMix: data.financials.strategyMix
              .tierMix as unknown as Prisma.InputJsonValue,
            objectiveMix: data.financials.strategyMix
              .objectiveMix as unknown as Prisma.InputJsonValue,
            aiExplanationText:
              "Budget and allocation mixes were inferred from your public footprint, industry routing template, and competitor context.",
          },
        });

        await tx.brandIntelligenceBaseline.upsert({
          where: { brandProfileId: profile.id },
          create: {
            brandProfileId: profile.id,
            growthImpactMatrix:
              growthImpactMatrix as unknown as Prisma.InputJsonValue,
            baselineHealth:
              data.baselineHealth as unknown as Prisma.InputJsonValue,
            shareOfVoice:
              data.shareOfVoice as unknown as Prisma.InputJsonValue,
            refreshedAt: new Date(),
          },
          update: {
            growthImpactMatrix:
              growthImpactMatrix as unknown as Prisma.InputJsonValue,
            baselineHealth:
              data.baselineHealth as unknown as Prisma.InputJsonValue,
            shareOfVoice:
              data.shareOfVoice as unknown as Prisma.InputJsonValue,
            refreshedAt: new Date(),
          },
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

      this.logger.log(`deep-scan.completed jobId=${jobId}`);
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
      await this.prisma.brandProfile.update({
        where: { id: job.brandProfileId },
        data: {
          scanStatus: ScanStatus.SURFACE_COMPLETE,
          deepIntelStatus: IntelStatus.FAILED,
        },
      });
      this.logger.error(`deep-scan.failed jobId=${jobId} error=${message}`);
    }
  }
}
