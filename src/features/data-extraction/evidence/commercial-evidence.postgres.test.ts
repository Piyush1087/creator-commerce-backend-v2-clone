import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisitionMechanics,
} from "./acquisition/owned-website-wave1-acquisition.service";
import { asBrandId, type BrandId } from "./domain/evidence-identities";
import { DATA_EXTRACTION_EVIDENCE_CAPABILITIES } from "./domain/evidence-vocabulary";
import { DataExtractionIntelligenceEvidenceAdapter } from "./intelligence/data-extraction-intelligence-evidence.adapter";
import { OwnedWebsiteWave1NormalizationService } from "./normalization/owned-website-wave1-normalization.service";
import { commercialEvidenceSchema } from "./normalization/wave2/wave2-evidence-contracts";
import { DataExtractionPersistenceError } from "./persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "./persistence/prisma-evidence-repositories";
import { DataExtractionEvidenceQueryService } from "./query/data-extraction-evidence-query.service";

const databaseUrl = process.env.DE_P2B2_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const database = databaseUrl ? describe : describe.skip;

describe("P2B-2 additive migration shape", () => {
  it("only replaces the seven capability checks with the ten-ID allow-list", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260828120000_data_extraction_offering_commercial_evidence/migration.sql",
      ),
      "utf8",
    );
    expect(sql.match(/DROP CONSTRAINT/g)).toHaveLength(7);
    expect(sql.match(/ADD CONSTRAINT/g)).toHaveLength(7);
    expect(sql).not.toMatch(
      /CREATE TABLE|ADD COLUMN|CREATE TYPE|UPDATE |INSERT |DELETE |TRUNCATE|DROP TABLE|DROP COLUMN/i,
    );
    const checks = [
      ...sql.matchAll(/CHECK \("capability_id" IN \(([\s\S]*?)\)\)/g),
    ];
    expect(checks).toHaveLength(7);
    for (const check of checks)
      expect(
        [...check[1].matchAll(/'([^']+)'/g)].map((match) => match[1]),
      ).toEqual(DATA_EXTRACTION_EVIDENCE_CAPABILITIES);
  });
});

class CommercialMechanics implements OwnedWebsitePageAcquisitionMechanics {
  readonly calls: string[] = [];

  async acquire(url: string) {
    this.calls.push(url);
    const path = new URL(url).pathname;
    const details = path.endsWith("offering-a")
      ? { htmlPrice: 999, structuredPrice: 1099 }
      : path.endsWith("offering-b")
        ? { htmlPrice: 1299, structuredPrice: 1299 }
        : null;
    const json = details
      ? `<script type="application/ld+json">${JSON.stringify({
          "@type": "Product",
          offers: {
            "@type": "Offer",
            price: String(details.structuredPrice),
            priceCurrency: "INR",
          },
        })}</script>`
      : "";
    const body = details
      ? `<main><p>Price: INR ${details.htmlPrice}.</p></main>${json}`
      : '<main><a href="/products/offering-a">Offering A</a></main>';
    return {
      url,
      html: body,
      cleanText: details ? `Price: INR ${details.htmlPrice}.` : "Offering A",
      internalLinks: details
        ? []
        : [new URL("/products/offering-a", url).toString()],
      quality: {
        state: "COMPLETE" as const,
        failureCategories: [],
        detailCodes: [],
      },
      attempts: [
        {
          providerExecutionRef: `provider-execution:${randomUUID()}`,
          attemptRole: "PRIMARY" as const,
        },
      ],
      reasonCodes: [],
    };
  }
}

