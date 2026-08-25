import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../../prisma/prisma.service";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
  type OwnedWebsitePageAcquisitionMechanics,
} from "../acquisition/owned-website-wave1-acquisition.service";
import {
  asBrandId,
  asCapabilityExecutionRef,
  type BrandId,
} from "../domain/evidence-identities";
import { OwnedWebsiteWave1NormalizationService } from "../normalization/owned-website-wave1-normalization.service";
import { DataExtractionPersistenceService } from "../persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "../query/data-extraction-evidence-query.service";
import { DataExtractionIntelligenceEvidenceAdapter } from "./data-extraction-intelligence-evidence.adapter";

const databaseUrl = process.env.DE_W1_0F_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class FWave1Mechanics implements OwnedWebsitePageAcquisitionMechanics {
  readonly calls: string[] = [];

  constructor(private readonly constrained: boolean) {}

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    this.calls.push(url);
    const text = this.constrained
      ? "We help creators grow with better partnerships. Our mission is to never use guaranteed outcome claims in creator copy."
      : "We help creators grow with better partnerships. Our mission is to make creator partnerships simpler for brands.";
    return {
      url,
      html: `<html lang="en"><body><main>${text}</main></body></html>`,
      cleanText: text,
      internalLinks: [],
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

describePostgres("DE-W1.0F production Intelligence adapter PostgreSQL", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function brand(label: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `de-w1-0f-${label}-${randomUUID()}.example`,
        name: `DE W1.0F ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }

  function request(
    brandId: BrandId,
    root: string,
    capabilityId:
      | "owned_website.brand_messaging"
      | "derived_communication_constraint_evidence",
  ) {
    return {
      brandId,
      capabilityId,
      freshnessIntent: "REUSE_ALLOWED" as const,
      normalizationContractVersion: "1.0",
      requestKey: `request:${capabilityId}:${randomUUID()}`,
      ownedWebsiteRoot: root,
    };
  }

  function runtime(mechanics: FWave1Mechanics) {
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
    return { acquisition, normalization, query, adapter };
  }

  it("reads the real D → E messaging result without acquisition or normalization on read", async () => {
    const brandId = await brand("messaging");
    const mechanics = new FWave1Mechanics(false);
    const { acquisition, normalization, adapter } = runtime(mechanics);
    const acquired = await acquisition.request(
      request(
        brandId,
        "https://f-messaging.example/",
        "owned_website.brand_messaging",
      ),
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });
    const callsBeforeRead = mechanics.calls.length;

    const result = await adapter.read({
      brandId,
      processorId: "brand_communication",
      processorVersion: "1.0",
      capabilityIds: ["owned_website.brand_messaging"],
    });

    expect(mechanics.calls.length).toBe(callsBeforeRead);
    expect(result.capabilityResults[0]).toMatchObject({
      capabilityExecutionRef: acquired.capabilityExecutionRef,
      capabilityId: "owned_website.brand_messaging",
      status: "AVAILABLE",
    });
    expect(result.capabilityResults[0]?.evidence.length).toBeGreaterThan(0);
    for (const item of result.capabilityResults[0]?.evidence ?? []) {
      expect(item).toMatchObject({
        sourceClass: "OWNED_WEBSITE",
        captureVersion: expect.stringMatching(/^capture:/),
      });
      expect(item.captureVersion).toBe(item.captureRef);
    }
  });

  it("round-trips derived source class and deterministic parent provenance while Resource stays owned-site", async () => {
    const brandId = await brand("derived");
    const mechanics = new FWave1Mechanics(true);
    const { acquisition, normalization, adapter } = runtime(mechanics);
    const root = "https://f-derived.example/";
    const messaging = await acquisition.request(
      request(brandId, root, "owned_website.brand_messaging"),
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: messaging.capabilityExecutionRef,
    });
    const derived = await acquisition.request(
      request(brandId, root, "derived_communication_constraint_evidence"),
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: derived.capabilityExecutionRef,
    });

    const result = await adapter.read({
      brandId,
      processorId: "brand_communication",
      processorVersion: "1.0",
      capabilityIds: ["derived_communication_constraint_evidence"],
    });
    const item = result.capabilityResults[0]?.evidence[0];
    expect(item).toMatchObject({
      sourceClass: "SYSTEM_DERIVATION_INPUT",
      provenance: {
        acquisitionOrNormalizationRunRef: derived.capabilityExecutionRef,
        captureMethodClass: "DETERMINISTIC_DERIVATION",
        parentEvidenceRefs: [expect.stringMatching(/^evidence:/)],
        parentCaptureRefs: [expect.stringMatching(/^capture:/)],
      },
    });
    const resource = await prisma.dataExtractionResource.findUniqueOrThrow({
      where: { resourceRef: item!.resourceRef },
    });
    expect(resource.sourceClass).toBe("OWNED_WEBSITE");
  });

  it("preserves durable AVAILABLE + [] for a no-constraint result", async () => {
    const brandId = await brand("zero");
    const mechanics = new FWave1Mechanics(false);
    const { acquisition, normalization, adapter } = runtime(mechanics);
    const root = "https://f-zero.example/";
    const messaging = await acquisition.request(
      request(brandId, root, "owned_website.brand_messaging"),
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: messaging.capabilityExecutionRef,
    });
    const constraint = await acquisition.request(
      request(brandId, root, "derived_communication_constraint_evidence"),
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: constraint.capabilityExecutionRef,
    });

    const result = await adapter.read({
      brandId,
      processorId: "brand_communication",
      processorVersion: "1.0",
      capabilityIds: ["derived_communication_constraint_evidence"],
    });
    expect(result.capabilityResults).toEqual([
      expect.objectContaining({
        capabilityExecutionRef: constraint.capabilityExecutionRef,
        status: "AVAILABLE",
        evidence: [],
      }),
    ]);
  });

  it("ignores newer non-terminal D preparation and never leaks another Brand", async () => {
    const brandA = await brand("selection-a");
    const brandB = await brand("selection-b");
    const mechanics = new FWave1Mechanics(false);
    const { acquisition, normalization, adapter } = runtime(mechanics);
    const root = "https://f-selection.example/";
    const completed = await acquisition.request(
      request(brandA, root, "owned_website.brand_messaging"),
    );
    await normalization.normalize({
      brandId: brandA,
      capabilityExecutionRef: completed.capabilityExecutionRef,
    });
    const preparation = await acquisition.request(
      request(brandA, root, "owned_website.brand_messaging"),
    );
    expect(
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: preparation.capabilityExecutionRef },
      }),
    ).toMatchObject({ completedAt: null });

    const selected = await adapter.read({
      brandId: brandA,
      processorId: "brand_communication",
      processorVersion: "1.0",
      capabilityIds: ["owned_website.brand_messaging"],
    });
    expect(selected.capabilityResults[0]?.capabilityExecutionRef).toBe(
      completed.capabilityExecutionRef,
    );

    const isolated = await adapter.read({
      brandId: brandB,
      processorId: "brand_communication",
      processorVersion: "1.0",
      capabilityIds: ["owned_website.brand_messaging"],
    });
    expect(isolated.capabilityResults[0]).toMatchObject({
      capabilityExecutionRef: expect.stringMatching(
        /^capability-execution:not-requested:/,
      ),
      status: "NOT_REQUESTED",
      evidence: [],
    });
  });

  it("uses stable execution-ref ordering when completion and creation timestamps tie", async () => {
    const brandId = await brand("tie-break");
    const repositories = persistence.repositories();
    const completedAt = "2026-08-26T10:00:00.000Z";
    const suffix = randomUUID();
    const refs = [
      `capability-execution:z-${suffix}`,
      `capability-execution:a-${suffix}`,
    ];
    for (const ref of refs) {
      const created = await repositories.capabilityExecutions.createOrGet({
        brandId,
        capabilityExecutionRef: asCapabilityExecutionRef(ref),
        capabilityId: "owned_website.brand_messaging",
        normalizationContractVersion: "1.0",
        resourceScopeHash: `scope:${ref}`,
        freshnessIntent: "REUSE_ALLOWED",
        requestKey: `request:${ref}`,
        coverage: "SINGLE_RESOURCE",
      });
      await repositories.capabilityExecutions.complete(
        brandId,
        created.capabilityExecutionRef,
        {
          availability: "AVAILABLE",
          retryability: "NOT_APPLICABLE",
          reasonCodes: [],
          coverage: "SINGLE_RESOURCE",
          acquisitionQuality: {
            state: "COMPLETE",
            failureCategories: [],
            detailCodes: [],
          },
          completedAt,
        },
      );
    }
    await prisma.dataExtractionCapabilityExecution.updateMany({
      where: { brandId },
      data: { createdAt: new Date("2026-08-26T09:00:00.000Z") },
    });

    const selected =
      await repositories.capabilityExecutions.findLatestCompleted(
        brandId,
        "owned_website.brand_messaging",
      );
    expect(selected?.capabilityExecutionRef).toBe(refs[1]);
  });
});
