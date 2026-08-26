import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { EvidenceManifestBuilder } from "../../../../brand-intelligence/input/evidence/evidence-manifest";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisitionMechanics,
} from "../../acquisition/owned-website-wave1-acquisition.service";
import {
  asBrandId,
  asEvidenceRef,
  type BrandId,
} from "../../domain/evidence-identities";
import {
  WAVE2_EVIDENCE_CAPABILITIES,
  type EvidenceCapabilityId,
} from "../../domain/evidence-vocabulary";
import { DataExtractionIntelligenceEvidenceAdapter } from "../../intelligence/data-extraction-intelligence-evidence.adapter";
import { DataExtractionPersistenceService } from "../../persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "../../query/data-extraction-evidence-query.service";
import { OwnedWebsiteWave1NormalizationService } from "../owned-website-wave1-normalization.service";
import {
  proofEvidenceSchema,
  visualEvidenceSchema,
  serviceabilityEvidenceSchema,
  locationEvidenceSchema,
} from "./wave2-evidence-contracts";

const databaseUrl = process.env.DE_W2_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;
class Mechanics implements OwnedWebsitePageAcquisitionMechanics {
  calls: string[] = [];
  empty = false;
  fail = false;
  failedPath = "";
  state: "COMPLETE" | "PARTIAL" | "DEGRADED" = "COMPLETE";
  async acquire(url: string) {
    this.calls.push(url);
    const path = new URL(url).pathname;
    const failed = this.fail || path === this.failedPath;
    const links =
      path === "/" && !this.empty
        ? ["/about", "/products", "/shipping", "/locations"].map((p) =>
            new URL(p, url).toString(),
          )
        : [];
    const text = this.empty
      ? "<p>Welcome to our website.</p>"
      : path === "/shipping"
        ? "<p>We ship worldwide.</p><p>We do not ship to India.</p><p>Only available in Delhi NCR.</p>"
        : path === "/locations"
          ? "<address>Central Clinic, 10 Main St, Delhi 110001</address><address>Central Clinic, 10 Main St, Delhi 110001</address><address>West Clinic, 20 Main St</address>"
          : path === "/products"
            ? '<div data-offering="premium"><p>Our product is certified for commercial use.</p></div>'
            : "<p>We were founded in 2001.</p><p>We were founded in 2010.</p><p>We are the leading brand.</p><p>Our treatment cures diabetes.</p><p>We help teams grow with clear information.</p>";
    const html = `<html><head>${this.empty ? "" : "<style>body { color: #112233; font-family: Inter; display: grid; }</style>"}</head><body>${text}${links.map((link) => `<a href="${link}">Read more</a>`).join("")}</body></html>`;
    return {
      url,
      ...(failed ? {} : { html, cleanText: text.replace(/<[^>]*>/g, " ") }),
      internalLinks: links,
      quality: {
        state: failed ? ("UNAVAILABLE" as const) : this.state,
        failureCategories: failed ? ["RESOURCE_UNAVAILABLE"] : [],
        detailCodes: [],
      },
      attempts: [
        {
          providerExecutionRef: `provider-execution:${randomUUID()}`,
          attemptRole: "PRIMARY" as const,
        },
      ],
      reasonCodes: failed ? ["NO_USABLE_CONTENT"] : [],
    };
  }
}