database("P2B-2 exact Offering commercial Evidence PostgreSQL slice", () => {
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

  async function brand(label: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `p2b2-${label}-${randomUUID()}.example`,
        name: `P2B-2 ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }

  async function offering(brandId: BrandId, name: string, path: string) {
    return prisma.offering.create({
      data: {
        brandProfileId: brandId,
        type: "PRODUCT",
        name,
        url: `https://commercial.example${path}`,
        locationIds: [],
        sellingPoints: [],
        doNotSay: [],
      },
    });
  }

  async function run(
    brandId: BrandId,
    canonicalOfferingRef: string,
    path: string,
    mechanics = new CommercialMechanics(),
  ) {
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics,
    );
    const acquired = await acquisition.request({
      brandId,
      capabilityId: "owned_website.offering_commercial_evidence",
      requestKey: `p2b2:${randomUUID()}`,
      normalizationContractVersion: "1.0",
      freshnessIntent: "REUSE_ALLOWED",
      ownedWebsiteRoot: "https://commercial.example/",
      exactOfferingScope: {
        canonicalOfferingRef,
        resourceUrls: [`https://commercial.example${path}`],
      },
    });
    const exact = acquired.exactOfferingResources![0]!;
    const completed = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
      exactOfferingScope: {
        canonicalOfferingRef,
        captureRefs: [exact.captureRef],
      },
    });
    return { acquired, exact, completed, mechanics };
  }

  it("persists both conflicting tuples with exact lineage and no canonical price winner", async () => {
    const brandId = await brand("vertical");
    const a = await offering(brandId, "Offering A", "/products/offering-a");
    const b = await offering(brandId, "Offering B", "/products/offering-b");
    const priceBefore = await prisma.offeringPriceState.findUnique({
      where: { offeringId: a.id },
    });
    const first = await run(brandId, a.id, "/products/offering-a");
    await run(brandId, b.id, "/products/offering-b");

    const read = await adapter.read({
      brandId,
      processorId: "p2b2-commercial-fixture",
      processorVersion: "1.0",
      capabilityIds: ["owned_website.offering_commercial_evidence"],
      exactOfferingScope: { canonicalOfferingRef: a.id },
    });
    const capability = read.capabilityResults[0]!;
    expect(capability.evidence).toHaveLength(2);
    const payloads = capability.evidence.map((item) =>
      commercialEvidenceSchema.parse(item.boundedNormalizedPayload),
    );
    expect(
      payloads
        .map((payload) => payload.current_min_amount)
        .sort((left, right) => (left ?? 0) - (right ?? 0)),
    ).toEqual([999, 1099]);
    expect(
      payloads.map((payload) => payload.observation_source).sort(),
    ).toEqual(["HTML", "JSON_LD"]);
    expect(
      payloads.every((payload) => payload.canonical_offering_ref === a.id),
    ).toBe(true);
    expect(
      capability.evidence.every(
        (item) =>
          item.resourceRef === first.exact.resourceRef &&
          item.captureRef === first.exact.captureRef &&
          item.capabilityExecutionRefs?.includes(
            first.acquired.capabilityExecutionRef,
          ) &&
          item.freshness.state === "CURRENT" &&
          Boolean(item.conflictGroupRef),
      ),
    ).toBe(true);
    expect(JSON.stringify(read)).not.toContain(b.id);
    expect(
      await prisma.offeringPriceState.findUnique({
        where: { offeringId: a.id },
      }),
    ).toEqual(priceBefore);
    expect(
      await prisma.offeringPriceRevision.count({
        where: { offeringId: a.id },
      }),
    ).toBe(0);
  }, 30_000);

  it("rejects broad execution and cross-Brand Offering ownership", async () => {
    const brandA = await brand("tenant-a");
    const brandB = await brand("tenant-b");
    const foreign = await offering(
      brandB,
      "Foreign Offering",
      "/products/offering-b",
    );
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      new CommercialMechanics(),
    );
    await expect(
      acquisition.request({
        brandId: brandA,
        capabilityId: "owned_website.offering_commercial_evidence",
        requestKey: `p2b2:broad:${randomUUID()}`,
        normalizationContractVersion: "1.0",
        freshnessIntent: "REUSE_ALLOWED",
        ownedWebsiteRoot: "https://commercial.example/",
      }),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({
      code: "PERSISTENCE_INVARIANT",
    });
    await expect(
      acquisition.request({
        brandId: brandA,
        capabilityId: "owned_website.offering_commercial_evidence",
        requestKey: `p2b2:foreign:${randomUUID()}`,
        normalizationContractVersion: "1.0",
        freshnessIntent: "REUSE_ALLOWED",
        ownedWebsiteRoot: "https://commercial.example/",
        exactOfferingScope: {
          canonicalOfferingRef: foreign.id,
          resourceUrls: ["https://commercial.example/products/offering-b"],
        },
      }),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({
      code: "PERSISTENCE_INVARIANT",
    });
  });
});
