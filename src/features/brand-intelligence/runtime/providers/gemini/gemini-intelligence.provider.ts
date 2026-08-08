import { GoogleGenAI } from "@google/genai";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AiProviderPort } from "../../integration/types";
import type { ResolvedModelRuntime } from "../../models/model-registry.resolver";
import type { PromptPackage } from "../../prompt-builder/prompt-builder";

function stringifyPromptPart(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

@Injectable()
export class GeminiIntelligenceProvider implements AiProviderPort {
  constructor(private readonly config: ConfigService) {}

  async execute(args: {
    promptPackage: PromptPackage;
    resolvedModelRuntime: ResolvedModelRuntime;
    websiteUrl: string;
  }): Promise<{ output: unknown; metadata?: Record<string, unknown> }> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY", "")?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const modelId = args.resolvedModelRuntime.model_id;
    const temperature =
      Number(args.resolvedModelRuntime.runtime.temperature) || 0;
    const timeoutMs =
      Number(args.resolvedModelRuntime.runtime.timeout_ms) || 30_000;
    const maxAttempts =
      Number(args.resolvedModelRuntime.runtime.max_attempts) || 2;
    const accessMode = args.resolvedModelRuntime.access_mode;

    const systemInstruction = args.promptPackage.system_instructions
      .map(stringifyPromptPart)
      .join("\n\n");

    const taskText = args.promptPackage.task_payload
      .map(
        (part) =>
          `## ${part.section}\n${stringifyPromptPart(part.content)}`,
      )
      .join("\n\n");

    const schemaHint = stringifyPromptPart(
      args.promptPackage.structured_output_schema,
    );

    const userText = [
      accessMode === "website_direct"
        ? `WEBSITE_URL (inspect this site directly): ${args.websiteUrl}`
        : `WEBSITE_URL: ${args.websiteUrl}`,
      "Return ONLY valid JSON matching the active output contract. Do not wrap in markdown.",
      "ACTIVE_OUTPUT_SCHEMA:",
      schemaHint,
      taskText,
    ].join("\n\n");

    const ai = new GoogleGenAI({ apiKey });
    let lastError: unknown;
    const started = Date.now();

    // Gemini rejects responseMimeType: application/json when any tools
    // (including urlContext) are enabled. Keep JSON mime for text-only calls;
    // for website_direct, ask for JSON in the prompt and parse the text.
    const useUrlContext = accessMode === "website_direct";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: modelId,
            contents: userText,
            config: {
              systemInstruction,
              temperature,
              ...(useUrlContext
                ? { tools: [{ urlContext: {} }] }
                : { responseMimeType: "application/json" }),
            },
          }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Gemini request timed out")),
              timeoutMs,
            ),
          ),
        ]);

        const text =
          typeof response.text === "string"
            ? response.text
            : extractText(response);
        if (!text?.trim()) {
          throw new Error("Gemini returned empty response");
        }

        let parsed: unknown;
        try {
          parsed = parseJsonFromModelText(text);
        } catch {
          const preview = text.replace(/\s+/g, " ").trim().slice(0, 280);
          throw new Error(
            `Gemini returned invalid JSON (urlContext responses are often wrapped in prose). Preview: ${preview}`,
          );
        }

        const usage = extractUsage(response);
        return {
          output: parsed,
          metadata: {
            provider_latency_ms: Date.now() - started,
            attempt_count: attempt,
            model_id: modelId,
            access_mode: accessMode,
            usage,
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
          },
        };
      } catch (error) {
        lastError = error;
        const retryable = isRetryable(error);
        if (!retryable || attempt >= maxAttempts) break;
        await delay(Math.min(500 * 2 ** (attempt - 1), 4000));
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini provider execution failed");
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

/**
 * Gemini + urlContext often returns markdown fences or prose around JSON.
 * Accept pure JSON, fenced JSON, or the first balanced {...}/{...} object/array.
 */
function parseJsonFromModelText(text: string): unknown {
  const candidates = [stripCodeFence(text), text.trim()];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next strategy
    }
  }

  const extracted = extractFirstJsonValue(text);
  if (extracted) {
    return JSON.parse(extracted);
  }

  throw new Error("No JSON object/array found in model text");
}

function extractFirstJsonValue(text: string): string | null {
  const startObject = text.indexOf("{");
  const startArray = text.indexOf("[");
  let start = -1;
  let openChar: "{" | "[" | null = null;

  if (startObject >= 0 && (startArray < 0 || startObject < startArray)) {
    start = startObject;
    openChar = "{";
  } else if (startArray >= 0) {
    start = startArray;
    openChar = "[";
  }
  if (start < 0 || !openChar) return null;

  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractText(response: unknown): string {
  const r = response as {
    text?: string;
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  if (typeof r.text === "string") return r.text;
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

function extractUsage(response: unknown): {
  input_tokens?: number;
  output_tokens?: number;
} {
  const usage = (
    response as {
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    }
  ).usageMetadata;
  return {
    input_tokens: usage?.promptTokenCount,
    output_tokens: usage?.candidatesTokenCount,
  };
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    message.includes("timed out") ||
    message.includes("rate") ||
    message.includes("invalid json") ||
    message.includes("empty response")
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