database("DE-W2 durable capability vertical slice", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);
  const normalization = new OwnedWebsiteWave1NormalizationService(
    persistence,
    prisma,
  );
  const adapter = new DataExtractionIntelligenceEvidenceAdapter(
    new DataExtractionEvidenceQueryService(persistence),
  );
  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());
  async function brand() {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `w2-${randomUUID()}.example`,
        name: "Wave 2 test",
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }
  const request = (brandId: BrandId, capabilityId: EvidenceCapabilityId) => ({
    brandId,
    capabilityId,
    requestKey: randomUUID(),
    normalizationContractVersion: "1.0",
    freshnessIntent: "REUSE_ALLOWED" as const,
    ownedWebsiteRoot: "https://w2.example/",
  });
  const read = (
    brandId: BrandId,
    capabilityIds: readonly EvidenceCapabilityId[] = WAVE2_EVIDENCE_CAPABILITIES,
  ) =>
    adapter.read({
      brandId,
      processorId: "de-w2-regression",
      processorVersion: "1.0",
      capabilityIds,
    });
  async function run(
    brandId: BrandId,
    mechanics: Mechanics,
    capabilityId: EvidenceCapabilityId,
  ) {
    const acquired = await new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics,
    ).request(request(brandId, capabilityId));
    const completed = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });
    return { acquired, completed };
  }
  it("normalizes all four through D/E/F with real execution, capture, content, evidence and manifest lineage", async () => {
    const brandId = await brand();
    const mechanics = new Mechanics();
    // W1 retained captures are the first source for W2, not a second acquisition platform.
    await run(brandId, mechanics, "owned_website.brand_messaging");
    const callsBefore = mechanics.calls.length;
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics,
    );
    const pending = await acquisition.request(
      request(brandId, WAVE2_EVIDENCE_CAPABILITIES[0]),
    );
    expect(mechanics.calls.length).toBe(callsBefore);
    const absent = (await read(brandId, [WAVE2_EVIDENCE_CAPABILITIES[0]]))
      .capabilityResults[0];
    expect(absent).toMatchObject({
      status: "NOT_REQUESTED",
      capabilityExecutionRef: null,
      evidence: [],
    });
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: pending.capabilityExecutionRef,
    });
    for (const capabilityId of WAVE2_EVIDENCE_CAPABILITIES.slice(1))
      await run(brandId, mechanics, capabilityId);
    const result = await read(brandId);
    expect(result.capabilityResults.map((c) => c.status)).toEqual([
      "AVAILABLE",
      "PARTIAL",
      "AVAILABLE",
      "AVAILABLE",
    ]);
    for (const capability of result.capabilityResults) {
      expect(capability.evidence.length).toBeGreaterThan(0);
      const execution = await persistence
        .repositories()
        .capabilityExecutions.findByRef(
          brandId,
          capability.capabilityExecutionRef as never,
        );
      expect(execution?.completedAt).toBeTruthy();
      for (const item of capability.evidence) {
        expect(
          new Set([
            item.resourceRef,
            item.captureRef,
            item.evidenceRef,
            capability.capabilityExecutionRef,
            item.provenance.providerExecutionRef,
          ]).size,
        ).toBe(5);
        expect(item.provenance.parentCaptureRefs).toContain(item.captureRef);
        expect(item.freshness.state).toBe("CURRENT");
        const stored = await persistence
          .repositories()
          .evidenceItems.findByRef(brandId, item.evidenceRef as never);
        expect(stored?.boundedNormalizedPayload).toEqual(
          item.boundedNormalizedPayload,
        );
        expect(stored?.normalizedContentRef).toBeTruthy();
      }
    }
    result.capabilityResults[0].evidence.forEach((e) =>
      proofEvidenceSchema.parse(e.boundedNormalizedPayload),
    );
    result.capabilityResults[1].evidence.forEach((e) =>
      visualEvidenceSchema.parse(e.boundedNormalizedPayload),
    );
    result.capabilityResults[2].evidence.forEach((e) =>
      serviceabilityEvidenceSchema.parse(e.boundedNormalizedPayload),
    );
    result.capabilityResults[3].evidence.forEach((e) =>
      locationEvidenceSchema.parse(e.boundedNormalizedPayload),
    );
    expect(
      result.capabilityResults[0].evidence.some((e) => e.conflictGroupRef),
    ).toBe(true);
    expect(
      result.capabilityResults[2].evidence.some((e) => e.conflictGroupRef),
    ).toBe(true);
    expect(result.capabilityResults[3].evidence).toHaveLength(3);
    const manifest = new EvidenceManifestBuilder().build(
      result,
      WAVE2_EVIDENCE_CAPABILITIES,
    );
    expect(manifest.hash).toBe(
      new EvidenceManifestBuilder().build(
        await read(brandId),
        WAVE2_EVIDENCE_CAPABILITIES,
      ).hash,
    );
    expect(JSON.stringify(manifest.manifest)).not.toContain(
      "boundedNormalizedPayload",
    );
    expect(mechanics.calls.length).toBeLessThanOrEqual(5);
  });
  it("replays the same execution and reuses captures for a new request without synthetic lineage", async () => {
    const brandId = await brand();
    const mechanics = new Mechanics();
    const first = await run(brandId, mechanics, WAVE2_EVIDENCE_CAPABILITIES[0]);
    const replay = await normalization.normalize({
      brandId,
      capabilityExecutionRef: first.acquired.capabilityExecutionRef,
    });
    expect(replay.evidenceRefs).toEqual(first.completed.evidenceRefs);
    const calls = mechanics.calls.length;
    const second = await run(
      brandId,
      mechanics,
      WAVE2_EVIDENCE_CAPABILITIES[0],
    );
    expect(second.acquired.capabilityExecutionRef).not.toBe(
      first.acquired.capabilityExecutionRef,
    );
    expect(second.completed.evidenceRefs).toEqual(first.completed.evidenceRefs);
    expect(mechanics.calls).toHaveLength(calls);
  });
  it.each(
    WAVE2_EVIDENCE_CAPABILITIES.filter(
      (c) => c !== "owned_website.visual_evidence",
    ),
  )(
    "persists AVAILABLE + [] without negative evidence for %s",
    async (capability) => {
      const brandId = await brand();
      const mechanics = new Mechanics();
      mechanics.empty = true;
      const result = await run(brandId, mechanics, capability);
      expect(result.completed).toMatchObject({
        availability: "AVAILABLE",
        evidenceRefs: [],
      });
      expect(
        (await read(brandId, [capability])).capabilityResults[0],
      ).toMatchObject({
        capabilityExecutionRef: result.acquired.capabilityExecutionRef,
        status: "AVAILABLE",
        evidence: [],
      });
    },
  );
  it("keeps unavailable visual coverage and failed acquisition honest", async () => {
    const brandId = await brand();
    const mechanics = new Mechanics();
    mechanics.empty = true;
    expect(
      (await run(brandId, mechanics, "owned_website.visual_evidence")).completed
        .availability,
    ).toBe("UNAVAILABLE");
    const failedBrand = await brand();
    mechanics.fail = true;
    for (const capability of WAVE2_EVIDENCE_CAPABILITIES) {
      expect(
        (await run(failedBrand, mechanics, capability)).completed,
      ).toMatchObject({ availability: "UNAVAILABLE", evidenceRefs: [] });
    }
  });
  it.each(["PARTIAL", "DEGRADED"] as const)(
    "preserves %s acquisition without inventing proof",
    async (state) => {
      const brandId = await brand();
      const mechanics = new Mechanics();
      mechanics.state = state;
      await run(brandId, mechanics, WAVE2_EVIDENCE_CAPABILITIES[0]);
      const result = (await read(brandId, [WAVE2_EVIDENCE_CAPABILITIES[0]]))
        .capabilityResults[0];
      expect(result.status).toBe(state);
      expect(
        result.evidence.every((e) => e.acquisitionQuality.state === state),
      ).toBe(true);
      expect(
        result.evidence.find(
          (e) =>
            proofEvidenceSchema.parse(e.boundedNormalizedPayload).statement ===
            "Our treatment cures diabetes.",
        )?.boundedNormalizedPayload,
      ).toMatchObject({ proof_strength: "FIRST_PARTY_CLAIM" });
    },
  );
  it("keeps missing selected pages partial", async () => {
    const brandId = await brand();
    const mechanics = new Mechanics();
    mechanics.failedPath = "/shipping";
    const result = await run(
      brandId,
      mechanics,
      "owned_website.serviceability_evidence",
    );
    expect(result.completed.availability).toBe("PARTIAL");
  });
  it("preserves capture freshness at emission independently from capability availability", async () => {
    const brandId = await brand();
    const acquired = await new OwnedWebsiteWave1AcquisitionService(
      persistence,
      new Mechanics(),
    ).request(request(brandId, WAVE2_EVIDENCE_CAPABILITIES[0]));
    for (const captureRef of acquired.captureRefs ?? []) {
      await persistence.repositories().freshnessAssessments.record({
        brandId,
        targetType: "CAPTURE",
        targetRef: captureRef,
        state: "POSSIBLY_STALE",
        evaluatedAt: new Date().toISOString(),
        basis: "EXPLICIT_INVALIDATION",
      });
    }
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });
    const current = (await read(brandId, [WAVE2_EVIDENCE_CAPABILITIES[0]]))
      .capabilityResults[0];
    expect(current.status).toBe("AVAILABLE");
    expect(current.evidence.length).toBeGreaterThan(0);
    expect(
      current.evidence.every((e) => e.freshness.state === "POSSIBLY_STALE"),
    ).toBe(true);
  });
  it("keeps historical Location observations when a forced recapture omits them", async () => {
    const brandId = await brand();
    const mechanics = new Mechanics();
    const first = await run(
      brandId,
      mechanics,
      "owned_website.location_evidence",
    );
    const before = (await read(brandId, ["owned_website.location_evidence"]))
      .capabilityResults[0].evidence;
    mechanics.empty = true;
    const acquired = await new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics,
    ).request({
      ...request(brandId, "owned_website.location_evidence"),
      freshnessIntent: "FORCE_RECAPTURE",
    });
    const completed = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });
    expect(completed).toMatchObject({
      availability: "AVAILABLE",
      evidenceRefs: [],
    });
    expect(acquired.capabilityExecutionRef).not.toBe(
      first.acquired.capabilityExecutionRef,
    );
    expect(
      acquired.captureRefs?.some((ref) =>
        first.acquired.captureRefs?.includes(ref),
      ),
    ).toBe(false);
    for (const item of before) {
      expect(
        await persistence
          .repositories()
          .evidenceItems.findByRef(brandId, asEvidenceRef(item.evidenceRef)),
      ).not.toBeNull();
    }
    expect(
      (await read(brandId, ["owned_website.location_evidence"]))
        .capabilityResults[0].evidence,
    ).toEqual([]);
  });
  it("does not mutate canonical state, Preview, BI or Offering and only carries supplied same-Brand Location refs", async () => {
    const brandId = await brand();
    const canonical = await prisma.location.create({
      data: {
        brandProfileId: brandId,
        name: "Protected clinic",
        address: "Application address",
        authority: "BRAND_CONFIRMED",
      },
    });
    const snapshot = async () => ({
      profile: await prisma.brandProfile.findUnique({ where: { id: brandId } }),
      locations: await prisma.location.findMany({
        where: { brandProfileId: brandId },
      }),
      visual: await prisma.brandVisualState.findMany({
        where: { brandProfileId: brandId },
        include: { assets: true, colors: true, typography: true },
      }),
      offering: await prisma.offering.findMany({
        where: { brandProfileId: brandId },
      }),
      preview: await prisma.brandPreviewRun.count({
        where: { brandProfileId: brandId },
      }),
      intelligence: await prisma.intelligenceObjectGeneration.count({
        where: { brandId },
      }),
    });
    const before = await snapshot();
    const mechanics = new Mechanics();
    for (const capability of WAVE2_EVIDENCE_CAPABILITIES.slice(0, 3))
      await run(brandId, mechanics, capability);
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics,
    );
    const acquired = await acquisition.request(
      request(brandId, "owned_website.location_evidence"),
    );
    const locationCapture = await prisma.dataExtractionCapture.findFirstOrThrow(
      {
        where: {
          brandId,
          resource: { canonicalUrl: "https://w2.example/locations" },
        },
      },
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
      locationReconciliations: [
        {
          captureRef: locationCapture.captureRef,
          sourceLocator: "address:0",
          canonicalLocationRef: canonical.id,
        },
      ],
    });
    const locations = (await read(brandId, ["owned_website.location_evidence"]))
      .capabilityResults[0].evidence;
    expect(
      locations.filter(
        (e) =>
          locationEvidenceSchema.parse(e.boundedNormalizedPayload)
            .canonical_location_ref === canonical.id,
      ),
    ).toHaveLength(1);
    expect(await snapshot()).toEqual(before);
    const anotherBrand = await brand();
    const another = await acquisition.request(
      request(anotherBrand, "owned_website.location_evidence"),
    );
    const anotherCapture = await prisma.dataExtractionCapture.findFirstOrThrow({
      where: {
        brandId: anotherBrand,
        resource: { canonicalUrl: "https://w2.example/locations" },
      },
    });
    await expect(
      normalization.normalize({
        brandId: anotherBrand,
        capabilityExecutionRef: another.capabilityExecutionRef,
        locationReconciliations: [
          {
            captureRef: anotherCapture.captureRef,
            sourceLocator: "address:0",
            canonicalLocationRef: canonical.id,
          },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (await read(anotherBrand)).capabilityResults.every(
        (c) => c.capabilityExecutionRef === null,
      ),
    ).toBe(true);
  });
});
