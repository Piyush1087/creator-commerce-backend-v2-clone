import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type {
  ParallelSearchRequest,
  ParallelSearchResponse,
} from "./parallel-search.types";

const PARALLEL_SEARCH_URL = "https://api.parallel.ai/v1/search";

@Injectable()
export class ParallelSearchClient {
  private readonly logger = new Logger(ParallelSearchClient.name);

  constructor(private readonly config: ConfigService) {}

  async search(
    request: ParallelSearchRequest,
  ): Promise<ParallelSearchResponse | null> {
    const apiKey = this.config.get<string>("PARALLEL_API_KEY", "");
    if (!apiKey) {
      this.logger.warn("Parallel search skipped: PARALLEL_API_KEY not set");
      return null;
    }

    if (
      !request.search_queries?.length ||
      !request.search_queries.some((q) => q.trim().length > 0)
    ) {
      this.logger.warn("Parallel search skipped: empty search_queries");
      return null;
    }

    const body: ParallelSearchRequest = {
      objective: request.objective ?? null,
      search_queries: request.search_queries
        .map((q) => q.trim())
        .filter(Boolean),
      mode: request.mode ?? "basic",
      max_chars_total:
        request.max_chars_total ??
        this.config.get<number>("PARALLEL_SEARCH_MAX_CHARS_TOTAL", 24_000),
      session_id: request.session_id ?? null,
    };
    const cm = request.client_model?.trim();
    if (cm) {
      body.client_model = cm;
    }

    const controller = new AbortController();
    const timeoutMs = this.config.get<number>(
      "PARALLEL_SEARCH_TIMEOUT_MS",
      90_000,
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(PARALLEL_SEARCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        this.logger.warn(
          `Parallel search failed status=${response.status} body=${text.slice(0, 500)}`,
        );
        return null;
      }
      return JSON.parse(text) as ParallelSearchResponse;
    } catch (err) {
      this.logger.warn(`Parallel search error err=${String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
