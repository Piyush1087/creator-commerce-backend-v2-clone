import type { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenAIStructuredProvider } from "./openai-structured.provider";

const outputSchema = z.object({ verdict: z.string() });

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  } as unknown as ConfigService;
}

function execute(
  provider: OpenAIStructuredProvider,
  overrides: Partial<Parameters<OpenAIStructuredProvider["execute"]>[0]> = {},
) {
  return provider.execute({
    acquisitionRunId: "openai-test-run",
    modelId: "product-approved-test-model",
    instruction: "Use only approved evidence.",
    approvedEvidenceContext: { claim: "approved" },
    evidenceRefs: ["evidence-1", "evidence-2"],
    outputSchema,
    ...overrides,
  });
}

function successfulResponse(payload: unknown = { verdict: "valid" }) {
  return new Response(
    JSON.stringify({
      id: "response-1",
      output: [
        {
          content: [{ type: "output_text", text: JSON.stringify(payload) }],
        },
      ],
    }),
    { status: 200 },
  );
}

describe("OpenAIStructuredProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns CONFIGURATION_ERROR without a credential", async () => {
    const provider = new OpenAIStructuredProvider(config());

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "CONFIGURATION_ERROR", attemptCount: 0 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns MODEL_NOT_AVAILABLE without substituting a default model", async () => {
    const provider = new OpenAIStructuredProvider(
      config({ OPENAI_API_KEY: "test-key" }),
    );

    await expect(execute(provider, { modelId: "" })).rejects.toMatchObject({
      detail: { code: "MODEL_NOT_AVAILABLE", attemptCount: 0 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("constructs a store:false Responses API structured-output request and preserves approved evidence provenance", async () => {
    fetchMock.mockResolvedValue(successfulResponse());
    const provider = new OpenAIStructuredProvider(
      config({ OPENAI_API_KEY: "test-key" }),
    );

    const result = await execute(provider);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.openai.com/v1/responses",
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "product-approved-test-model",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "gatekeeper_assessment",
          strict: true,
        },
      },
    });
    expect(result.provenance).toEqual([
      expect.objectContaining({
        type: "APPROVED_EVIDENCE_CONTEXT",
        providerReference: "evidence-1",
      }),
      expect.objectContaining({
        type: "APPROVED_EVIDENCE_CONTEXT",
        providerReference: "evidence-2",
      }),
    ]);
  });

  it("normalizes malformed structured output as STRUCTURED_OUTPUT_INVALID without retrying", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            { content: [{ type: "output_text", text: "{malformed-json" }] },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new OpenAIStructuredProvider(
      config({ OPENAI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "STRUCTURED_OUTPUT_INVALID", attemptCount: 1 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("normalizes supplied-schema failure as STRUCTURED_OUTPUT_INVALID without retrying", async () => {
    fetchMock.mockResolvedValue(successfulResponse({ verdict: 12 }));
    const provider = new OpenAIStructuredProvider(
      config({ OPENAI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "STRUCTURED_OUTPUT_INVALID", attemptCount: 1 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses Retry-After and returns RATE_LIMITED after exhausted attempts", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0.002" },
        }),
      ),
    );
    const provider = new OpenAIStructuredProvider(
      config({
        OPENAI_API_KEY: "test-key",
        DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS: 2,
      }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "RATE_LIMITED",
        attemptCount: 2,
        providerStatusCode: 429,
        retryAfterMs: 2,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes timeout exhaustion as REQUEST_TIMEOUT within OpenAI", async () => {
    const abortError = new Error("request aborted");
    abortError.name = "AbortError";
    fetchMock.mockRejectedValue(abortError);
    const provider = new OpenAIStructuredProvider(
      config({
        OPENAI_API_KEY: "test-key",
        DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS: 2,
      }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "REQUEST_TIMEOUT",
        provider: "OPENAI",
        attemptCount: 2,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
