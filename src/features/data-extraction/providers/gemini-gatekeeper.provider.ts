import { GoogleGenAI } from "@google/genai";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  DataExtractionProviderError,
  type EvidenceProvenance,
  type ProviderEvidenceResult,
} from "../contracts/provider-execution.contract";
import { withBoundedTechnicalRetry } from "../utils/provider-retry.util";

const CAPABILITY_ID = "gatekeeper_primary_web_assessment";

type GeminiInteractionStep = {
  type?: string;
  is_error?: boolean;
  result?: Array<{
    url?: string;
    status?: string;
    search_suggestions?: string;
  }>;
  content?: Array<{
    type?: string;
    text?: string;
    annotations?: Array<{
      type?: string;
      url?: string;
      title?: string;
    }>;
  }>;
};

type GeminiInteractionLike = {
  steps?: GeminiInteractionStep[];
  usage?: unknown;
};

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as { status?: unknown; statusCode?: unknown };
  const candidate = value.status ?? value.statusCode;
  return typeof candidate === "number" ? candidate : undefined;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && /timed out|abort/i.test(error.message);
}

function isModelNotAvailable(error: unknown): boolean {
  return (
    statusFromError(error) === 404 &&
    error instanceof Error &&
    /model(?:s)?(?:\/|\s).*(?:not found|not available|no longer available)/i.test(
      error.message,
    )
  );
}

