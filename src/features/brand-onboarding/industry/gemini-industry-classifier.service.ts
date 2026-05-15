import { Injectable, Logger } from "@nestjs/common";

import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import { GeminiJsonClient } from "../integrations/gemini/gemini-json.client";
import { ParallelExtractClient } from "../integrations/parallel/parallel-extract.client";
import { loadPromptMarkdown } from "../prompts/prompt-loader";
import type { IndustryClassifyInput } from "./industry-classify.input";
import type { IndustryClassifier } from "./industry-classifier.token";
import { IndustryGateGeminiSchema } from "./industry-gate-gemini.schema";
import type { IndustryClassification } from "./industry.types";
import { mapIndustryGateToClassification } from "./map-industry-gate-result";
import { StubIndustryClassifier } from "./stub-industry-classifier.service";

@Injectable()
export class GeminiIndustryClassifier implements IndustryClassifier {
  private readonly logger = new Logger(GeminiIndustryClassifier.name);

  constructor(
    private readonly parallel: ParallelExtractClient,
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
    try {
      const extract = await this.parallel.extract({
        urls: [gated.normalizedUrl],
        objective:
          "Extract only homepage / above-the-fold factual text: what the business sells, category self-description, and any industry self-identification. Keep excerpts concise; ignore legal boilerplate unless it states the vertical.",
      });
      const markdown = this.concatParallelMarkdown(extract);
      if (markdown.trim().length < 40) {
        this.logger.log(
          `industry gate insufficient_markdown host=${input.hostname}`,
        );
        return this.stubFallback.classify(input);
      }
      const systemInstruction = loadPromptMarkdown(
        "industry-classifier.prompt.md",
      );
      const userText = [
        `CANONICAL_SITE_URL: ${gated.normalizedUrl}`,
        "",
        "LANDING_PAGE_MARKDOWN:",
        markdown,
      ].join("\n");
      const raw = await this.gemini.generateJson({
        systemInstruction,
        userText,
      });
      const parsed = IndustryGateGeminiSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn(
          `industry gate invalid_json issues=${JSON.stringify(parsed.error.issues).slice(0, 1200)}`,
        );
        return this.stubFallback.classify(input);
      }
      return mapIndustryGateToClassification(parsed.data);
    } catch (err) {
      this.logger.warn(
        `industry gate failed host=${input.hostname} err=${String(err)}`,
      );
      return this.stubFallback.classify(input);
    }
  }

  private concatParallelMarkdown(extract: {
    results: Array<{
      url: string;
      excerpts?: string[];
      full_content?: string;
    }>;
  }): string {
    const parts: string[] = [];
    for (const row of extract.results ?? []) {
      const body =
        row.full_content && row.full_content.length > 0
          ? row.full_content
          : (row.excerpts ?? []).join("\n\n");
      parts.push(`\n\n## SOURCE: ${row.url}\n\n${body}`);
    }
    return parts.join("\n");
  }
}
