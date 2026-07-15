import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { GeminiJsonClient } from "../../integrations/gemini/gemini-json.client";
import { loadPromptMarkdown } from "../../prompts/prompt-loader";

const PlannedUrlsSchema = z.array(z.string().url()).max(7);

/**
 * Stage 1B MCP Planner — Gemini picks up to 7 high-value crawl targets from
 * the Stage 1A homepage link inventory. Falls back to first N links on error.
 * Uses the shared GeminiJsonClient (@google/generative-ai).
 */
@Injectable()
export class McpPlannerService {
  private readonly logger = new Logger(McpPlannerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly gemini: GeminiJsonClient,
  ) {}

  async generateCrawlStrategy(args: {
    industry: string;
    subIndustry: string;
    discoveredUrls: string[];
  }): Promise<string[]> {
    const fallback = args.discoveredUrls.slice(0, 5);
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "")?.trim();
    if (!apiKey || args.discoveredUrls.length === 0) {
      return fallback;
    }

    const startedAt = Date.now();
    try {
      const modelId =
        this.config.get<string>("MCP_PLANNER_GEMINI_MODEL")?.trim() ||
        this.config.get<string>("GEMINI_MODEL", "gemini-2.5-flash");
      const template = loadPromptMarkdown("mcp-planner.prompt.md");
      const prompt = template
        .replace("{{industry}}", args.industry)
        .replace("{{sub_industry}}", args.subIndustry)
        .replace(
          "{{link_inventory}}",
          JSON.stringify(args.discoveredUrls, null, 2),
        );

      const raw = await this.gemini.generateJson({
        systemInstruction:
          "You are a crawl planner. Respond with a JSON array of URLs only.",
        userText: prompt,
        modelId,
        temperature: 0.1,
      });

      const parsed = PlannedUrlsSchema.safeParse(raw);
      if (!parsed.success) {
        this.logger.warn(
          `mcp-planner schema_fail ms=${Date.now() - startedAt} issues=${JSON.stringify(parsed.error.issues).slice(0, 400)}`,
        );
        return fallback;
      }
      this.logger.log(
        `mcp-planner ok ms=${Date.now() - startedAt} urls=${parsed.data.length}`,
      );
      return parsed.data;
    } catch (err) {
      this.logger.warn(
        `mcp-planner failed ms=${Date.now() - startedAt} err=${String(err)} — using fallback (${fallback.length} urls)`,
      );
      return fallback;
    }
  }
}
