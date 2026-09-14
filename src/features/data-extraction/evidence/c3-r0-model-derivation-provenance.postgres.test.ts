import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  asBrandId,
  asCaptureRef,
  asEvidenceRef,
  asResourceRef,
  asSemanticObservationKey,
  type BrandId,
  type CaptureRef,
  type EvidenceRef,
  type ResourceRef,
} from "./domain/evidence-identities";
import type { DataExtractionEvidenceItemRecord } from "./domain/evidence-records";
import { InstagramDerivedDataPurgeService } from "./instagram/instagram-derived-data-purge.service";
import { DataExtractionPersistenceError } from "./persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "./persistence/prisma-evidence-repositories";

const databaseUrl = process.env.C3_R0_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

const completeQuality = {
  state: "COMPLETE" as const,
  failureCategories: [] as const,
  detailCodes: [] as const,
};

describePostgres("C3-R0 model-derivation Evidence provenance", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function brand(label: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `c3-r0-${label}-${randomUUID()}.example`,
        name: `C3 R0 ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }

  async function resource(
    brandId: BrandId,
    sourceClass: "INSTAGRAM_OWNED" | "OWNED_WEBSITE" = "INSTAGRAM_OWNED",
  ): Promise<ResourceRef> {
    const ref = asResourceRef(`resource:c3-r0:${randomUUID()}`);
    await persistence.repositories().resources.createOrGet({
      brandId,
      resourceRef: ref,
      sourceClass,
      resourceType:
        sourceClass === "INSTAGRAM_OWNED"
          ? "INSTAGRAM_MEDIA"
          : "OWNED_WEB_PAGE",
      ...(sourceClass === "INSTAGRAM_OWNED"
        ? { providerAccountId: `account-${randomUUID()}` }
        : { pageRole: "HOMEPAGE" as const }),
      canonicalResourceKey: `c3-r0:${randomUUID()}`,
      canonicalUrl: `https://example.com/${randomUUID()}`,
    });
    return ref;
  }

  async function capture(
    brandId: BrandId,
    resourceRef: ResourceRef,
    terminal: "COMPLETED" | "RUNNING" | "FAILED" = "COMPLETED",
  ): Promise<CaptureRef> {
    const ref = asCaptureRef(`capture:c3-r0:${randomUUID()}`);
    const repositories = persistence.repositories();
    await repositories.captures.create({
      brandId,
      captureRef: ref,
      resourceRef,
      acquisitionRequestKey: `request:c3-r0:${randomUUID()}`,
      startedAt: "2026-09-12T08:00:00.000Z",
      acquisitionQuality: completeQuality,
    });
    if (terminal === "COMPLETED") {
      await repositories.captures.markCompleted(brandId, ref, {
        capturedAt: "2026-09-12T08:00:01.000Z",
        acquisitionQuality: completeQuality,
      });
    } else if (terminal === "FAILED") {
      await repositories.captures.markFailed(brandId, ref, {
        capturedAt: "2026-09-12T08:00:01.000Z",
        acquisitionQuality: {
          state: "UNAVAILABLE",
          failureCategories: ["PROVIDER_ERROR"],
          detailCodes: ["fixture_failure"],
        },
      });
    }
    return ref;
  }

  function evidence(
    brandId: BrandId,
    resourceRef: ResourceRef,
    captureRef: CaptureRef,
    options: Readonly<{
      evidenceRef?: EvidenceRef;
      capabilityId?: DataExtractionEvidenceItemRecord["capabilityId"];
      method?: DataExtractionEvidenceItemRecord["provenance"]["captureMethodClass"];
      parentEvidenceRefs?: readonly EvidenceRef[];
      contract?: string;
      sourceClass?: DataExtractionEvidenceItemRecord["sourceClass"];
      resourceType?: DataExtractionEvidenceItemRecord["resourceType"];
    }> = {},
  ): DataExtractionEvidenceItemRecord {
    const evidenceRef =
      options.evidenceRef ?? asEvidenceRef(`evidence:c3-r0:${randomUUID()}`);
    const contract = options.contract ?? "c3-r0-fixture-v1";
    return {
      brandId,
      evidenceRef,
      capabilityId: options.capabilityId ?? "instagram.media_inventory",
      normalizationContractVersion: contract,
      resourceRef,
      captureRef,
      sourceClass: options.sourceClass ?? "INSTAGRAM_OWNED",
      resourceType: options.resourceType ?? "INSTAGRAM_MEDIA",
      ...(options.sourceClass === "OWNED_WEBSITE"
        ? { pageRole: "HOMEPAGE" as const }
        : {}),
      capturedAt: "2026-09-12T08:00:01.000Z",
      freshnessAtEmission: {
        state: "CURRENT",
        basis: "C3_R0_DETERMINISTIC_FIXTURE",
        evaluatedAt: "2026-09-12T08:00:02.000Z",
      },
      representativeness: "CONTEXT_SPECIFIC",
      coverageSnapshot: "SINGLE_RESOURCE",
      qualitySnapshot: completeQuality,
      provenance: {
        acquisitionOrNormalizationRunRef: `run:c3-r0:${randomUUID()}`,
        captureMethodClass: options.method ?? "PROVIDER_MEDIATED_FETCH",
        normalizationContractVersion: contract,
        parentEvidenceRefs: options.parentEvidenceRefs ?? [],
        parentCaptureRefs: [],
      },
      deduplication: {
        itemFingerprint: `fingerprint:${randomUUID()}`,
        repetitionCount: 1,
        supportingResourceRefs: [resourceRef],
      },
      boundedNormalizedPayload: { fixture: "c3-r0" },
      contentHash: randomUUID().replaceAll("-", ""),
      relationshipRefs: [],
    };
  }

  function expectCode(
    promise: Promise<unknown>,
    code: DataExtractionPersistenceError["code"],
  ) {
    return expect(promise).rejects.toMatchObject({
      name: "DataExtractionPersistenceError",
      code,
    });
  }

  it("round-trips all explicit capture methods and preserves legacy null fallback", async () => {
    const brandId = await brand("methods");
    const resourceRef = await resource(brandId);
    const captureRef = await capture(brandId, resourceRef);
    const methods = [
      "DIRECT_FETCH",
      "RENDERED_FETCH",
      "PROVIDER_MEDIATED_FETCH",
      "DETERMINISTIC_DERIVATION",
      "MODEL_DERIVATION",
    ] as const;
    const explicit: DataExtractionEvidenceItemRecord[] = [];
    for (const method of methods) {
      const inserted = await persistence
        .repositories()
        .evidenceItems.insertOrGetExact(
          evidence(brandId, resourceRef, captureRef, { method }),
        );
      expect(inserted.provenance.captureMethodClass).toBe(method);
      explicit.push(inserted);
    }

    const legacy = evidence(brandId, resourceRef, captureRef, {
      contract: "legacy-contract-v1",
    });
    await prisma.dataExtractionEvidenceItem.create({
      data: {
        evidenceRef: legacy.evidenceRef,
        brandId,
        capabilityId: legacy.capabilityId,
        normalizationContractVersion: legacy.normalizationContractVersion,
        resourceRef,
        captureRef,
        boundedPayload: {
          supportingEvidenceRefs: [explicit[0]!.evidenceRef],
        },
        contentHash: legacy.contentHash,
        representativeness: legacy.representativeness,
        coverageSnapshot: legacy.coverageSnapshot,
        freshnessAtEmission: legacy.freshnessAtEmission.state,
        freshnessBasis: legacy.freshnessAtEmission.basis,
        freshnessEvaluatedAt: new Date(legacy.freshnessAtEmission.evaluatedAt),
        qualitySnapshot: legacy.qualitySnapshot.state,
        itemFingerprint: legacy.deduplication.itemFingerprint,
      },
    });
    const hydrated = await persistence
      .repositories()
      .evidenceItems.findByRef(brandId, legacy.evidenceRef);
    expect(hydrated?.provenance.captureMethodClass).toBe("DIRECT_FETCH");
    expect(hydrated?.provenance.parentEvidenceRefs).toEqual([
      explicit[0]!.evidenceRef,
    ]);
    expect(hydrated?.provenance.parentCaptureRefs).toEqual([captureRef]);
  });

  it("persists cross-capability parent lineage while support stays same-capability", async () => {
    const brandId = await brand("lineage");
    const resourceRef = await resource(brandId);
    const captureRef = await capture(brandId, resourceRef);
    const source = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(
        evidence(brandId, resourceRef, captureRef),
      );
    const c2 = await persistence.repositories().evidenceItems.insertOrGetExact(
      evidence(brandId, resourceRef, captureRef, {
        method: "DETERMINISTIC_DERIVATION",
        contract: "instagram-c2-deterministic-foundations-v1",
        parentEvidenceRefs: [source.evidenceRef],
      }),
    );
    const targetRecord = evidence(brandId, resourceRef, captureRef, {
      capabilityId: "instagram.media_creator_signals",
      method: "MODEL_DERIVATION",
      parentEvidenceRefs: [c2.evidenceRef, source.evidenceRef, c2.evidenceRef],
    });
    const target = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(targetRecord);
    const fresh = await new DataExtractionPersistenceService(prisma)
      .repositories()
      .evidenceItems.findByRef(brandId, target.evidenceRef);
    expect(c2.provenance.captureMethodClass).toBe("DETERMINISTIC_DERIVATION");
    expect(fresh?.provenance).toMatchObject({
      captureMethodClass: "MODEL_DERIVATION",
      parentEvidenceRefs: [c2.evidenceRef, source.evidenceRef].sort(),
      parentCaptureRefs: [captureRef],
    });

    const observationKey = asSemanticObservationKey(
      `observation:c3-r0:${randomUUID()}`,
    );
    const observations = persistence.repositories().semanticObservations;
    await observations.createOrGet(
      brandId,
      observationKey,
      "instagram.media_creator_signals",
    );
    await observations.attachSupport(
      brandId,
      observationKey,
      target.evidenceRef,
    );
    await expectCode(
      observations.attachSupport(brandId, observationKey, source.evidenceRef),
      "PERSISTENCE_INVARIANT",
    );

    const beforeReplay = {
      evidence: await prisma.dataExtractionEvidenceItem.count({
        where: { brandId },
      }),
      support: await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    };
    const replay = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(targetRecord);
    await observations.attachSupport(
      brandId,
      observationKey,
      replay.evidenceRef,
    );
    expect(replay.provenance).toEqual(target.provenance);
    await expectCode(
      persistence.repositories().evidenceItems.insertOrGetExact({
        ...targetRecord,
        provenance: {
          ...targetRecord.provenance,
          captureMethodClass: "DETERMINISTIC_DERIVATION",
        },
      }),
      "IDEMPOTENCY_CONFLICT",
    );
    await expectCode(
      persistence.repositories().evidenceItems.insertOrGetExact({
        ...targetRecord,
        provenance: {
          ...targetRecord.provenance,
          parentEvidenceRefs: [source.evidenceRef],
        },
      }),
      "IDEMPOTENCY_CONFLICT",
    );
    expect({
      evidence: await prisma.dataExtractionEvidenceItem.count({
        where: { brandId },
      }),
      support: await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    }).toEqual(beforeReplay);
  });

  it("rejects missing, self, cross-Brand, running, and failed lineage atomically", async () => {
    const brandId = await brand("invalid");
    const otherBrandId = await brand("other");
    const resourceRef = await resource(brandId);
    const captureRef = await capture(brandId, resourceRef);
    const otherResourceRef = await resource(otherBrandId);
    const otherCaptureRef = await capture(otherBrandId, otherResourceRef);
    const otherEvidence = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(
        evidence(otherBrandId, otherResourceRef, otherCaptureRef),
      );
    const baseline = await prisma.dataExtractionEvidenceItem.count({
      where: { brandId },
    });

    const missing = evidence(brandId, resourceRef, captureRef, {
      method: "MODEL_DERIVATION",
      parentEvidenceRefs: [asEvidenceRef(`evidence:missing:${randomUUID()}`)],
    });
    await expectCode(
      persistence.repositories().evidenceItems.insertOrGetExact(missing),
      "EVIDENCE_NOT_FOUND",
    );
    const selfRef = asEvidenceRef(`evidence:self:${randomUUID()}`);
    const self = evidence(brandId, resourceRef, captureRef, {
      evidenceRef: selfRef,
      method: "MODEL_DERIVATION",
      parentEvidenceRefs: [selfRef],
    });
    await expectCode(
      persistence.repositories().evidenceItems.insertOrGetExact(self),
      "PERSISTENCE_INVARIANT",
    );
    await expectCode(
      persistence.repositories().evidenceItems.insertOrGetExact(
        evidence(brandId, resourceRef, captureRef, {
          method: "MODEL_DERIVATION",
          parentEvidenceRefs: [otherEvidence.evidenceRef],
        }),
      ),
      "TENANCY_VIOLATION",
    );

    for (const terminal of ["RUNNING", "FAILED"] as const) {
      const invalidCapture = await capture(brandId, resourceRef, terminal);
      await expectCode(
        persistence
          .repositories()
          .evidenceItems.insertOrGetExact(
            evidence(brandId, resourceRef, invalidCapture),
          ),
        "PERSISTENCE_INVARIANT",
      );
    }
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(baseline);

    for (const terminal of ["RUNNING", "FAILED"] as const) {
      const invalidCapture = await capture(brandId, resourceRef, terminal);
      const invalidParentRef = asEvidenceRef(
        `evidence:invalid-parent:${randomUUID()}`,
      );
      await prisma.dataExtractionEvidenceItem.create({
        data: {
          evidenceRef: invalidParentRef,
          brandId,
          capabilityId: "instagram.media_inventory",
          normalizationContractVersion: "c3-r0-invalid-parent-fixture-v1",
          resourceRef,
          captureRef: invalidCapture,
          contentHash: randomUUID().replaceAll("-", ""),
          representativeness: "CONTEXT_SPECIFIC",
          coverageSnapshot: "SINGLE_RESOURCE",
          freshnessAtEmission: "UNKNOWN",
          freshnessBasis: "invalid parent fixture",
          freshnessEvaluatedAt: new Date("2026-09-12T08:00:02.000Z"),
          qualitySnapshot: "UNAVAILABLE",
          captureMethodClass: "PROVIDER_MEDIATED_FETCH",
          itemFingerprint: `fingerprint:${randomUUID()}`,
        },
      });
      const child = evidence(brandId, resourceRef, captureRef, {
        method: "MODEL_DERIVATION",
        parentEvidenceRefs: [invalidParentRef],
      });
      await expectCode(
        persistence.repositories().evidenceItems.insertOrGetExact(child),
        "PERSISTENCE_INVARIANT",
      );
      expect(
        await prisma.dataExtractionEvidenceItem.findUnique({
          where: { evidenceRef: child.evidenceRef },
        }),
      ).toBeNull();
    }
  });

  it("Settings deletion removes derived Instagram lineage and preserves other sources and Brands", async () => {
    const brandId = await brand("delete");
    const otherBrandId = await brand("delete-other");
    const instagramResource = await resource(brandId);
    const instagramCapture = await capture(brandId, instagramResource);
    const source = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(
        evidence(brandId, instagramResource, instagramCapture),
      );
    await persistence.repositories().evidenceItems.insertOrGetExact(
      evidence(brandId, instagramResource, instagramCapture, {
        capabilityId: "instagram.media_creator_signals",
        method: "MODEL_DERIVATION",
        parentEvidenceRefs: [source.evidenceRef],
      }),
    );

    const websiteResource = await resource(brandId, "OWNED_WEBSITE");
    const websiteCapture = await capture(brandId, websiteResource);
    const website = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(
        evidence(brandId, websiteResource, websiteCapture, {
          capabilityId: "owned_website.brand_messaging",
          method: "DIRECT_FETCH",
          sourceClass: "OWNED_WEBSITE",
          resourceType: "OWNED_WEB_PAGE",
        }),
      );
    const otherResource = await resource(otherBrandId);
    const otherCapture = await capture(otherBrandId, otherResource);
    const other = await persistence
      .repositories()
      .evidenceItems.insertOrGetExact(
        evidence(otherBrandId, otherResource, otherCapture),
      );

    const purge = new InstagramDerivedDataPurgeService({
      purgeScope: async () => 0,
    } as never);
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, brandId),
    );

    expect(
      await prisma.dataExtractionEvidenceItem.count({
        where: { brandId, capabilityId: { startsWith: "instagram." } },
      }),
    ).toBe(0);
    expect(
      await persistence
        .repositories()
        .evidenceItems.findByRef(brandId, website.evidenceRef),
    ).not.toBeNull();
    expect(
      await persistence
        .repositories()
        .evidenceItems.findByRef(otherBrandId, other.evidenceRef),
    ).not.toBeNull();
  });
});
