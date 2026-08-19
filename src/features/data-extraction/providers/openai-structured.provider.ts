import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  DataExtractionProviderError,
  type ProviderEvidenceResult,
} from "../contracts/provider-execution.contract";
import { withBoundedTechnicalRetry } from "../utils/provider-retry.util";

const CAPABILITY_ID = "openai_structured_assessment";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type OpenAIResponsePayload = {
  id?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  usage?: unknown;
};

class OpenAIHttpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "OpenAIHttpError";
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

function extractOutputText(response: OpenAIResponsePayload): string {
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) {
        return content.text;
      }
    }
  }
  return "";
}

@Injectable()
export class OpenAIStructuredProvider {
  constructor(private readonly config: ConfigService) {}

  async execute<T>(args: {
    acquisitionRunId: string;
    modelId: string;
    instruction: string;
    approvedEvidenceContext: unknown;
    evidenceRefs: string[];
    outputSchema: ZodType<T>;
    timeoutMs?: number;
  }): Promise<ProviderEvidenceResult<T>> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY", "").trim();
    if (!apiKey) {
      throw new DataExtractionProviderError({
        code: "CONFIGURATION_ERROR",
        provider: "OPENAI",
        capabilityId: CAPABILITY_ID,
        modelId: args.modelId,
        message: "OPENAI_API_KEY is not configured",
        retryable: false,
        attemptCount: 0,
        acquisitionRunId: args.acquisitionRunId,
      });
    }
    if (!args.modelId.trim()) {
      throw new DataExtractionProviderError({
        code: "MODEL_NOT_AVAILABLE",
        provider: "OPENAI",
        capabilityId: CAPABILITY_ID,
        message: "Intelligence must supply an OpenAI model id",
        retryable: false,
        attemptCount: 0,
        acquisitionRunId: args.acquisitionRunId,
      });
    }

    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const timeoutMs =
      args.timeoutMs ??
      this.config.get<number>("OPENAI_REQUEST_TIMEOUT_MS", 120_000);
    const maxAttempts = this.config.get<number>(
      "DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS",
      3,
    );
    const schema = zodToJsonSchema(args.outputSchema, {
      target: "openApi3",
      $refStrategy: "none",
    });
    let attemptCount = 0;

    try {
      const execution = await withBoundedTechnicalRetry({
        maxAttempts,
        classify: (error) => {
          if (!(error instanceof OpenAIHttpError)) return { retry: false };
          return {
            retry:
              error.status === 408 ||
              error.status === 429 ||
              (typeof error.status === "number" && error.status >= 500) ||
              /timed out|connection/i.test(error.message),
            retryAfterMs: error.retryAfterMs,
          };
        },
        operation: async (attempt) => {
          attemptCount = attempt;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const response = await fetch(OPENAI_RESPONSES_URL, {
              method: "POST",
              headers: {
                authorization: `Bearer ${apiKey}`,
                "content-type": "application/json",
                "x-client-request-id": args.acquisitionRunId,
              },
              body: JSON.stringify({
                model: args.modelId,
                store: false,
                instructions: args.instruction,
                input: JSON.stringify({
                  evidence_refs: args.evidenceRefs,
                  approved_evidence_context: args.approvedEvidenceContext,
                }),
                text: {
                  format: {
                    type: "json_schema",
                    name: "gatekeeper_assessment",
                    strict: true,
                    schema,
                  },
                },
              }),
              signal: controller.signal,
            });
            const text = await response.text();
            if (!response.ok) {
              throw new OpenAIHttpError(
                `OpenAI Responses API failed (${response.status})`,
                response.status,
                parseRetryAfter(response.headers.get("retry-after")),
              );
            }
            try {
              return JSON.parse(text) as OpenAIResponsePayload;
            } catch {
              throw new OpenAIHttpError("OpenAI returned invalid JSON");
            }
          } catch (error) {
            if (error instanceof OpenAIHttpError) throw error;
            if (error instanceof Error && error.name === "AbortError") {
              throw new OpenAIHttpError("OpenAI request timed out");
            }
            throw new OpenAIHttpError("OpenAI connection failed");
          } finally {
            clearTimeout(timer);
          }
        },
      });

      attemptCount = execution.attemptCount;
      const rawText = extractOutputText(execution.value).trim();
      if (!rawText) {
        throw new DataExtractionProviderError({
          code: "EMPTY_RESULT",
          provider: "OPENAI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: "OpenAI returned no structured assessment text",
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
          provider: "OPENAI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: "OpenAI structured assessment was not valid JSON",
          retryable: false,
          attemptCount,
          acquisitionRunId: args.acquisitionRunId,
        });
      }
      const validated = args.outputSchema.safeParse(parsed);
      if (!validated.success) {
        throw new DataExtractionProviderError({
          code: "STRUCTURED_OUTPUT_INVALID",
          provider: "OPENAI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: "OpenAI structured assessment failed structural validation",
          retryable: false,
          attemptCount,
          acquisitionRunId: args.acquisitionRunId,
        });
      }

      const completed = Date.now();
      return {
        capabilityId: CAPABILITY_ID,
        acquisitionRunId: args.acquisitionRunId,
        availability: "AVAILABLE",
        quality: "VALID",
        qualityFlags: [],
        payload: validated.data,
        provenance: args.evidenceRefs.map((ref) => ({
          type: "APPROVED_EVIDENCE_CONTEXT" as const,
          providerReference: ref,
          acquiredAt: startedAt,
        })),
        connectionState: "CONNECTED",
        telemetry: {
          acquisitionRunId: args.acquisitionRunId,
          capabilityId: CAPABILITY_ID,
          provider: "OPENAI",
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
      if (error instanceof OpenAIHttpError) {
        const code = !error.status
          ? /timed out/i.test(error.message)
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
          provider: "OPENAI",
          capabilityId: CAPABILITY_ID,
          modelId: args.modelId,
          message: `OpenAI structured assessment failed (${code})`,
          retryable: false,
          attemptCount,
          providerStatusCode: error.status,
          retryAfterMs: error.retryAfterMs,
          acquisitionRunId: args.acquisitionRunId,
        });
      }
      throw new DataExtractionProviderError({
        code: "PROVIDER_ERROR",
        provider: "OPENAI",
        capabilityId: CAPABILITY_ID,
        modelId: args.modelId,
        message: "OpenAI structured assessment failed",
        retryable: false,
        attemptCount,
        acquisitionRunId: args.acquisitionRunId,
      });
    }
  }
}