function interactionOutputText(response: GeminiInteractionLike): string {
  return (
    (response.steps ?? [])
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .filter((content) => content.type === "text")
      .map((content) => content.text?.trim() ?? "")
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

function comparableUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function searchSuggestionUrls(value: string): string[] {
  return (value.match(/https:\/\/[^\s"'<>]+/g) ?? []).map((url) =>
    url.replace(/&amp;/g, "&").replace(/[),.;]+$/, ""),
  );
}

@Injectable()
export class GeminiGatekeeperProvider {
  constructor(private readonly config: ConfigService) {}

  async execute<T>(args: {
    acquisitionRunId: string;
    modelId: string;
    ownedUrl: string;
    instruction: string;
    outputSchema: ZodType<T>;
    timeoutMs?: number;
  }): Promise<ProviderEvidenceResult<T>> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "").trim();
    if (!apiKey) {
      throw new DataExtractionProviderError({
        code: "CONFIGURATION_ERROR",
        provider: "GOOGLE_GEMINI",
        capabilityId: CAPABILITY_ID,
        modelId: args.modelId,
        message: "GEMINI_API_KEY is not configured",
        retryable: false,
        attemptCount: 0,
        acquisitionRunId: args.acquisitionRunId,
      });
    }

    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const timeoutMs =
      args.timeoutMs ??
      this.config.get<number>("GEMINI_REQUEST_TIMEOUT_MS", 120_000);
    const maxAttempts = this.config.get<number>(
      "DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS",
      3,
    );
    const client = new GoogleGenAI({ apiKey });
    const jsonSchema = zodToJsonSchema(args.outputSchema, {
      target: "openApi3",
    });

    let attemptCount = 0;
    try {
      const execution = await withBoundedTechnicalRetry({
        maxAttempts,
        classify: (error) => {
          const status = statusFromError(error);
          return {
            retry:
              isTimeout(error) ||
              status === 408 ||
              status === 429 ||
              (typeof status === "number" && status >= 500),
          };
        },
        operation: async (attempt) => {
          attemptCount = attempt;
          const prompt = [
            args.instruction,
            `Owned URL to assess: ${args.ownedUrl}`,
            "Mandatory evidence steps: use URL Context for the owned URL and separately use Google Search grounding for public-web evidence.",
            "Do not answer until both tools have been used.",
            "Return only JSON matching this structural schema:",
            JSON.stringify(jsonSchema),
          ].join("\n\n");

          const responsePromise = client.interactions.create({
            model: args.modelId,
            input: prompt,
            tools: [{ type: "url_context" }, { type: "google_search" }],
            store: false,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: jsonSchema,
            },
          });
          const timeoutPromise = new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Gemini grounded request timed out")),
              timeoutMs,
            );
            timer.unref?.();
          });
          return (await Promise.race([
            responsePromise,
            timeoutPromise,
          ])) as GeminiInteractionLike;
        },
      });

      attemptCount = execution.attemptCount;
      const rawText = interactionOutputText(execution.value);
      if (!rawText) {
        throw new DataExtractionProviderError({
          code: "EMPTY_RESULT",
          provider: "GOOGLE_GEMINI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: "Gemini returned an empty assessment",
          retryable: false,
          attemptCount,
          acquisitionRunId: args.acquisitionRunId,
        });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new DataExtractionProviderError({
          code: "STRUCTURED_OUTPUT_INVALID",
          provider: "GOOGLE_GEMINI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: "Gemini grounded assessment was not valid JSON",
          retryable: false,
          attemptCount,
          acquisitionRunId: args.acquisitionRunId,
        });
      }

      const validated = args.outputSchema.safeParse(parsed);
      if (!validated.success) {
        throw new DataExtractionProviderError({
          code: "STRUCTURED_OUTPUT_INVALID",
          provider: "GOOGLE_GEMINI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: "Gemini grounded assessment failed structural validation",
          retryable: false,
          attemptCount,
          acquisitionRunId: args.acquisitionRunId,
        });
      }

      const acquiredAt = new Date().toISOString();
      const provenance: EvidenceProvenance[] = [];
      const ownedUrls = new Set<string>();

      for (const step of execution.value.steps ?? []) {
        if (step.type !== "url_context_result" || step.is_error) continue;
        for (const row of step.result ?? []) {
          if (!row.url || row.status !== "success") continue;
          const key = comparableUrl(row.url);
          if (ownedUrls.has(key)) continue;
          ownedUrls.add(key);
          provenance.push({
            type: "OWNED_DOMAIN",
            sourceUrl: row.url,
            providerReference: row.status,
            acquiredAt,
          });
        }
      }

      const searchCompleted = (execution.value.steps ?? []).some(
        (step) => step.type === "google_search_result" && !step.is_error,
      );
      const searchUrls = new Set<string>();
      if (searchCompleted) {
        const citedSources = (execution.value.steps ?? [])
          .filter((step) => step.type === "model_output")
          .flatMap((step) => step.content ?? [])
          .flatMap((content) => content.annotations ?? [])
          .filter(
            (annotation) =>
              annotation.type === "url_citation" && Boolean(annotation.url),
          )
          .map((annotation) => ({
            url: annotation.url as string,
            title: annotation.title,
          }));
        const suggestionSources = (execution.value.steps ?? [])
          .filter((step) => step.type === "google_search_result")
          .flatMap((step) => step.result ?? [])
          .flatMap((result) =>
            result.search_suggestions
              ? searchSuggestionUrls(result.search_suggestions)
              : [],
          )
          .map((url) => ({ url, title: undefined }));

        for (const source of [...citedSources, ...suggestionSources]) {
          const key = comparableUrl(source.url);
          if (ownedUrls.has(key) || searchUrls.has(key)) continue;
          searchUrls.add(key);
          provenance.push({
            type: "PUBLIC_WEB_SEARCH",
            sourceUrl: source.url,
            title: source.title,
            acquiredAt,
          });
        }
      }

      const hasOwned = provenance.some((item) => item.type === "OWNED_DOMAIN");
      const hasSearch = provenance.some(
        (item) => item.type === "PUBLIC_WEB_SEARCH",
      );
      const qualityFlags = [
        ...(hasOwned ? [] : ["OWNED_DOMAIN_CONTEXT_MISSING"]),
        ...(hasSearch ? [] : ["PUBLIC_WEB_GROUNDING_MISSING"]),
      ];
      const complete = hasOwned && hasSearch;
      const completed = Date.now();

      return {
        capabilityId: CAPABILITY_ID,
        acquisitionRunId: args.acquisitionRunId,
        availability: complete ? "AVAILABLE" : "PARTIALLY_AVAILABLE",
        quality: complete ? "VALID" : "DEGRADED",
        qualityFlags,
        payload: validated.data,
        provenance,
        connectionState: complete ? "CONNECTED" : "DEGRADED",
        telemetry: {
          acquisitionRunId: args.acquisitionRunId,
          capabilityId: CAPABILITY_ID,
          provider: "GOOGLE_GEMINI",
          modelId: args.modelId,
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
      const status = statusFromError(error);
      const code = isTimeout(error)
        ? "REQUEST_TIMEOUT"
        : status === 401 || status === 403
          ? "AUTHENTICATION_FAILED"
          : isModelNotAvailable(error)
            ? "MODEL_NOT_AVAILABLE"
            : status === 429
              ? "RATE_LIMITED"
              : status && status >= 500
                ? "PROVIDER_UNAVAILABLE"
                : "PROVIDER_ERROR";
      throw new DataExtractionProviderError({
        code,
        provider: "GOOGLE_GEMINI",
        capabilityId: CAPABILITY_ID,
        modelId: args.modelId,
        message: `Gemini capability execution failed (${code})`,
        retryable: false,
        attemptCount,
        providerStatusCode: status,
        acquisitionRunId: args.acquisitionRunId,
      });
    }
  }
}
