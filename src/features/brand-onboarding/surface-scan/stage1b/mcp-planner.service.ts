import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { GeminiJsonClient } from "../../integrations/gemini/gemini-json.client";
import { loadPromptMarkdown } from "../../prompts/prompt-loader";

const PlannedUrlsSchema = z.array(z.string().url()).max(7);

/**
 * Stage 1B MCP Planner — Gemini picks up to 7 high-value crawl targets from
 * the Stage 1A homepage link inventory. Falls back to first N links on error.
 * Planned URLs are filtered to the same apex origin as the authoritative site.
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
    /** Authoritative website URL — off-origin planned URLs are dropped. */
    websiteUrl: string;
  }): Promise<string[]> {
    const sameOriginInventory = filterSameApexOrigin(
      args.discoveredUrls,
      args.websiteUrl,
    );
    const fallback = sameOriginInventory.slice(0, 5);
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "")?.trim();
    if (!apiKey || sameOriginInventory.length === 0) {
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
          JSON.stringify(sameOriginInventory, null, 2),
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

      const filtered = filterSameApexOrigin(parsed.data, args.websiteUrl);
      const dropped = parsed.data.length - filtered.length;
      if (dropped > 0) {
        this.logger.warn(
          `mcp-planner.off_origin_dropped count=${dropped} apex=${apexHostFromUrl(args.websiteUrl) ?? "-"}`,
        );
      }

      const selected = filtered.length > 0 ? filtered : fallback;
      this.logger.log(
        `mcp-planner.ok industry=${args.industry} inventory=${sameOriginInventory.length} selected=${selected.length} model=${modelId} ms=${Date.now() - startedAt}`,
      );
      return selected;
    } catch (err) {
      this.logger.warn(
        `mcp-planner failed ms=${Date.now() - startedAt} err=${String(err)} — using fallback (${fallback.length} urls)`,
      );
      return fallback;
    }
  }
}

/** Strip www and compare hostnames; drop URLs that are not same apex. */
export function filterSameApexOrigin(
  urls: string[],
  websiteUrl: string,
): string[] {
  const apex = apexHostFromUrl(websiteUrl);
  if (!apex) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const host = apexHostFromUrl(url);
    if (!host || host !== apex) {
      continue;
    }
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function apexHostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
