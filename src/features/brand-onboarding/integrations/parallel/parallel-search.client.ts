import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type {
  ParallelSearchRequest,
  ParallelSearchResponse,
} from "./parallel-search.types";

const PARALLEL_SEARCH_URL = "https://api.parallel.ai/v1/search";

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.max(0, timestamp - Date.now());
}

export class ParallelSearchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ParallelSearchError";
  }
}

@Injectable()
export class ParallelSearchClient {
  private readonly logger = new Logger(ParallelSearchClient.name);

  constructor(private readonly config: ConfigService) {}

  async search(
    request: ParallelSearchRequest,
  ): Promise<ParallelSearchResponse | null> {
    try {
      return await this.searchOrThrow(request);
    } catch (err) {
      this.logger.warn(`Parallel search error err=${String(err)}`);
      return null;
    }
  }

  async searchOrThrow(
    request: ParallelSearchRequest,
  ): Promise<ParallelSearchResponse> {
    const apiKey = this.config.get<string>("PARALLEL_API_KEY", "");
    if (!apiKey) {
      throw new ParallelSearchError("PARALLEL_API_KEY is not configured");
    }

    if (
      !request.search_queries?.length ||
      !request.search_queries.some((q) => q.trim().length > 0)
    ) {
      throw new ParallelSearchError("Parallel search requires search_queries");
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
        throw new ParallelSearchError(
          `Parallel search failed (${response.status})`,
          response.status,
          retryAfterMs(response.headers.get("retry-after")),
        );
      }
      try {
        return JSON.parse(text) as ParallelSearchResponse;
      } catch {
        throw new ParallelSearchError("Parallel search returned invalid JSON");
      }
    } catch (err) {
      if (err instanceof ParallelSearchError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new ParallelSearchError("Parallel search timed out");
      }
      throw new ParallelSearchError("Parallel search connection failed");
    } finally {
      clearTimeout(timer);
    }
  }
}
