import type { ConfigService } from "@nestjs/config";
import { IndustryVertical } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProviderEvidenceResult } from "../../data-extraction/contracts/provider-execution.contract";
import type { CompanyPublicWebResearchPayload } from "../../data-extraction/providers/parallel-company-research.provider";
import type { GatekeeperCapabilityPort } from "./runtime/gatekeeper-capability.port";
import { GatekeeperArtifactLoader } from "./runtime/gatekeeper-artifact.loader";
import { GatekeeperPromptService } from "./runtime/gatekeeper-prompt.service";
import { GatekeeperRuntimeOrchestratorService } from "./runtime/gatekeeper-runtime-orchestrator.service";
import type { GatekeeperTelemetryService } from "./runtime/gatekeeper-telemetry.service";
import type { GatekeeperSiteAssessment } from "./gatekeeper-v1.types";

const base: GatekeeperSiteAssessment = {
  provisional_industry: IndustryVertical.D2C,
  provisional_sub_industry: "Evidence Grounded Specialty",
  entity_category: "BRAND",
  english_evidence_status: "SUFFICIENT",
  creator_marketing_applicability: "APPLICABLE",
  commercial_destination_types: ["WEBSITE"],
  assessment_confidence: "HIGH",
};

function telemetry(
  provider: "GOOGLE_GEMINI" | "PARALLEL_AI" | "OPENAI",
  capabilityId: string,
  modelId?: string,
) {
  return {
    acquisitionRunId: `${provider}-run`,
    capabilityId,
    provider,
    modelId,
    startedAt: "2026-08-20T00:00:00.000Z",
    completedAt: "2026-08-20T00:00:00.010Z",
    durationMs: 10,
    attemptCount: 1,
    rateLimited: false,
    usage: { input_tokens: 2, output_tokens: 3 },
  };
}

function assessmentResult(
  assessment: GatekeeperSiteAssessment,
  qualityFlags: string[] = [],
): ProviderEvidenceResult<GatekeeperSiteAssessment> {
  return {
    capabilityId: "gatekeeper_primary_web_assessment",
    acquisitionRunId: "gemini-run",
    availability: "AVAILABLE",
    quality: qualityFlags.length ? "DEGRADED" : "VALID",
    qualityFlags,
    payload: assessment,
    provenance: [
      {
        type: "OWNED_DOMAIN",
        sourceUrl: "https://example.com/",
        acquiredAt: "2026-08-20T00:00:00.000Z",
      },
      {
        type: "PUBLIC_WEB_SEARCH",
        sourceUrl: "https://public.example/source",
        acquiredAt: "2026-08-20T00:00:00.000Z",
      },
    ],
    connectionState: "CONNECTED",
    telemetry: telemetry(
      "GOOGLE_GEMINI",
      "gatekeeper_primary_web_assessment",
      "gemini-2.5-flash",
    ),
  };
}

function researchResult(): ProviderEvidenceResult<CompanyPublicWebResearchPayload> {
  return {
    capabilityId: "company_public_web_research",
    acquisitionRunId: "parallel-run",
    availability: "AVAILABLE",
    quality: "VALID",
    qualityFlags: [],
    payload: {
      searchId: "search-1",
      sessionId: "session-1",
      results: [
        {
          url: "https://research.example/company",
          title: "Company evidence",
          excerpts: ["Public company evidence"],
        },
      ],
    },
    provenance: [
      {
        type: "PUBLIC_WEB_RESEARCH",
        sourceUrl: "https://research.example/company",
        providerReference: "search-1",
        acquiredAt: "2026-08-20T00:00:00.000Z",
      },
    ],
    connectionState: "CONNECTED",
    telemetry: telemetry("PARALLEL_AI", "company_public_web_research"),
  };
}

function config(openAiModel = ""): ConfigService {
  return {
    get: vi.fn((key: string, fallback: string) => {
      if (key === "NODE_ENV") return "test";
      if (key === "GATEKEEPER_OPENAI_MODEL_ID") return openAiModel;
      return fallback;
    }),
  } as unknown as ConfigService;
}

