/* Gemini provider adapter — MVP runtime boundary.
 * Provider SDK wiring is intentionally isolated here.
 */

import { validateProcessorOutput, type ValidationRequest, type ValidationResult } from "../../validation/validator";

export type GeminiResolvedRuntime = {
  provider: "google_gemini";
  model_id: string;
  temperature: number;
  timeout_ms: number;
  max_attempts: number;
  access_mode: "normalized_evidence" | "website_direct";
};

export type ProviderNeutralPromptPackage = {
  prompt_build_id: string;
  system_instructions: unknown[];
  task_payload: Array<{ section: string; content: unknown }>;
  structured_output_schema: unknown;
  metadata: Record<string, unknown>;
};

export type GeminiExecutionRequest = {
  prompt: ProviderNeutralPromptPackage;
  runtime: GeminiResolvedRuntime;
  validation: Omit<ValidationRequest, "raw_output">;
  website_url?: string;
};

export type GeminiUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

export type GeminiProviderResult =
  | {
      ok: true;
      validated_output: unknown;
      validation: ValidationResult;
      usage: GeminiUsage;
      provider_latency_ms: number;
      attempt_count: number;
      model_id: string;
    }
  | {
      ok: false;
      code: string;
      stage: "PROVIDER" | "PARSE" | "VALIDATION";
      retryable: boolean;
      message: string;
      validation?: ValidationResult;
      provider_latency_ms: number;
      attempt_count: number;
      model_id: string;
    };

export interface GeminiClientPort {
  generateStructured(input: {
    model: string;
    systemInstructions: unknown[];
    taskPayload: unknown;
    responseSchema: unknown;
    temperature: number;
    timeoutMs: number;
    websiteUrl?: string;
    accessMode: "normalized_evidence" | "website_direct";
  }): Promise<{
    parsed?: unknown;
    text?: string;
    usage?: GeminiUsage;
  }>;
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  return status === 408 || status === 429 || (typeof status === "number" && status >= 500);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeGeminiProcessor(
  client: GeminiClientPort,
  request: GeminiExecutionRequest
): Promise<GeminiProviderResult> {
  const started = Date.now();
  let attempt = 0;
  let lastError: unknown;

  while (attempt < request.runtime.max_attempts) {
    attempt += 1;
    try {
      if (request.runtime.access_mode === "website_direct" && !request.website_url) {
        return {
          ok: false,
          code: "GEMINI_WEBSITE_URL_REQUIRED",
          stage: "PROVIDER",
          retryable: false,
          message: "website_direct execution requires website_url",
          provider_latency_ms: Date.now() - started,
          attempt_count: attempt,
          model_id: request.runtime.model_id,
        };
      }

      const response = await client.generateStructured({
        model: request.runtime.model_id,
        systemInstructions: request.prompt.system_instructions,
        taskPayload: request.prompt.task_payload,
        responseSchema: request.prompt.structured_output_schema,
        temperature: request.runtime.temperature,
        timeoutMs: request.runtime.timeout_ms,
        websiteUrl: request.website_url,
        accessMode: request.runtime.access_mode,
      });

      let rawOutput = response.parsed;
      if (rawOutput === undefined && response.text) {
        try {
          rawOutput = JSON.parse(response.text);
        } catch {
          return {
            ok: false,
            code: "GEMINI_RESPONSE_PARSE_FAILED",
            stage: "PARSE",
            retryable: false,
            message: "Gemini returned a response that could not be parsed as structured JSON",
            provider_latency_ms: Date.now() - started,
            attempt_count: attempt,
            model_id: request.runtime.model_id,
          };
        }
      }

      const validation = validateProcessorOutput({
        ...request.validation,
        raw_output: rawOutput,
      });

      if (!validation.ok) {
        return {
          ok: false,
          code: "OUTPUT_VALIDATION_FAILED",
          stage: "VALIDATION",
          retryable: false,
          message: "Gemini response failed authoritative runtime validation",
          validation,
          provider_latency_ms: Date.now() - started,
          attempt_count: attempt,
          model_id: request.runtime.model_id,
        };
      }

      return {
        ok: true,
        validated_output: validation.data,
        validation,
        usage: response.usage ?? {},
        provider_latency_ms: Date.now() - started,
        attempt_count: attempt,
        model_id: request.runtime.model_id,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt >= request.runtime.max_attempts) break;
      await delay(Math.min(500 * 2 ** (attempt - 1), 4000));
    }
  }

  return {
    ok: false,
    code: "GEMINI_PROVIDER_FAILED",
    stage: "PROVIDER",
    retryable: isRetryable(lastError),
    message: lastError instanceof Error ? lastError.message : "Gemini provider execution failed",
    provider_latency_ms: Date.now() - started,
    attempt_count: attempt,
    model_id: request.runtime.model_id,
  };
}
