import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
  type OwnedWebsitePageAcquisitionMechanics,
} from "./acquisition/owned-website-wave1-acquisition.service";
import { asBrandId, type BrandId } from "./domain/evidence-identities";
import { DataExtractionIntelligenceEvidenceAdapter } from "./intelligence/data-extraction-intelligence-evidence.adapter";
import { OwnedWebsiteWave1NormalizationService } from "./normalization/owned-website-wave1-normalization.service";
import { DataExtractionPersistenceError } from "./persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "./persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "./query/data-extraction-evidence-query.service";

const databaseUrl = process.env.DE_P2B1_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class ExactOfferingMechanics implements OwnedWebsitePageAcquisitionMechanics {
  readonly calls: string[] = [];

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    this.calls.push(url);
    const path = new URL(url).pathname;
    const links =
      path === "/"
        ? [
            new URL("/products/offering-y", url).toString(),
            new URL("/products/offering-z", url).toString(),
            new URL("/collections/all", url).toString(),
          ]
        : [];
    const text =
      path === "/products/offering-y"
        ? "Offering Y is a durable red running shoe with a breathable upper and everyday cushioning."
        : path === "/products/offering-z"
          ? "Offering Z is a separate blue hiking shoe with a waterproof upper."
          : path === "/collections/all"
            ? "Our product collection includes running shoes, hiking shoes, and accessories."
            : "Our product portfolio serves runners and hikers across multiple collections.";
    return {
      url,
      html: `<main><p>${text}</p>${links
        .map((link) => `<a href="${link}">${link}</a>`)
        .join("")}</main>`,
      cleanText: text,
      internalLinks: links,
      quality: { state: "COMPLETE", failureCategories: [], detailCodes: [] },
      attempts: [
        {
          providerExecutionRef: `provider-execution:${randomUUID()}`,
          attemptRole: "PRIMARY",
        },
      ],
      reasonCodes: [],
    };
  }
}

