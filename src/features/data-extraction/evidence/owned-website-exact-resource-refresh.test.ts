import { describe, expect, it, vi } from "vitest";

import {
  asBrandId,
  asCapabilityExecutionRef,
  asCaptureRef,
  asResourceRef,
} from "./domain/evidence-identities";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisitionMechanics,
} from "./acquisition/owned-website-wave1-acquisition.service";
import { DataExtractionPersistenceService } from "./persistence/prisma-evidence-repositories";

const brandId = asBrandId("brand-exact-refresh");
const executionRef = asCapabilityExecutionRef(
  "capability-execution:exact-refresh",
);
const resourceRef = asResourceRef("resource:exact-refresh");
const captureRef = asCaptureRef("capture:exact-refresh");

function request() {
  return {
    brandId,
    capabilityId: "owned_website.offering_commercial_evidence" as const,
    freshnessIntent: "FORCE_RECAPTURE" as const,
    normalizationContractVersion: "1.0",
    requestKey: "refresh-key",
    ownedWebsiteRoot: "https://brand.example/",
    exactOfferingScope: {
      canonicalOfferingRef: "offering-exact",
      resourceUrls: ["https://brand.example/products/exact"],
    },
    acquisitionMode: "EXACT_RESOURCES_ONLY" as const,
    executionClaim: "REQUIRE_CREATOR" as const,
  };
}

function harness(existing = false) {
  const execution = {
    brandId,
    capabilityExecutionRef: executionRef,
    capabilityId: "owned_website.offering_commercial_evidence" as const,
    resourceScope: [],
    freshnessIntent: "FORCE_RECAPTURE" as const,
    normalizationContractVersion: "1.0",
    availability: "NOT_REQUESTED" as const,
    retryability: "NOT_APPLICABLE" as const,
    reasonCodes: [],
    coverage: "SINGLE_RESOURCE" as const,
    acquisitionQuality: {
      state: "UNAVAILABLE" as const,
      failureCategories: [],
      detailCodes: [],
    },
    evidenceRefs: [],
    createdAt: "2026-08-28T00:00:00.000Z",
  };
  const repositories = {
    canonicalOfferings: { assertOwnedByBrand: vi.fn() },
    capabilityExecutions: {
      findByRequestKey: vi.fn().mockResolvedValue(existing ? execution : null),
      createOrGetClaimed: vi.fn().mockResolvedValue({
        record: execution,
        created: true,
      }),
      complete: vi.fn(),
    },
    resources: {
      createOrGet: vi.fn().mockResolvedValue({
        brandId,
        resourceRef,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        canonicalResourceKey:
          "https://brand.example/products/exact|exact-offering:offering-exact",
        canonicalUrl: "https://brand.example/products/exact",
        aliases: [],
        pageRole: "OFFERING_DETAIL",
        createdAt: "2026-08-28T00:00:00.000Z",
      }),
      findByRef: vi.fn(),
    },
    captures: {
      findLatestForResource: vi.fn().mockResolvedValue(null),
      findByAcquisitionRequestKey: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ captureRef }),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    },
    capabilityResources: { attach: vi.fn() },
    providerExecutionLinks: { attachToCapture: vi.fn() },
    contentArtifacts: { insert: vi.fn() },
    freshnessAssessments: { record: vi.fn() },
  };
  const persistence = {
    repositories: () => repositories,
    withTransaction: async (
      callback: (value: typeof repositories) => unknown,
    ) => callback(repositories),
  };
  const mechanics = {
    acquire: vi.fn().mockResolvedValue({
      url: "https://brand.example/products/exact",
      html: "<main><p>Price: USD 25</p></main>",
      cleanText: "Price: USD 25",
      observationFragment: { version: "1.0", limitations: [] },
      internalLinks: ["https://brand.example/unrelated"],
      quality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      attempts: [],
      reasonCodes: [],
    }),
  };
  return {
    service: new OwnedWebsiteWave1AcquisitionService(
      persistence as unknown as DataExtractionPersistenceService,
      mechanics as unknown as OwnedWebsitePageAcquisitionMechanics,
    ),
    repositories,
    mechanics,
  };
}

describe("exact-resource-only commercial refresh", () => {
  it("reuses exact resource identity, creates a fresh capture, and never fetches root or links", async () => {
    const { service, repositories, mechanics } = harness();
    const result = await service.request(request());
    expect(result.executionClaim).toBe("CREATED");
    expect(result.exactOfferingResources).toEqual([
      expect.objectContaining({
        resourceRef,
        captureRef: expect.stringMatching(/^capture:/),
      }),
    ]);
    expect(mechanics.acquire).toHaveBeenCalledTimes(1);
    expect(mechanics.acquire).toHaveBeenCalledWith(
      "https://brand.example/products/exact",
    );
    expect(repositories.resources.createOrGet).toHaveBeenCalledWith(
      expect.objectContaining({
        pageRole: "OFFERING_DETAIL",
        canonicalResourceKey:
          "https://brand.example/products/exact|exact-offering:offering-exact",
      }),
    );
    expect(repositories.captures.create).toHaveBeenCalledTimes(1);
  });

  it("makes a second application instance skip before network acquisition", async () => {
    const { service, mechanics } = harness(true);
    const result = await service.request(request());
    expect(result.executionClaim).toBe("EXISTING");
    expect(mechanics.acquire).not.toHaveBeenCalled();
  });

  it("rejects exact-only mode for any non-commercial capability", async () => {
    const { service } = harness();
    await expect(
      service.request({
        ...request(),
        capabilityId: "owned_website.brand_messaging",
      }),
    ).rejects.toThrow("DATA_EXTRACTION_PERSISTENCE_INVARIANT");
  });
});
