import { GoogleGenAI } from "@google/genai";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
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
 */
@Injectable()
export class GatekeeperService implements IndustryClassifier {
  private readonly logger = new Logger(GatekeeperService.name);

  constructor(
    private readonly config: ConfigService,
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

    try {
      const modelId =
        this.config.get<string>("GATEKEEPER_GEMINI_MODEL")?.trim() ||
        this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
      const systemInstruction = loadPromptMarkdown("gatekeeper.prompt.md");
      const userText = [
        `CANONICAL_SITE_URL: ${gated.normalizedUrl}`,
        `HOSTNAME: ${gated.hostname}`,
      ].join("\n");

      const ai = new GoogleGenAI({ apiKey });
      const timeoutMs = this.config.get<number>(
        "GEMINI_REQUEST_TIMEOUT_MS",
        120_000,
      );

      const response = await Promise.race([
        ai.models.generateContent({
          model: modelId,
          contents: `${systemInstruction}\n\n---\n\n${userText}`,
          config: {
            responseMimeType: "application/json",
            temperature: 0,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Gatekeeper Gemini request timed out")),
            timeoutMs,
          ),
        ),
      ]);

      const text = (response.text ?? "").trim();
      if (!text) {
        this.logger.warn(`gatekeeper empty_response host=${input.hostname}`);
        return this.stubFallback.classify(input);
      }

      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch (err) {
        this.logger.warn(
          `gatekeeper invalid_json host=${input.hostname} err=${String(err)} text=${text.slice(0, 400)}`,
        );
        return this.stubFallback.classify(input);
      }

      const parsed = GatekeeperGeminiSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn(
          `gatekeeper schema_fail host=${input.hostname} issues=${JSON.stringify(parsed.error.issues).slice(0, 800)}`,
        );
        return this.stubFallback.classify(input);
      }

      const mapped = mapGatekeeperToClassification(parsed.data);
      this.logger.log(
        `gatekeeper ok host=${input.hostname} supported=${mapped.supported} industry=${mapped.industry} confidence=${mapped.confidence}`,
      );
      return mapped;
    } catch (err) {
      this.logger.warn(
        `gatekeeper failed host=${input.hostname} err=${String(err)}`,
      );
      return this.stubFallback.classify(input);
    }
  }
}
