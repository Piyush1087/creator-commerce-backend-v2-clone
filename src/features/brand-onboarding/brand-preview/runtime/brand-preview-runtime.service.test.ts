import { BrandPreviewRuntimeState, IndustryVertical } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../../prisma/prisma.service";
import type { GatekeeperPersistenceService } from "../../gatekeeper/gatekeeper-persistence.service";
import type { CanonicalBrandStateService } from "../../canonical-brand-state/canonical-brand-state.service";
import type { BrandPreviewPublicWebEnrichmentService } from "../data-extraction/brand-preview-enrichment.service";
import type { BrandPreviewWebsiteEvidenceService } from "../data-extraction/brand-preview-evidence.service";
import type { BrandPreviewEvidence } from "../brand-preview.types";
import type { BrandPreviewArtifactLoader } from "./brand-preview-artifact.loader";
import { BrandPreviewRuntimeService } from "./brand-preview-runtime.service";
import type { BrandPreviewSynthesisService } from "./brand-preview-synthesis.service";

const gatekeeper = {
  submission: {
    normalized_url: "https://example.com/",
    normalized_domain: "example.com",
  },
  decision: { outcome: "ADMITTED" },
  confirmation: {
    surface_eligible: true,
    confirmed_industry: IndustryVertical.D2C,
  },
  assessment: { provisional_sub_industry: "Tools" },
};

function evidence(sufficient: boolean): BrandPreviewEvidence {
  return {
    brandName: "Example",
    logoUrl: null,
    pages: [
      {
        url: "https://example.com/",
        pageType: "homepage",
        cleanText: "Evidence",
      },
    ],
    evidenceRefs: ["owned:https://example.com/"],
    sufficientForPreviewSynthesisAttempt: sufficient,
    coverage: {
      brandProposition: sufficient ? "PRESENT" : "WEAK",
      customerUseContext: sufficient ? "PRESENT" : "WEAK",
      commercialOfferingConversion: sufficient ? "PRESENT" : "WEAK",
    },
    availability: sufficient ? "AVAILABLE" : "PARTIALLY_AVAILABLE",
    qualityState: sufficient ? "VALID" : "DEGRADED",
    qualityFlags: sufficient ? [] : ["EVIDENCE_DIMENSIONS_INSUFFICIENT"],
  };
}

function synthesis(archetypeId = "EDUCATOR") {
  return {
    output: {
      brand_descriptor: null,
      brand_understanding_narrative:
        "Example builds practical tools that help working teams understand difficult decisions with clear, useful guidance. Its product explanations create a credible role for creators who can demonstrate workflows and make unfamiliar choices easier to evaluate.",
      internal_trace: {
        brand_descriptor: null,
        brand_understanding_narrative: {
          internal_grounding_refs: ["owned:https://example.com/"],
          internal_confidence: "HIGH" as const,
        },
      },
      audience_groups: [
        {
          id: "teams",
          label: "Working teams",
          why_it_matters:
            "They need approachable guidance for unfamiliar decisions.",
          internal_grounding_refs: ["owned:https://example.com/"],
          internal_confidence: "HIGH" as const,
        },
      ],
      creator_marketing_opportunities: [
        {
          title: "Explain unfamiliar choices",
          why_it_matters:
            "Creators can make detailed information easier to understand.",
          internal_grounding_refs: ["owned:https://example.com/"],
          internal_confidence: "HIGH" as const,
        },
      ],
      creator_archetype_recommendations: [
        {
          archetype_id: archetypeId,
          rationale: "Explains unfamiliar choices with approachable clarity.",
          internal_grounding_refs: ["owned:https://example.com/"],
          internal_confidence: "HIGH" as const,
        },
      ],
    },
    metadata: { prompt_build_id: "pb-1" },
  };
}

