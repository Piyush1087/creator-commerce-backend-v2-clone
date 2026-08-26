import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  StructuredEvidenceExecutionError,
  type StructuredEvidenceExecutionService,
} from "../../../data-extraction/services/structured-evidence-execution.service";
import {
  BrandCharacterProviderError,
  StructuredBrandCharacterModelProvider,
} from "./brand-character-model.provider";

const request = {
  processorExecutionId: "processor-execution-1",
  instruction: "processor-owned instruction",
  approvedContext: { evidence: "bounded" },
  evidenceRefs: ["evidence:1"],
  outputSchema: z.object({ ok: z.boolean() }).strict(),
};

function config(): ConfigService {
  return {
    get: vi.fn((key: string, fallback: unknown) => fallback),
  } as unknown as ConfigService;
}

describe("StructuredBrandCharacterModelProvider", () => {
  it("uses deterministic bounded production dispatch", async () => {
    const execute = vi.fn(async () => ({
      payload: { ok: true },
      telemetry: { attemptCount: 1 },
    }));
    const provider = new StructuredBrandCharacterModelProvider(
      { execute } as unknown as StructuredEvidenceExecutionService,
      config(),
    );
    await expect(provider.generate(request)).resolves.toEqual({
      output: { ok: true },
      providerAttemptCount: 1,
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        providerAdapter: "gemini",
        modelId: "gemini-2.5-flash",
        timeoutMs: 60_000,
        maxAttempts: 1,
        temperature: 0,
      }),
    );
  });

  it.each([
    ["REQUEST_TIMEOUT", true],
    ["RATE_LIMITED", true],
    ["STRUCTURED_OUTPUT_INVALID", false],
    ["CONFIGURATION_ERROR", false],
  ] as const)(
    "maps %s without hiding retry ownership",
    async (code, retryable) => {
      const provider = new StructuredBrandCharacterModelProvider(
        {
          execute: vi.fn(async () => {
            throw new StructuredEvidenceExecutionError(code, 1);
          }),
        } as unknown as StructuredEvidenceExecutionService,
        config(),
      );
      await expect(provider.generate(request)).rejects.toEqual(
        expect.objectContaining<Partial<BrandCharacterProviderError>>({
          code,
          retryable,
        }),
      );
    },
  );
});
