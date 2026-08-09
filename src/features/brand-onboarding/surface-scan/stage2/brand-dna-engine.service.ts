import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrandIntelligenceStage, type Prisma } from "@prisma/client";

import { PrismaService } from "../../../../prisma/prisma.service";
import { GeminiJsonClient } from "../../integrations/gemini/gemini-json.client";
import { PromptBuilderService } from "./prompt-builder.service";

/**
 * Phase 6 Prompt A — Brand DNA extraction via Gemini.
 */
@Injectable()
export class BrandDnaEngineService {
  private readonly logger = new Logger(BrandDnaEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly gemini: GeminiJsonClient,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async extractBrandDna(
    scanId: string,
    options?: { correctionHint?: string },
  ): Promise<unknown> {
    const scan = await this.prisma.brandIntelligenceScan.findUnique({
      where: { id: scanId },
    });
    if (!scan) {
      throw new Error(`BrandIntelligenceScan not found: ${scanId}`);
    }
    if (!scan.runtimeContext) {
      throw new Error("runtime_context is required before Prompt A");
    }

    // Full Stage 1B package is already persisted on runtimeContext.
    const runtimePayload =
      scan.runtimeContext &&
      typeof scan.runtimeContext === "object" &&
      !Array.isArray(scan.runtimeContext)
        ? {
            ...(scan.runtimeContext as Record<string, unknown>),
            ...(options?.correctionHint
              ? { correction_instructions: options.correctionHint }
              : {}),
          }
        : {
            pages: scan.runtimeContext,
            ...(options?.correctionHint
              ? { correction_instructions: options.correctionHint }
              : {}),
          };

    const startedAt = Date.now();
    const pageCount = Array.isArray(
      (runtimePayload as { pages?: unknown }).pages,
    )
      ? ((runtimePayload as { pages: unknown[] }).pages.length ?? 0)
      : Array.isArray(scan.runtimeContext)
        ? scan.runtimeContext.length
        : 0;
    this.logger.log(
      `brand-dna.start scanId=${scanId} pages=${pageCount} retry=${options?.correctionHint ? "yes" : "no"}`,
    );

    try {
      const compiled = await this.promptBuilder.buildPrompt(
        "brand_dna",
        runtimePayload,
      );
      const modelId =
        this.config.get<string>("BRAND_DNA_GEMINI_MODEL")?.trim() ||
        this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");

      this.logger.log(
        `brand-dna.gemini_call scanId=${scanId} model=${modelId} promptChars=${compiled.length}`,
      );

      const raw = await this.gemini.generateJson({
        systemInstruction:
          "You are the Brand DNA extraction engine. Respond with JSON only.",
        userText: compiled,
        modelId,
        temperature: 0.1,
      });

      await this.prisma.brandIntelligenceScan.update({
        where: { id: scanId },
        data: {
          brandDnaRaw: raw as Prisma.InputJsonValue,
          currentStage: BrandIntelligenceStage.STAGE_2_BRAND_DNA_COMPLETE,
          errorLogs: null,
        },
      });

      this.logger.log(
        `brand-dna.ok scanId=${scanId} model=${modelId} ms=${Date.now() - startedAt} → STAGE_2_BRAND_DNA_COMPLETE`,
      );
      return raw;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `brand-dna.fail scanId=${scanId} ms=${Date.now() - startedAt} err=${message}`,
      );
      await this.prisma.brandIntelligenceScan.update({
        where: { id: scanId },
        data: {
          currentStage: BrandIntelligenceStage.STAGE_2_BRAND_DNA_FAILED,
          errorLogs: `Prompt A Error: ${message}`,
        },
      });
      throw err;
    }
  }
}
