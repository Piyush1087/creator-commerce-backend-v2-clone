import { GoogleGenAI } from "@google/genai";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  DataExtractionProviderError,
  type ProviderEvidenceResult,
} from "../contracts/provider-execution.contract";
import { withBoundedTechnicalRetry } from "../utils/provider-retry.util";

function statusFromError(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate =
    (error as { status?: unknown; statusCode?: unknown }).status ??
    (error as { statusCode?: unknown }).statusCode;
  return typeof candidate === "number" ? candidate : undefined;
}

class StructuredOutputError extends Error {
  constructor() {
    super("Gemini returned structurally invalid output");
    this.name = "StructuredOutputError";
  }
}

@Injectable()
export class GeminiStructuredProvider {
  constructor(private readonly config: ConfigService) {}

  async execute<T>(args: {
    acquisitionRunId: string;
    capabilityId: string;
    modelId: string;
    instruction: string;
    approvedEvidenceContext: unknown;
    evidenceRefs: string[];
    outputSchema: ZodType<T>;
    timeoutMs: number;
    maxAttempts: number;
    temperature?: number;
  }): Promise<ProviderEvidenceResult<T>> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "").trim();
    if (!apiKey) {
      throw new DataExtractionProviderError({
        code: "CONFIGURATION_ERROR",
        provider: "GOOGLE_GEMINI",
        capabilityId: args.capabilityId,
        modelId: args.modelId,
        message: "GEMINI_API_KEY is not configured",
        retryable: false,
        attemptCount: 0,
        acquisitionRunId: args.acquisitionRunId,
      });
    }

    const started = Date.now();
    let attemptCount = 0;
    try {
      const client = new GoogleGenAI({ apiKey });
      const schema = zodToJsonSchema(args.outputSchema, {
        target: "openApi3",
        $refStrategy: "none",
      });
      const execution = await withBoundedTechnicalRetry({
        maxAttempts: args.maxAttempts,
        classify: (error) => {
          const status = statusFromError(error);
          return {
            retry:
              error instanceof StructuredOutputError ||
              (error instanceof Error &&
                /timeout|abort/i.test(error.message)) ||
              status === 408 ||
              status === 429 ||
              (typeof status === "number" && status >= 500),
          };
        },
        operation: async (attempt) => {
          attemptCount = attempt;
          const request = client.models.generateContent({
            model: args.modelId,
            contents: [
              args.instruction,
              "Use only this approved normalized evidence context:",
              JSON.stringify(args.approvedEvidenceContext),
              `Allowed grounding references: ${JSON.stringify(args.evidenceRefs)}`,
            ].join("\n\n"),
            config: {
              temperature: args.temperature ?? 0,
              responseMimeType: "application/json",
              responseJsonSchema: schema,
            },
          });
          const timeout = new Promise<never>((_, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Gemini structured request timed out")),
              args.timeoutMs,
            );
            timer.unref?.();
          });
          const response = await Promise.race([request, timeout]);
          let parsed: unknown;
          try {
            parsed = JSON.parse(response.text ?? "") as unknown;
          } catch {
            throw new StructuredOutputError();
          }
          const validated = args.outputSchema.safeParse(parsed);
          if (!validated.success) throw new StructuredOutputError();
          return { payload: validated.data, usage: response.usageMetadata };
        },
      });
      const completed = Date.now();
      return {
        capabilityId: args.capabilityId,
        acquisitionRunId: args.acquisitionRunId,
        availability: "AVAILABLE",
        quality: "VALID",
        qualityFlags: [],
        payload: execution.value.payload,
        provenance: args.evidenceRefs.map((providerReference) => ({
          type: "APPROVED_EVIDENCE_CONTEXT" as const,
          providerReference,
          acquiredAt: new Date(started).toISOString(),
        })),
        connectionState: "CONNECTED",
        telemetry: {
          acquisitionRunId: args.acquisitionRunId,
          capabilityId: args.capabilityId,
          provider: "GOOGLE_GEMINI",
          modelId: args.modelId,
          startedAt: new Date(started).toISOString(),
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
      throw new DataExtractionProviderError({
        code:
          error instanceof StructuredOutputError
            ? "STRUCTURED_OUTPUT_INVALID"
            : status === 429
              ? "RATE_LIMITED"
              : status && status >= 500
                ? "PROVIDER_UNAVAILABLE"
                : error instanceof Error && /timeout|abort/i.test(error.message)
                  ? "REQUEST_TIMEOUT"
                  : "PROVIDER_ERROR",
        provider: "GOOGLE_GEMINI",
        capabilityId: args.capabilityId,
        modelId: args.modelId,
        message: "Gemini structured execution failed",
        retryable: false,
        attemptCount,
        providerStatusCode: status,
        acquisitionRunId: args.acquisitionRunId,
      });
    }
  }
}