describePostgres("P2B-1 exact Offering first-slice PostgreSQL fixture", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function brand(label: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `p2b1-${label}-${randomUUID()}.example`,
        name: `P2B-1 ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }

  async function offering(
    brandId: BrandId,
    name: string,
    path: string,
  ): Promise<string> {
    const row = await prisma.offering.create({
      data: {
        brandProfileId: brandId,
        type: "PRODUCT",
        name,
        url: `https://p2b1-fixture.example${path}`,
        locationIds: [],
        sellingPoints: [],
        doNotSay: [],
      },
    });
    return row.id;
  }

  function runtime(mechanics: ExactOfferingMechanics) {
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    const query = new DataExtractionEvidenceQueryService(persistence);
    const adapter = new DataExtractionIntelligenceEvidenceAdapter(query);
    return { acquisition, normalization, adapter };
  }

  async function exactExecution(
    brandId: BrandId,
    canonicalOfferingRef: string,
    resourceUrl: string,
    freshnessIntent: "REUSE_ALLOWED" | "FORCE_RECAPTURE" = "REUSE_ALLOWED",
  ) {
    const { acquisition, normalization } = runtime(
      new ExactOfferingMechanics(),
    );
    const acquired = await acquisition.request({
      brandId,
      capabilityId: "owned_website.offering_context",
      freshnessIntent,
      normalizationContractVersion: "1.0",
      requestKey: `p2b1:${randomUUID()}`,
      ownedWebsiteRoot: "https://p2b1-fixture.example/",
      exactOfferingScope: {
        canonicalOfferingRef,
        resourceUrls: [resourceUrl],
      },
    });
    expect(acquired.exactOfferingResources).toHaveLength(1);
    const exact = acquired.exactOfferingResources![0]!;
    const result = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
      exactOfferingScope: {
        canonicalOfferingRef,
        captureRefs: [exact.captureRef],
      },
    });
    return { acquired, exact, result };
  }

  it("hands the future Product factual processor only Offering Y Evidence across executions", async () => {
    const brandId = await brand("first-slice");
    const y = await offering(brandId, "Offering Y", "/products/offering-y");
    const z = await offering(brandId, "Offering Z", "/products/offering-z");

    const firstY = await exactExecution(
      brandId,
      y,
      "https://p2b1-fixture.example/products/offering-y",
    );
    const secondY = await exactExecution(
      brandId,
      y,
      "https://p2b1-fixture.example/products/offering-y",
      "FORCE_RECAPTURE",
    );
    await exactExecution(
      brandId,
      z,
      "https://p2b1-fixture.example/products/offering-z",
    );

    const broadRuntime = runtime(new ExactOfferingMechanics());
    const broad = await broadRuntime.acquisition.request({
      brandId,
      capabilityId: "owned_website.offering_context",
      freshnessIntent: "FORCE_RECAPTURE",
      normalizationContractVersion: "1.0",
      requestKey: `p2b1:broad:${randomUUID()}`,
      ownedWebsiteRoot: "https://p2b1-fixture.example/",
    });
    await broadRuntime.normalization.normalize({
      brandId,
      capabilityExecutionRef: broad.capabilityExecutionRef,
    });

    const read = await broadRuntime.adapter.read({
      brandId,
      processorId: "future_offering_factual_synthesis_fixture",
      processorVersion: "1.0",
      capabilityIds: ["owned_website.offering_context"],
      exactOfferingScope: { canonicalOfferingRef: y },
    });

    expect(read.canonicalOfferingRef).toBe(y);
    const capability = read.capabilityResults[0]!;
    expect(capability.capabilityExecutionRefs).toEqual([
      secondY.acquired.capabilityExecutionRef,
      firstY.acquired.capabilityExecutionRef,
    ]);
    expect(capability.evidence).toHaveLength(2);
    for (const item of capability.evidence) {
      expect(item).toMatchObject({
        brandId,
        capabilityId: "owned_website.offering_context",
        resourceRef: expect.stringMatching(/^resource:/),
        captureRef: expect.stringMatching(/^capture:/),
        freshness: {
          state: "CURRENT",
          basis: "SAME_ACTIVE_RUN",
        },
        boundedNormalizedPayload: {
          generalization_scope: "SINGLE_OFFERING",
          canonical_offering_ref: y,
          observed_context: expect.stringContaining("Offering Y"),
        },
      });
      expect(item.capabilityExecutionRefs).toHaveLength(1);
      expect(item.evidenceRef).toMatch(/^evidence:/);
      expect(item.captureVersion).toBe(item.captureRef);
    }
    expect(JSON.stringify(read)).not.toContain(z);
    expect(JSON.stringify(read)).not.toContain("MULTIPLE_OFFERINGS");
    expect(capability.capabilityExecutionRef).not.toBe(
      broad.capabilityExecutionRef,
    );
  }, 20_000);

  it("rejects cross-Brand Offering refs at acquisition, normalization, and read boundaries", async () => {
    const brandA = await brand("tenant-a");
    const brandB = await brand("tenant-b");
    const offeringA = await offering(
      brandA,
      "Brand A Offering",
      "/products/offering-y",
    );
    const offeringB = await offering(
      brandB,
      "Brand B Offering",
      "/products/offering-z",
    );
    const mechanics = new ExactOfferingMechanics();
    const { acquisition, normalization, adapter } = runtime(mechanics);

    await expect(
      acquisition.request({
        brandId: brandA,
        capabilityId: "owned_website.offering_context",
        freshnessIntent: "REUSE_ALLOWED",
        normalizationContractVersion: "1.0",
        requestKey: `p2b1:cross:${randomUUID()}`,
        ownedWebsiteRoot: "https://p2b1-fixture.example/",
        exactOfferingScope: {
          canonicalOfferingRef: offeringB,
          resourceUrls: ["https://p2b1-fixture.example/products/offering-z"],
        },
      }),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({
      code: "PERSISTENCE_INVARIANT",
    });
    expect(mechanics.calls).toEqual([]);

    const valid = await acquisition.request({
      brandId: brandA,
      capabilityId: "owned_website.offering_context",
      freshnessIntent: "REUSE_ALLOWED",
      normalizationContractVersion: "1.0",
      requestKey: `p2b1:valid:${randomUUID()}`,
      ownedWebsiteRoot: "https://p2b1-fixture.example/",
      exactOfferingScope: {
        canonicalOfferingRef: offeringA,
        resourceUrls: ["https://p2b1-fixture.example/products/offering-y"],
      },
    });
    await expect(
      normalization.normalize({
        brandId: brandA,
        capabilityExecutionRef: valid.capabilityExecutionRef,
        exactOfferingScope: {
          canonicalOfferingRef: offeringB,
          captureRefs: valid.exactOfferingResources!.map(
            (entry) => entry.captureRef,
          ),
        },
      }),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({
      code: "PERSISTENCE_INVARIANT",
    });

    await expect(
      adapter.read({
        brandId: brandA,
        processorId: "future_product",
        processorVersion: "1.0",
        capabilityIds: ["owned_website.offering_context"],
        exactOfferingScope: { canonicalOfferingRef: offeringB },
      }),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({
      code: "PERSISTENCE_INVARIANT",
    });
  });
});
