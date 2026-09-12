import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import type { StructuredEvidenceExecutionService } from "../../data-extraction/services/structured-evidence-execution.service";
import { StructuredInstagramC3SemanticModelAdapter } from "./instagram-c3-semantic-model";

const valid = {
  themes: [],
  captionPatterns: [],
  creativeStructures: [],
  visualExecutions: [],
  creatorRoleSignals: [],
  creatorPresence: { state: "UNKNOWN" as const, supportModalities: [] },
  offeringPresence: { state: "UNKNOWN" as const, supportModalities: [] },
  offeringName: null,
  collaborationCues: [],
};

const request = {
  executionIdentity: "execution-1",
  evidenceRefs: ["evidence-1"],
  context: {
    media: { id: "media-1", type: "IMAGE" },
    caption: {
      state: "AVAILABLE",
      text: "quoted source",
      hashtags: [],
      mentions: [],
    },
    visual: { state: "UNKNOWN" },
    inspection: { depth: "LIGHT_ONLY" },
    offerings: [],
  },
};

describe("Instagram C3 provider-neutral model adapter", () => {
  it("fails closed without configured provider/model and makes no call", async () => {
    const execute = vi.fn();
    const config = { get: vi.fn(() => undefined) };
    const adapter = new StructuredInstagramC3SemanticModelAdapter(
      { execute } as unknown as StructuredEvidenceExecutionService,
      config as unknown as ConfigService,
    );
    await expect(adapter.analyze(request)).rejects.toMatchObject({
      code: "MODEL_PROVIDER_NOT_CONFIGURED",
      attemptCount: 0,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("dispatches one strict temperature-zero attempt without provider-specific domain types", async () => {
    const execute = vi.fn().mockResolvedValue({
      payload: valid,
      telemetry: { attemptCount: 1 },
    });
    const values: Record<string, unknown> = {
      INSTAGRAM_C3_MODEL_PROVIDER: "openai",
      INSTAGRAM_C3_MODEL_ID: "fixture-config-model",
      INSTAGRAM_C3_MODEL_TIMEOUT_MS: 3210,
    };
    const config = {
      get: vi.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    };
    const adapter = new StructuredInstagramC3SemanticModelAdapter(
      { execute } as unknown as StructuredEvidenceExecutionService,
      config as unknown as ConfigService,
    );
    await expect(adapter.analyze(request)).resolves.toEqual(valid);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAdapter: "openai",
        modelId: "fixture-config-model",
        temperature: 0,
        maxAttempts: 1,
        timeoutMs: 3210,
      }),
    );
    const dispatched = execute.mock.calls[0]?.[0];
    expect(dispatched.approvedEvidenceContext).not.toHaveProperty("metrics");
    expect(dispatched.approvedEvidenceContext).not.toHaveProperty(
      "credentials",
    );
  });
});
