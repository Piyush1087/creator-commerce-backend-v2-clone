import { describe, expect, it, vi } from "vitest";

import type { StructuredEvidenceExecutionService } from "../../../data-extraction/services/structured-evidence-execution.service";
import type { BrandPreviewArtifactLoader } from "./brand-preview-artifact.loader";
import type { BrandPreviewPromptService } from "./brand-preview-prompt.service";
import { BrandPreviewSynthesisService } from "./brand-preview-synthesis.service";

const output = {
  brand_descriptor: null,
  brand_understanding_narrative:
    "Example builds practical tools that help working teams understand difficult decisions with clear, useful guidance. Its product explanations create a credible role for creators who can demonstrate workflows and make unfamiliar choices easier to evaluate.",
  internal_trace: {
    brand_descriptor: null,
    brand_understanding_narrative: {
      internal_grounding_refs: ["owned:https://example.com/"],
      internal_confidence: "HIGH",
    },
  },
  audience_groups: [
    {
      id: "teams",
      label: "Working teams",
      why_it_matters:
        "They need approachable guidance for an unfamiliar decision.",
      internal_grounding_refs: ["owned:https://example.com/"],
      internal_confidence: "HIGH",
    },
  ],
  creator_marketing_opportunities: [
    {
      title: "Explain unfamiliar choices",
      why_it_matters:
        "Creators can make detailed product information easier to understand.",
      internal_grounding_refs: ["owned:https://example.com/"],
      internal_confidence: "HIGH",
    },
  ],
  creator_archetype_recommendations: [
    {
      archetype_id: "EDUCATOR",
      rationale: "Explains unfamiliar choices with approachable clarity.",
      internal_grounding_refs: ["owned:https://example.com/"],
      internal_confidence: "HIGH",
    },
  ],
};

function providerResult() {
  return {
    payload: output,
    telemetry: { attemptCount: 1 },
  };
}

describe("BrandPreviewSynthesisService", () => {
  it("uses the frozen technical fallback only after primary exhaustion", async () => {
    const artifacts = {
      loadExecutionProfile: vi.fn().mockResolvedValue({
        id: "brand_preview_fast",
        version: "1.0-frozen",
        stages: [
          {
            id: "synthesize_preview",
            processor_id: "brand_preview_synthesis",
          },
        ],
      }),
      resolvePrimaryModel: vi.fn().mockResolvedValue({
        model_profile: "brand_preview_fast_reasoning",
        provider_adapter: "gemini",
        model_id: "registry-primary",
        runtime: { max_attempts: 2, timeout_ms: 25_000 },
      }),
      resolveFallbackModel: vi.fn().mockResolvedValue({
        model_profile: "brand_preview_fast_reasoning_fallback",
        provider_adapter: "openai",
        model_id: "registry-fallback",
        runtime: { max_attempts: 1, timeout_ms: 30_000 },
      }),
    };
    const prompts = {
      build: vi.fn().mockResolvedValue({
        instruction: "frozen prompt",
        evidenceRefs: ["owned:https://example.com/"],
        promptBuildId: "pb-1",
        artifactVersions: { brand_preview_synthesis: "1.0-frozen" },
      }),
    };
    const structured = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(providerResult()),
    };
    const service = new BrandPreviewSynthesisService(
      artifacts as unknown as BrandPreviewArtifactLoader,
      prompts as unknown as BrandPreviewPromptService,
      structured as unknown as StructuredEvidenceExecutionService,
    );

    const result = await service.synthesize({
      runId: "run-1",
      brandName: "Example",
      websiteUrl: "https://example.com/",
      confirmedIndustry: "SAAS_AI",
      evidence: {
        brandName: "Example",
        logoUrl: null,
        pages: [],
        evidenceRefs: ["owned:https://example.com/"],
        sufficientForPreviewSynthesisAttempt: true,
        coverage: {
          brandProposition: "PRESENT",
          customerUseContext: "PRESENT",
          commercialOfferingConversion: "PRESENT",
        },
        availability: "AVAILABLE",
        qualityState: "VALID",
        qualityFlags: [],
      },
    });

    expect(structured.execute).toHaveBeenCalledTimes(2);
    expect(structured.execute.mock.calls[0]?.[0].providerAdapter).toBe(
      "gemini",
    );
    expect(structured.execute.mock.calls[1]?.[0].providerAdapter).toBe(
      "openai",
    );
    expect(result.metadata.technical_fallback_used).toBe(true);
  });

  it("returns a technical failure when both registry paths exhaust", async () => {
    const artifacts = {
      loadExecutionProfile: vi.fn().mockResolvedValue({
        id: "brand_preview_fast",
        version: "1.0-frozen",
        stages: [
          {
            id: "synthesize_preview",
            processor_id: "brand_preview_synthesis",
          },
        ],
      }),
      resolvePrimaryModel: vi.fn().mockResolvedValue({
        model_profile: "primary",
        provider_adapter: "gemini",
        model_id: "primary-id",
        runtime: {},
      }),
      resolveFallbackModel: vi.fn().mockResolvedValue({
        model_profile: "fallback",
        provider_adapter: "openai",
        model_id: "fallback-id",
        runtime: {},
      }),
    };
    const prompts = {
      build: vi.fn().mockResolvedValue({
        instruction: "prompt",
        evidenceRefs: [],
        promptBuildId: "pb",
        artifactVersions: {},
      }),
    };
    const failed = { execute: vi.fn().mockRejectedValue(new Error("down")) };
    const service = new BrandPreviewSynthesisService(
      artifacts as unknown as BrandPreviewArtifactLoader,
      prompts as unknown as BrandPreviewPromptService,
      failed as unknown as StructuredEvidenceExecutionService,
    );
    await expect(
      service.synthesize({
        runId: "run",
        brandName: "Example",
        websiteUrl: "https://example.com",
        confirmedIndustry: "D2C",
        evidence: {
          brandName: "Example",
          logoUrl: null,
          pages: [],
          evidenceRefs: [],
          sufficientForPreviewSynthesisAttempt: true,
          coverage: {
            brandProposition: "PRESENT",
            customerUseContext: "PRESENT",
            commercialOfferingConversion: "PRESENT",
          },
          availability: "AVAILABLE",
          qualityState: "VALID",
          qualityFlags: [],
        },
      }),
    ).rejects.toThrow("SYNTHESIS_TECHNICAL_EXHAUSTED");
  });
});