function harness(args: {
  evidence: BrandPreviewEvidence;
  synthesisResults?: unknown[];
  runBrandProfileId?: string | null;
  postAnchors?: {
    brandName?: string;
    websiteUrl?: string;
    confirmedIndustry?: string;
    logoUrl?: string | null;
  };
}) {
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    brandPreviewRun: {
      findUnique: vi.fn().mockResolvedValue({
        id: "run-1",
        discoveryLeadId: "lead-1",
        leaseToken: "lease-1",
        state: BrandPreviewRuntimeState.ANALYSIS_ACTIVE,
        brandProfileId: args.runBrandProfileId ?? null,
        discoveryLead: { temporaryPayload: {} },
      }),
      updateMany: vi.fn().mockImplementation(({ data }) => {
        updates.push(data);
        return Promise.resolve({ count: 1 });
      }),
    },
    brandProfile: {
      upsert: vi.fn().mockResolvedValue({ id: "profile-stable" }),
    },
  };
  const enrichment = {
    acquire: vi.fn().mockResolvedValue({
      payload: {
        brand_summary: "Public context",
        audience_or_use_context: [],
        offering_or_commercial_context: [],
        grounding_refs: [],
      },
      evidenceRefs: [],
    }),
  };
  const synthesize = vi.fn();
  for (const result of args.synthesisResults ?? [synthesis()]) {
    synthesize.mockResolvedValueOnce(result);
  }
  const readSnapshot = vi
    .fn()
    .mockImplementation(
      ({ lifecycleMode }: { lifecycleMode: "PRE_PROFILE" | "POST_PROFILE" }) =>
        Promise.resolve(
          lifecycleMode === "PRE_PROFILE"
            ? {
                lifecycle_mode: "PRE_PROFILE",
                website_url: { value: "https://example.com/" },
                brand_name: { value: null },
                industry: { value: IndustryVertical.D2C },
              }
            : {
                lifecycle_mode: "POST_PROFILE",
                website_url: {
                  value: args.postAnchors?.websiteUrl ?? "example.com",
                },
                brand_name: {
                  value: args.postAnchors?.brandName ?? "Example",
                },
                brand_logo: {
                  value: args.postAnchors?.logoUrl ?? args.evidence.logoUrl,
                },
                industry: {
                  value:
                    args.postAnchors?.confirmedIndustry ?? IndustryVertical.D2C,
                },
              },
        ),
    );
  const service = new BrandPreviewRuntimeService(
    prisma as unknown as PrismaService,
    {
      getGatekeeperResult: vi.fn().mockResolvedValue(gatekeeper),
    } as unknown as GatekeeperPersistenceService,
    { readSnapshot } as unknown as CanonicalBrandStateService,
    {
      acquire: vi.fn().mockResolvedValue(args.evidence),
    } as unknown as BrandPreviewWebsiteEvidenceService,
    enrichment as unknown as BrandPreviewPublicWebEnrichmentService,
    { synthesize } as unknown as BrandPreviewSynthesisService,
    {
      resolvePrimaryModel: vi
        .fn()
        .mockResolvedValue({ model_id: "registry-id" }),
      loadArchetypes: vi
        .fn()
        .mockResolvedValue([
          { id: "EDUCATOR", label: "Educator", isActive: true },
        ]),
    } as unknown as BrandPreviewArtifactLoader,
  );
  return {
    service,
    updates,
    enrichment,
    synthesize,
    readSnapshot,
    prisma,
  };
}

