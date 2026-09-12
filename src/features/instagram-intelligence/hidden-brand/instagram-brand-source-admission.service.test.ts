import { describe, expect, it, vi } from "vitest";

import { InstagramBrandSourceAdmissionService } from "./instagram-brand-source-admission.service";

const identity = {
  sourceProfileVersion: "1.1",
  sourceScope: "INSTAGRAM_OWNED",
  providerAccountId: "account-1",
  authorizationGeneration: 7,
  windowStart: "2026-08-13T00:00:00.000Z",
  windowEnd: "2026-09-12T00:00:00.000Z",
} as const;

function evidence(capabilityId = "instagram.caption_context") {
  return {
    brandId: "brand-1",
    capabilityResults: [
      {
        capabilityExecutionRef: "capability-1",
        capabilityId,
        normalizationContractVersion: "1.0",
        status: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: [],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "COMPLETE",
          failureCategories: [],
          detailCodes: [],
        },
        evidence: [
          {
            brandId: "brand-1",
            evidenceRef: "evidence:child",
            capabilityId,
            resourceRef: "resource-1",
            resourceType: "CONNECTED_SOCIAL_RESOURCE",
            captureRef: "capture-1",
            captureVersion: "capture-1",
            sourceClass: "INSTAGRAM_OWNED",
            capturedAt: "2026-09-11T00:00:00.000Z",
            freshness: {
              state: "CURRENT",
              basis: "CAPTURE",
              evaluatedAt: "2026-09-12T00:00:00.000Z",
            },
            representativeness: "CONTEXT_SPECIFIC",
            coverage: "SINGLE_RESOURCE",
            acquisitionQuality: {
              state: "COMPLETE",
              failureCategories: [],
              detailCodes: [],
            },
            provenance: {
              acquisitionOrNormalizationRunRef: "run-1",
              parentEvidenceRefs: ["evidence:parent"],
              parentCaptureRefs: ["capture-1"],
            },
            deduplication: {
              itemFingerprint: "fingerprint",
              repetitionCount: 1,
              supportingResourceRefs: ["resource-1"],
            },
            boundedNormalizedPayload: { semanticPayload: { caption: "Hello" } },
            contentHash: "hash",
          },
        ],
      },
    ],
  };
}

function row(ref: string, overrides: Record<string, unknown> = {}) {
  return {
    brandId: "brand-1",
    evidenceRef: ref,
    capabilityId: "instagram.caption_context",
    resourceRef: "resource-1",
    captureRef: "capture-1",
    parentEvidenceRefs: ref === "evidence:child" ? ["evidence:parent"] : [],
    capture: {
      captureRef: "capture-1",
      status: "COMPLETED",
      capturedAt: new Date("2026-09-11T00:00:00.000Z"),
      providerAccountId: "account-1",
      authorizationGeneration: 7,
    },
    resource: {
      resourceRef: "resource-1",
      sourceClass: "INSTAGRAM_OWNED",
      resourceType: "INSTAGRAM_MEDIA",
      providerAccountId: "account-1",
    },
    ...overrides,
  };
}

function harness(rows = [row("evidence:child"), row("evidence:parent")]) {
  let requestedCapability = "instagram.caption_context";
  const findMany = vi.fn(async ({ where }: any) =>
    rows
      .filter((candidate) =>
        where.evidenceRef.in.includes(candidate.evidenceRef),
      )
      .map((candidate) => ({
        ...candidate,
        capabilityId: requestedCapability,
      })),
  );
  const evidenceReader = {
    read: vi.fn(async (request: any) => {
      requestedCapability = request.capabilityIds[0];
      return evidence(requestedCapability);
    }),
  };
  const service = new InstagramBrandSourceAdmissionService(
    { dataExtractionEvidenceItem: { findMany } } as never,
    {
      read: vi.fn(async ({ brandId }: any) => ({
        brandId,
        entries: [],
        visualState: { brandId, stateReference: null, items: [] },
      })),
    } as never,
    evidenceReader as never,
    {
      build: vi.fn(() => ({ manifest: { entries: [] }, hash: "canonical" })),
    } as never,
    {
      build: vi.fn(() => ({ manifest: { evidence: [] }, hash: "evidence" })),
    } as never,
  );
  return { service, evidenceReader, findMany };
}

const key = (processorId: string) => ({
  processorId,
  processorVersion: "1.0",
  outputContractId: `${processorId}_output_contract`,
  outputContractVersion: "1.0",
});

describe("Instagram hidden Brand source admission", () => {
  it.each([
    ["brand_character", "instagram.caption_context"],
    ["brand_communication", "instagram.caption_context"],
    ["visual_style_synthesis", "instagram.media_visual_observations"],
  ])(
    "pins %s to its exact admitted capability",
    async (processorId, capability) => {
      const { service, evidenceReader, findMany } = harness();
      const result = await service.prepare({
        brandId: "brand-1",
        registryKey: key(processorId),
        activeScope: [],
        identity,
      });
      expect(evidenceReader.read).toHaveBeenCalledWith(
        expect.objectContaining({ capabilityIds: [capability] }),
      );
      expect(result.evidenceManifest).toEqual(
        expect.objectContaining({ sourceProfile: identity }),
      );
      expect(findMany).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    ["website", { resource: { sourceClass: "OWNED_WEBSITE" } }],
    [
      "other account",
      {
        capture: {
          status: "COMPLETED",
          capturedAt: new Date("2026-09-11T00:00:00.000Z"),
          providerAccountId: "account-2",
          authorizationGeneration: 7,
        },
      },
    ],
    [
      "stale generation",
      {
        capture: {
          status: "COMPLETED",
          capturedAt: new Date("2026-09-11T00:00:00.000Z"),
          providerAccountId: "account-1",
          authorizationGeneration: 6,
        },
      },
    ],
    [
      "incomplete capture",
      {
        capture: {
          status: "FAILED",
          capturedAt: new Date("2026-09-11T00:00:00.000Z"),
          providerAccountId: "account-1",
          authorizationGeneration: 7,
        },
      },
    ],
    [
      "outside window",
      {
        capture: {
          status: "COMPLETED",
          capturedAt: new Date("2026-08-01T00:00:00.000Z"),
          providerAccountId: "account-1",
          authorizationGeneration: 7,
        },
      },
    ],
  ])("fails closed for %s lineage", async (_label, overrides) => {
    const { service } = harness([
      row("evidence:child", overrides),
      row("evidence:parent"),
    ]);
    await expect(
      service.prepare({
        brandId: "brand-1",
        registryKey: key("brand_communication"),
        activeScope: [],
        identity,
      }),
    ).rejects.toThrow("INSTAGRAM_EVIDENCE_SOURCE_FENCE_REJECTED");
  });

  it("rejects incomplete recursive parent lineage", async () => {
    const { service } = harness([row("evidence:child")]);
    await expect(
      service.prepare({
        brandId: "brand-1",
        registryKey: key("brand_communication"),
        activeScope: [],
        identity,
      }),
    ).rejects.toThrow("INSTAGRAM_EVIDENCE_LINEAGE_INCOMPLETE");
  });

  it("rejects processors outside the accepted semantic matrix", async () => {
    const { service } = harness();
    await expect(
      service.prepare({
        brandId: "brand-1",
        registryKey: key("serviceability_synthesis"),
        activeScope: [],
        identity,
      }),
    ).rejects.toThrow("INSTAGRAM_SOURCE_PROCESSOR_NOT_ELIGIBLE");
  });
});
