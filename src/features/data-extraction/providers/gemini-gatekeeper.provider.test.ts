import type { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createInteraction } = vi.hoisted(() => ({
  createInteraction: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    readonly interactions = { create: createInteraction };
  },
}));

import { GeminiGatekeeperProvider } from "./gemini-gatekeeper.provider";

const outputSchema = z.object({ ok: z.boolean() });

function config(values: Record<string, unknown> = {}): ConfigService {
  return {
    get: vi.fn((key: string, defaultValue: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  } as unknown as ConfigService;
}

function execute(
  provider: GeminiGatekeeperProvider,
  overrides: Partial<Parameters<GeminiGatekeeperProvider["execute"]>[0]> = {},
) {
  return provider.execute({
    acquisitionRunId: "gemini-test-run",
    modelId: "gemini-3.6-flash",
    ownedUrl: "https://example.com",
    instruction: "Return a harmless test result.",
    outputSchema,
    ...overrides,
  });
}

function response(
  args: { owned?: boolean; search?: boolean; text?: string } = {},
) {
  return {
    steps: [
      ...(args.owned
        ? [
            {
              type: "url_context_result",
              result: [{ url: "https://example.com", status: "success" }],
            },
          ]
        : []),
      ...(args.search
        ? [
            {
              type: "google_search_result",
              result: [
                {
                  search_suggestions:
                    '<a href="https://www.google.com/search?q=public+source">Search source</a>',
                },
              ],
            },
          ]
        : []),
      {
        type: "model_output",
        content: [
          {
            type: "text",
            text: args.text ?? JSON.stringify({ ok: true }),
            annotations: [],
          },
        ],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

describe("GeminiGatekeeperProvider", () => {
  beforeEach(() => {
    createInteraction.mockReset();
  });

  it("returns CONFIGURATION_ERROR without attempting a request when the credential is missing", async () => {
    const provider = new GeminiGatekeeperProvider(config());

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "CONFIGURATION_ERROR", attemptCount: 0 },
    });
    expect(createInteraction).not.toHaveBeenCalled();
  });

  it("normalizes malformed JSON as STRUCTURED_OUTPUT_INVALID without retrying", async () => {
    createInteraction.mockResolvedValue(response({ text: "{not-json" }));
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "STRUCTURED_OUTPUT_INVALID", attemptCount: 1 },
    });
    expect(createInteraction).toHaveBeenCalledTimes(1);
  });

  it("normalizes schema failure as STRUCTURED_OUTPUT_INVALID without retrying", async () => {
    createInteraction.mockResolvedValue(
      response({ text: JSON.stringify({ ok: "yes" }) }),
    );
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "STRUCTURED_OUTPUT_INVALID", attemptCount: 1 },
    });
    expect(createInteraction).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "neither provenance class",
      owned: false,
      search: false,
      flags: ["OWNED_DOMAIN_CONTEXT_MISSING", "PUBLIC_WEB_GROUNDING_MISSING"],
      provenanceCount: 0,
      availability: "PARTIALLY_AVAILABLE",
      quality: "DEGRADED",
    },
    {
      name: "only URL Context provenance",
      owned: true,
      search: false,
      flags: ["PUBLIC_WEB_GROUNDING_MISSING"],
      provenanceCount: 1,
      availability: "PARTIALLY_AVAILABLE",
      quality: "DEGRADED",
    },
    {
      name: "only Search grounding provenance",
      owned: false,
      search: true,
      flags: ["OWNED_DOMAIN_CONTEXT_MISSING"],
      provenanceCount: 1,
      availability: "PARTIALLY_AVAILABLE",
      quality: "DEGRADED",
    },
    {
      name: "both provenance classes",
      owned: true,
      search: true,
      flags: [],
      provenanceCount: 2,
      availability: "AVAILABLE",
      quality: "VALID",
    },
  ])(
    "reports $name correctly",
    async ({
      owned,
      search,
      flags,
      provenanceCount,
      availability,
      quality,
    }) => {
      createInteraction.mockResolvedValue(response({ owned, search }));
      const provider = new GeminiGatekeeperProvider(
        config({ GEMINI_API_KEY: "test-key" }),
      );

      const result = await execute(provider);

      expect(result.qualityFlags).toEqual(flags);
      expect(result.provenance).toHaveLength(provenanceCount);
      expect(result.availability).toBe(availability);
      expect(result.quality).toBe(quality);
    },
  );

  it("normalizes timeout exhaustion as REQUEST_TIMEOUT within Gemini", async () => {
    createInteraction.mockRejectedValue(new Error("Gemini request timed out"));
    const provider = new GeminiGatekeeperProvider(
      config({
        GEMINI_API_KEY: "test-key",
        DATA_EXTRACTION_PROVIDER_MAX_ATTEMPTS: 2,
      }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "REQUEST_TIMEOUT",
        provider: "GOOGLE_GEMINI",
        attemptCount: 2,
      },
    });
    expect(createInteraction).toHaveBeenCalledTimes(2);
  });

  it("normalizes a confirmed model-unavailable 404 without retrying", async () => {
    const error = new Error(
      '{"error":{"code":404,"message":"This model models/unavailable-gatekeeper-model is no longer available.","status":"NOT_FOUND"}}',
    ) as Error & { status: number };
    error.status = 404;
    createInteraction.mockRejectedValue(error);
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "MODEL_NOT_AVAILABLE",
        providerStatusCode: 404,
        attemptCount: 1,
      },
    });
    expect(createInteraction).toHaveBeenCalledTimes(1);
  });

  it("keeps an unrelated 404 normalized as PROVIDER_ERROR", async () => {
    const error = new Error("The requested endpoint was not found") as Error & {
      status: number;
    };
    error.status = 404;
    createInteraction.mockRejectedValue(error);
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: {
        code: "PROVIDER_ERROR",
        providerStatusCode: 404,
        attemptCount: 1,
      },
    });
    expect(createInteraction).toHaveBeenCalledTimes(1);
  });

  it("uses the caller model with combined Interactions tools and JSON output", async () => {
    createInteraction.mockResolvedValue(
      response({ owned: true, search: true }),
    );
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await execute(provider);

    expect(createInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.6-flash",
        store: false,
        tools: [{ type: "url_context" }, { type: "google_search" }],
        response_format: expect.objectContaining({
          type: "text",
          mime_type: "application/json",
        }),
      }),
    );
  });
});