describe("BrandPreviewRuntimeService", () => {
  it("uses one IE-requested enrichment round for a sparse/app-first site", async () => {
    const { service, enrichment, synthesize, updates } = harness({
      evidence: evidence(false),
    });
    await service.execute("run-1", "lease-1");
    expect(enrichment.acquire).toHaveBeenCalledOnce();
    expect(synthesize).toHaveBeenCalledOnce();
    expect(updates.some((data) => data.phase === "LEARNING_AUDIENCE")).toBe(
      true,
    );
    expect(updates.at(-1)?.state).toBe(BrandPreviewRuntimeState.PREVIEW_READY);
  });

  it("continues Preview synthesis when optional enrichment JSON fails", async () => {
    const { service, enrichment, synthesize, updates } = harness({
      evidence: evidence(false),
    });
    enrichment.acquire.mockRejectedValue(
      new Error("Gemini grounded assessment was not valid JSON"),
    );
    await service.execute("run-1", "lease-1");
    expect(synthesize).toHaveBeenCalledOnce();
    expect(updates.at(-1)?.state).toBe(BrandPreviewRuntimeState.PREVIEW_READY);
  });

  it("performs one enrichment and one resynthesis, then returns NOT_READY", async () => {
    const invalid = synthesis("INVENTED");
    const { service, enrichment, synthesize, updates } = harness({
      evidence: evidence(true),
      synthesisResults: [invalid, invalid],
    });
    await service.execute("run-1", "lease-1");
    expect(enrichment.acquire).toHaveBeenCalledOnce();
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(
      updates.some((data) => data.phase === "FINDING_CREATOR_OPPORTUNITIES"),
    ).toBe(true);
    expect(updates.at(-1)?.state).toBe(
      BrandPreviewRuntimeState.PREVIEW_NOT_READY,
    );
  });

  it("projects exhausted technical execution as recoverable with retry", async () => {
    const harnessed = harness({ evidence: evidence(true) });
    harnessed.synthesize
      .mockReset()
      .mockRejectedValue(new Error("provider chain exhausted"));
    await harnessed.service.execute("run-1", "lease-1");
    expect(harnessed.updates.at(-1)).toMatchObject({
      state: BrandPreviewRuntimeState.PREVIEW_FAILED_RECOVERABLE,
      retryAllowed: true,
      phase: null,
    });
  });

  it("uses canonical post-profile anchors when later Preview name and logo candidates conflict", async () => {
    const candidate = {
      ...evidence(true),
      brandName: "Later Scan Name",
      logoUrl: "https://example.com/later-logo.png",
    };
    const harnessed = harness({
      evidence: candidate,
      postAnchors: {
        brandName: "Settings Name",
        websiteUrl: "canonical.example",
        confirmedIndustry: IndustryVertical.HEALTHCARE,
        logoUrl: "https://cdn.example.com/settings-logo.png",
      },
    });
    await harnessed.service.execute("run-1", "lease-1");

    expect(harnessed.readSnapshot.mock.calls.map(([call]) => call)).toEqual([
      expect.objectContaining({ lifecycleMode: "PRE_PROFILE" }),
      expect.objectContaining({
        lifecycleMode: "POST_PROFILE",
        brandProfileId: "profile-stable",
        candidates: expect.objectContaining({
          brandName: "Later Scan Name",
          brandLogo: "https://example.com/later-logo.png",
        }),
      }),
    ]);
    expect(harnessed.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        brandName: "Settings Name",
        websiteUrl: "canonical.example",
        confirmedIndustry: IndustryVertical.HEALTHCARE,
        evidence: expect.objectContaining({
          brandName: "Settings Name",
          logoUrl: "https://cdn.example.com/settings-logo.png",
        }),
      }),
    );
    expect(harnessed.updates.at(-1)?.previewOutputSnapshot).toMatchObject({
      identity: {
        brand_name: "Settings Name",
        website_url: "canonical.example",
        confirmed_industry: IndustryVertical.HEALTHCARE,
        logo_url: "https://cdn.example.com/settings-logo.png",
      },
    });
  });

  it("starts a retry linked to a BrandProfile in POST_PROFILE without creating another profile", async () => {
    const harnessed = harness({
      evidence: evidence(true),
      runBrandProfileId: "profile-existing",
      postAnchors: {
        brandName: "Existing Canonical Name",
        websiteUrl: "existing.example",
      },
    });
    await harnessed.service.execute("run-1", "lease-1");

    expect(harnessed.readSnapshot.mock.calls[0]?.[0]).toMatchObject({
      lifecycleMode: "POST_PROFILE",
      brandProfileId: "profile-existing",
    });
    expect(harnessed.prisma.brandProfile.upsert).not.toHaveBeenCalled();
    expect(harnessed.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        brandName: "Existing Canonical Name",
        websiteUrl: "existing.example",
      }),
    );
  });
});
