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

type GeminiCandidate = {
  groundingMetadata?: {
    groundingChunks?: Array<{
      web?: { uri?: string; title?: string };
    }>;
  };
  urlContextMetadata?: {
    urlMetadata?: Array<{
      retrievedUrl?: string;
      urlRetrievalStatus?: string;
    }>;
  };
};

type GeminiResponseLike = {
  text?: string;
  candidates?: GeminiCandidate[];
  usageMetadata?: unknown;
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
            "Use both the URL Context tool and Google Search grounding.",
            "Return only JSON matching this structural schema:",
            JSON.stringify(jsonSchema),
          ].join("\n\n");

          const responsePromise = client.models.generateContent({
            model: args.modelId,
            contents: [prompt],
            config: {
              tools: [{ urlContext: {} }, { googleSearch: {} }],
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
          ])) as GeminiResponseLike;
        },
      });

      attemptCount = execution.attemptCount;
      const rawText = execution.value.text?.trim() ?? "";
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

      const candidate = execution.value.candidates?.[0];
      const acquiredAt = new Date().toISOString();
      const provenance: EvidenceProvenance[] = [];

      for (const row of candidate?.urlContextMetadata?.urlMetadata ?? []) {
        if (row.retrievedUrl) {
          provenance.push({
            type: "OWNED_DOMAIN",
            sourceUrl: row.retrievedUrl,
            providerReference: row.urlRetrievalStatus,
            acquiredAt,
          });
        }
      }

      for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
        if (chunk.web?.uri) {
          provenance.push({
            type: "PUBLIC_WEB_SEARCH",
            sourceUrl: chunk.web.uri,
            title: chunk.web.title,
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
          usage: execution.value.usageMetadata,
        },
      };
    } catch (error) {
      if (error instanceof DataExtractionProviderError) throw error;
      const status = statusFromError(error);
      const code = isTimeout(error)
        ? "REQUEST_TIMEOUT"
        : status === 401 || status === 403
          ? "AUTHENTICATION_FAILED"
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
