import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type {
  ParallelExtractRequest,
  ParallelExtractResponse,
} from "./parallel-extract.types";

const PARALLEL_EXTRACT_URL = "https://api.parallel.ai/v1/extract";

@Injectable()
export class ParallelExtractClient {
  private readonly logger = new Logger(ParallelExtractClient.name);

  constructor(private readonly config: ConfigService) {}

  async extract(
    request: ParallelExtractRequest,
  ): Promise<ParallelExtractResponse> {
    const apiKey = this.config.get<string>("PARALLEL_API_KEY", "");
    if (!apiKey) {
      throw new Error("PARALLEL_API_KEY is not configured");
    }

    const body: ParallelExtractRequest = {
      urls: request.urls,
      objective: request.objective,
      advanced_settings: {
        ...(request.advanced_settings ?? {}),
        full_content: { max_chars_per_result: 40_000 },
      },
    };

    const controller = new AbortController();
    const timeoutMs = this.config.get<number>(
      "PARALLEL_EXTRACT_TIMEOUT_MS",
      120_000,
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(PARALLEL_EXTRACT_URL, {
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
          `Parallel extract failed status=${response.status} body=${text.slice(0, 500)}`,
        );
        throw new Error(`Parallel extract failed (${response.status})`);
      }
      return JSON.parse(text) as ParallelExtractResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}
