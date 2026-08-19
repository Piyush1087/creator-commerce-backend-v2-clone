import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  ParallelSearchClient,
  ParallelSearchError,
} from "../../brand-onboarding/integrations/parallel/parallel-search.client";
import {
  DataExtractionProviderError,
  type EvidenceProvenance,
  type ProviderEvidenceResult,
} from "../contracts/provider-execution.contract";
import { withBoundedTechnicalRetry } from "../utils/provider-retry.util";

const CAPABILITY_ID = "company_public_web_research";

export type CompanyPublicWebResearchPayload = {
  searchId: string;
  sessionId: string;
  results: Array<{
    url: string;
    title?: string;
    publishDate?: string | null;
    excerpts: string[];
  }>;
  warnings?: unknown;
};

@Injectable()
export class ParallelCompanyResearchProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly searchClient: ParallelSearchClient,
  ) {}

  async execute(args: {
    acquisitionRunId: string;
    objective: string;
    searchQueries: string[];
    sessionId?: string;
    maxCharsTotal?: number;
  }): Promise<ProviderEvidenceResult<CompanyPublicWebResearchPayload>> {
    const apiKey = this.config.get<string>("PARALLEL_API_KEY", "").trim();
    if (!apiKey) {
      throw new DataExtractionProviderError({
        code: "CONFIGURATION_ERROR",
        provider: "PARALLEL_AI",
        capabilityId: CAPABILITY_ID,
        message: "PARALLEL_API_KEY is not configured",
        retryable: false,
        attemptCount: 0,
        acquisitionRunId: args.acquisitionRunId,
      });
    }
    if (!args.searchQueries.some((query) => query.trim().length > 0)) {
      throw new DataExtractionProviderError({
        code: "INVALID_PROVIDER_RESPONSE",
        provider: "PARALLEL_AI",
        capabilityId: CAPABILITY_ID,
        message: "At least one public-web research query is required",
        retryable: false,
        attemptCount: 0,
        acquisitionRunId: args.acquisitionRunId,
      });
    }

    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const maxAttempts = this.config.get<number>(
      "DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS",
      3,
    );
    let attemptCount = 0;

    try {
      const execution = await withBoundedTechnicalRetry({
        maxAttempts,
        classify: (error) => {
          if (!(error instanceof ParallelSearchError)) return { retry: false };
          return {
            retry:
              error.status === 408 ||
              error.status === 429 ||
              (typeof error.status === "number" && error.status >= 500) ||
              /timed out|connection failed/i.test(error.message),
            retryAfterMs: error.retryAfterMs,
          };
        },
        operation: async (attempt) => {
          attemptCount = attempt;
          return this.searchClient.searchOrThrow({
            objective: args.objective,
            search_queries: args.searchQueries,
            mode: "advanced",
            max_chars_total: args.maxCharsTotal,
            session_id: args.sessionId ?? null,
          });
        },
      });
      attemptCount = execution.attemptCount;
      const acquiredAt = new Date().toISOString();
      const results = (execution.value.results ?? []).map((row) => ({
        url: row.url,
        title: row.title,
        publishDate: row.publish_date,
        excerpts: row.excerpts ?? [],
      }));
      const provenance: EvidenceProvenance[] = results
        .filter((row) => Boolean(row.url))
        .map((row) => ({
          type: "PUBLIC_WEB_RESEARCH" as const,
          sourceUrl: row.url,
          title: row.title,
          providerReference: execution.value.search_id,
          acquiredAt,
        }));
      const qualityFlags = [
        ...(results.length === 0 ? ["NO_RESULTS"] : []),
        ...(results.some((row) => !row.url) ? ["SOURCE_URL_MISSING"] : []),
        ...(execution.value.warnings ? ["PROVIDER_WARNING"] : []),
      ];
      const available = results.length > 0;
      const completed = Date.now();

      return {
        capabilityId: CAPABILITY_ID,
        acquisitionRunId: args.acquisitionRunId,
        availability: available ? "AVAILABLE" : "UNAVAILABLE",
        quality: qualityFlags.length === 0 ? "VALID" : "DEGRADED",
        qualityFlags,
        payload: {
          searchId: execution.value.search_id,
          sessionId: execution.value.session_id,
          results,
          warnings: execution.value.warnings,
        },
        provenance,
        connectionState: available ? "CONNECTED" : "DEGRADED",
        telemetry: {
          acquisitionRunId: args.acquisitionRunId,
          capabilityId: CAPABILITY_ID,
          provider: "PARALLEL_AI",
          startedAt,
          completedAt: new Date(completed).toISOString(),
          durationMs: completed - started,
          attemptCount,
          rateLimited: false,
          usage: execution.value.usage,
        },
      };
    } catch (error) {
      if (error instanceof DataExtractionProviderError) throw error;
      if (error instanceof ParallelSearchError) {
        const code = !error.status
          ? /API_KEY/.test(error.message)
            ? "CONFIGURATION_ERROR"
            : /timed out/i.test(error.message)
              ? "REQUEST_TIMEOUT"
              : "NETWORK_ERROR"
          : error.status === 401 || error.status === 403
            ? "AUTHENTICATION_FAILED"
            : error.status === 429
              ? "RATE_LIMITED"
              : error.status >= 500
                ? "PROVIDER_UNAVAILABLE"
                : "PROVIDER_ERROR";
        throw new DataExtractionProviderError({
          code,
          provider: "PARALLEL_AI",
          capabilityId: CAPABILITY_ID,
          message: `Parallel company research failed (${code})`,
          retryable: false,
          attemptCount,
          providerStatusCode: error.status,
          retryAfterMs: error.retryAfterMs,
          acquisitionRunId: args.acquisitionRunId,
        });
      }
      throw new DataExtractionProviderError({
        code: "PROVIDER_ERROR",
        provider: "PARALLEL_AI",
        capabilityId: CAPABILITY_ID,
        message: "Parallel company research failed",
        retryable: false,
        attemptCount,
        acquisitionRunId: args.acquisitionRunId,
      });
    }
  }
}
