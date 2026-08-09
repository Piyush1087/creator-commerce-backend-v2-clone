import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import { GeminiJsonClient } from "../integrations/gemini/gemini-json.client";
import { loadPromptMarkdown } from "../prompts/prompt-loader";
import type { IndustryClassifyInput } from "./industry-classify.input";
import type { IndustryClassifier } from "./industry-classifier.token";
import { GatekeeperGeminiSchema } from "./gatekeeper.schema";
import type { IndustryClassification } from "./industry.types";
import { mapGatekeeperToClassification } from "./map-gatekeeper-result";
import { StubIndustryClassifier } from "./stub-industry-classifier.service";

/**
 * Stage 0 Gatekeeper — Gemini only (no crawl / no Parallel).
 * Qualifies URL → supported + industry + sub_industry + confidence.
 * Uses the shared GeminiJsonClient (@google/generative-ai), same SDK path
 * as the rest of onboarding.
 */
@Injectable()
export class GatekeeperService implements IndustryClassifier {
  private readonly logger = new Logger(GatekeeperService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiJsonClient,
    private readonly stubFallback: StubIndustryClassifier,
  ) {}

  async classify(
    input: IndustryClassifyInput,
  ): Promise<IndustryClassification> {
    const gated = gateAndNormalizeBrandUrl(input.normalizedUrl);
    if (!gated.ok) {
      return this.stubFallback.classify(input);
    }

    const apiKey = this.config.get<string>("GEMINI_API_KEY", "")?.trim();
    if (!apiKey) {
      this.logger.warn("gatekeeper skipped: GEMINI_API_KEY not set");
      return this.stubFallback.classify(input);
    }

    const startedAt = Date.now();
    try {
      const modelId =
        this.config.get<string>("GATEKEEPER_GEMINI_MODEL")?.trim() ||
        this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
      const systemInstruction = loadPromptMarkdown("gatekeeper.prompt.md");
      const userText = [
        `CANONICAL_SITE_URL: ${gated.normalizedUrl}`,
        `HOSTNAME: ${gated.hostname}`,
      ].join("\n");

      const raw = await this.gemini.generateJson({
        systemInstruction,
        userText,
        modelId,
        temperature: 0,
      });

      const parsed = GatekeeperGeminiSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn(
          `gatekeeper schema_fail host=${input.hostname} ms=${Date.now() - startedAt} issues=${JSON.stringify(parsed.error.issues).slice(0, 800)}`,
        );
        return this.stubFallback.classify(input);
      }

      const mapped = mapGatekeeperToClassification(parsed.data);
      this.logger.log(
        `gatekeeper ok host=${input.hostname} ms=${Date.now() - startedAt} model=${modelId} supported=${mapped.supported} industry=${mapped.industry} confidence=${mapped.confidence}`,
      );
      return mapped;
    } catch (err) {
      this.logger.warn(
        `gatekeeper failed host=${input.hostname} ms=${Date.now() - startedAt} err=${String(err)} — falling back to stub`,
      );
      return this.stubFallback.classify(input);
    }
  }
}