describe("Gatekeeper runtime orchestration", () => {
  const primary = vi.fn();
  const publicWebResearch = vi.fn();
  const openAi = vi.fn();
  const record = vi.fn();
  const capabilities = {
    primary,
    publicWebResearch,
    openAi,
  } as unknown as GatekeeperCapabilityPort;
  const artifacts = new GatekeeperArtifactLoader();
  const prompts = new GatekeeperPromptService(artifacts);

  function runtime(openAiModel = "") {
    return new GatekeeperRuntimeOrchestratorService(
      capabilities,
      artifacts,
      prompts,
      config(openAiModel),
      { record } as unknown as GatekeeperTelemetryService,
    );
  }

  beforeEach(() => {
    primary.mockReset();
    publicWebResearch.mockReset();
    openAi.mockReset();
    record.mockReset();
  });

  it("requests the canonical primary capability with gemini-2.5-flash", async () => {
    primary.mockResolvedValue(assessmentResult(base));

    const result = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });

    expect(result.assessment).toEqual(base);
    expect(primary).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "gemini-2.5-flash" }),
    );
    expect(publicWebResearch).not.toHaveBeenCalled();
    expect(openAi).not.toHaveBeenCalled();
  });

  it("does not treat MEDIUM confidence alone as a fallback trigger", async () => {
    primary.mockResolvedValue(
      assessmentResult({ ...base, assessment_confidence: "MEDIUM" }),
    );

    const result = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });

    expect(result.unresolvedSemanticUncertainty).toBe(false);
    expect(publicWebResearch).not.toHaveBeenCalled();
  });

  it("requests Parallel only for admission-critical uncertainty and canonically reassesses its Evidence", async () => {
    primary
      .mockResolvedValueOnce(
        assessmentResult({
          ...base,
          assessment_confidence: "MEDIUM",
          english_evidence_status: "UNCERTAIN",
        }),
      )
      .mockResolvedValueOnce(assessmentResult(base));
    publicWebResearch.mockResolvedValue(researchResult());

    const result = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });

    expect(result.assessment).toEqual(base);
    expect(publicWebResearch).toHaveBeenCalledTimes(1);
    expect(primary).toHaveBeenCalledTimes(2);
    const reassessmentRequest = primary.mock.calls[1]?.[0] as {
      instruction: string;
    };
    expect(reassessmentRequest.instruction).toContain(
      "parallel_public_web_research",
    );
    expect(reassessmentRequest.instruction).toContain(
      "gatekeeper_site_assessment_reasoning",
    );
  });

  it("escalates LOW and never auto-admits it", async () => {
    primary.mockResolvedValue(
      assessmentResult({ ...base, assessment_confidence: "LOW" }),
    );
    publicWebResearch.mockRejectedValue(new Error("parallel unavailable"));

    const result = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });

    expect(publicWebResearch).toHaveBeenCalledTimes(1);
    expect(result.unresolvedSemanticUncertainty).toBe(true);
    expect(result.assessment?.assessment_confidence).toBe("LOW");
  });

  it("requires an externally supplied approved OpenAI model", async () => {
    const low = { ...base, assessment_confidence: "LOW" as const };
    primary
      .mockResolvedValueOnce(assessmentResult(low))
      .mockResolvedValueOnce(assessmentResult(low));
    publicWebResearch.mockResolvedValue(researchResult());

    const withoutModel = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });
    expect(withoutModel.execution.openai).toBe("FAILED_PRECHECK");
    expect(openAi).not.toHaveBeenCalled();

    primary
      .mockResolvedValueOnce(assessmentResult(low))
      .mockResolvedValueOnce(assessmentResult(low));
    publicWebResearch.mockResolvedValue(researchResult());
    openAi.mockResolvedValue({
      ...assessmentResult(base),
      capabilityId: "openai_structured_assessment",
      telemetry: telemetry(
        "OPENAI",
        "openai_structured_assessment",
        "approved-test-model",
      ),
    });
    const withModel = await runtime("approved-test-model").execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });
    expect(withModel.assessment).toEqual(base);
    expect(openAi).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: "approved-test-model" }),
    );
  });

  it("keeps exhausted technical failure distinct from semantic uncertainty", async () => {
    primary.mockRejectedValue(new Error("provider down"));
    publicWebResearch.mockRejectedValue(new Error("research down"));
    const technical = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });
    expect(technical.exhaustedTechnicalFailure).toBe(true);
    expect(technical.unresolvedSemanticUncertainty).toBe(false);

    primary.mockReset();
    publicWebResearch.mockReset();
    primary.mockResolvedValue(
      assessmentResult({ ...base, assessment_confidence: "LOW" }),
    );
    publicWebResearch.mockRejectedValue(new Error("research down"));
    const semantic = await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });
    expect(semantic.exhaustedTechnicalFailure).toBe(false);
    expect(semantic.unresolvedSemanticUncertainty).toBe(true);
  });

  it("records capability, prompt, evidence, validation and terminal telemetry", async () => {
    primary.mockResolvedValue(assessmentResult(base));
    await runtime().execute({
      normalizedUrl: "https://example.com/",
      normalizedDomain: "example.com",
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "gatekeeper.processor_execution",
        processorId: "gatekeeper_site_assessment",
        capabilityId: "gatekeeper_primary_web_assessment",
        promptBuildId: expect.stringMatching(/^pb_/),
        evidenceRefs: expect.any(Array),
        validationStage: "STRUCTURAL",
      }),
    );
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "gatekeeper.execution",
        terminalState: "SUCCEEDED",
      }),
    );
  });
});
