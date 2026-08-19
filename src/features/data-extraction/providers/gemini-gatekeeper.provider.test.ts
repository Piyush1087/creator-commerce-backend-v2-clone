import type { ConfigService } from "@nestjs/config";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    readonly models = { generateContent };
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
    modelId: "gemini-2.5-flash",
    ownedUrl: "https://example.com",
    instruction: "Return a harmless test result.",
    outputSchema,
    ...overrides,
  });
}

function response(args: { owned?: boolean; search?: boolean } = {}) {
  return {
    text: JSON.stringify({ ok: true }),
    candidates: [
      {
        urlContextMetadata: args.owned
          ? {
              urlMetadata: [
                {
                  retrievedUrl: "https://example.com",
                  urlRetrievalStatus: "URL_RETRIEVAL_STATUS_SUCCESS",
                },
              ],
            }
          : undefined,
        groundingMetadata: args.search
          ? {
              groundingChunks: [
                {
                  web: {
                    uri: "https://example.org/source",
                    title: "Public source",
                  },
                },
              ],
            }
          : undefined,
      },
    ],
  };
}

describe("GeminiGatekeeperProvider", () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it("returns CONFIGURATION_ERROR without attempting a request when the credential is missing", async () => {
    const provider = new GeminiGatekeeperProvider(config());

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "CONFIGURATION_ERROR", attemptCount: 0 },
    });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("normalizes malformed JSON as STRUCTURED_OUTPUT_INVALID without retrying", async () => {
    generateContent.mockResolvedValue({ text: "{not-json" });
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "STRUCTURED_OUTPUT_INVALID", attemptCount: 1 },
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("normalizes schema failure as STRUCTURED_OUTPUT_INVALID without retrying", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ ok: "yes" }) });
    const provider = new GeminiGatekeeperProvider(
      config({ GEMINI_API_KEY: "test-key" }),
    );

    await expect(execute(provider)).rejects.toMatchObject({
      detail: { code: "STRUCTURED_OUTPUT_INVALID", attemptCount: 1 },
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
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
      generateContent.mockResolvedValue(response({ owned, search }));
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
    generateContent.mockRejectedValue(new Error("Gemini request timed out"));
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
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
