import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../../prisma/prisma.service";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
  type OwnedWebsitePageAcquisitionMechanics,
} from "../acquisition/owned-website-wave1-acquisition.service";
import { asBrandId, type BrandId } from "../domain/evidence-identities";
import { DataExtractionPersistenceError } from "../persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "../persistence/prisma-evidence-repositories";
import { OwnedWebsiteWave1NormalizationService } from "./owned-website-wave1-normalization.service";

const databaseUrl = process.env.DE_W1_0E_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class Wave1FakeMechanics implements OwnedWebsitePageAcquisitionMechanics {
  readonly calls: string[] = [];

  constructor(private readonly constrained = true) {}

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    this.calls.push(url);
    const path = new URL(url).pathname;
    const links =
      path === "/"
        ? [
            new URL("/about", url).toString(),
            new URL("/products", url).toString(),
          ]
        : [];
    const text =
      path === "/about"
        ? "We are a creator commerce platform serving independent brands. Our mission is to support creators with transparent partnerships."
        : path === "/products"
          ? "Starter plan for small teams. Pro plan for growing teams. Enterprise plan for larger organizations."
          : this.constrained
            ? "We help creators grow with better brand partnerships. Our mission is to never use guaranteed outcome claims in creator copy."
            : "We help creators grow with better brand partnerships. Our mission is to make creator partnerships simpler for brands.";
    const html = `<html lang="en"><body><main>${text}</main>${links
      .map((link) => `<a href="${link}">${link}</a>`)
      .join("")}</body></html>`;
    return {
      url,
      html,
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

describePostgres("DE-W1.0E durable normalization", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function brand(label: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `de-w1-0e-${label}-${randomUUID()}.example`,
        name: `DE W1.0E ${label}`,
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
      | "owned_website.brand_company_context"
      | "owned_website.offering_context"
      | "observed_brand_communication_language_signals"
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

  it("runs D → E, persists Evidence/membership/support and replays without duplication", async () => {
    const brandId = await brand("flow");
    const mechanics = new Wave1FakeMechanics();
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    const acquired = await acquisition.request(
      request(
        brandId,
        "https://wave-one.example/",
        "owned_website.brand_messaging",
      ),
    );
    const first = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });

    expect(first.availability).toBe("AVAILABLE");
    expect(first.evidenceRefs.length).toBeGreaterThan(0);
    expect(
      await prisma.dataExtractionCapabilityEvidence.count({
        where: {
          brandId,
          capabilityExecutionRef: acquired.capabilityExecutionRef,
        },
      }),
    ).toBe(first.evidenceRefs.length);
    expect(
      await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    ).toBeGreaterThan(0);

    const evidenceCount = await prisma.dataExtractionEvidenceItem.count({
      where: { brandId },
    });
    const supportCount = await prisma.dataExtractionObservationSupport.count({
      where: { brandId },
    });
    const second = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });
    expect(second.evidenceRefs).toEqual(first.evidenceRefs);
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(evidenceCount);
    expect(
      await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    ).toBe(supportCount);
  });

  it("reuses explicit D lineage across capabilities and emits contract-valid language Evidence with no new acquisition", async () => {
    const brandId = await brand("language");
    const mechanics = new Wave1FakeMechanics(false);
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    const root = "https://language-wave.example/";
    const messaging = await acquisition.request(
      request(brandId, root, "owned_website.brand_messaging"),
    );
    await normalization.normalize({
      brandId,
      capabilityExecutionRef: messaging.capabilityExecutionRef,
    });
    const callsAfterMessaging = mechanics.calls.length;

    const language = await acquisition.request(
      request(brandId, root, "observed_brand_communication_language_signals"),
    );
    expect(mechanics.calls.length).toBe(callsAfterMessaging);
    const result = await normalization.normalize({
      brandId,
      capabilityExecutionRef: language.capabilityExecutionRef,
    });
    expect(result.evidenceRefs.length).toBeGreaterThan(0);
    const rows = await prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId,
        capabilityId: "observed_brand_communication_language_signals",
      },
    });
    expect(
      rows.some((row) =>
        JSON.stringify(row.boundedPayload).includes(
          "PRINCIPAL_MESSAGING_LANGUAGE",
        ),
      ),
    ).toBe(true);
  });

  it("distinguishes usable-source no-constraint as AVAILABLE + []", async () => {
    const brandId = await brand("empty-constraint");
    const mechanics = new Wave1FakeMechanics(false);
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    const root = "https://empty-constraint.example/";
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
    const result = await normalization.normalize({
      brandId,
      capabilityExecutionRef: constraint.capabilityExecutionRef,
    });
    expect(result.availability).toBe("AVAILABLE");
    expect(result.evidenceRefs).toEqual([]);
  });

  it("rolls back the whole E semantic write if its caller-owned transaction fails", async () => {
    const brandId = await brand("rollback");
    const mechanics = new Wave1FakeMechanics();
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const acquired = await acquisition.request(
      request(
        brandId,
        "https://rollback-wave.example/",
        "owned_website.brand_messaging",
      ),
    );
    const original = persistence.withTransaction.bind(persistence);
    const spy = vi
      .spyOn(persistence, "withTransaction")
      .mockImplementation(async (operation) =>
        original(async (repositories) => {
          await operation(repositories);
          throw new Error("FORCED_E_ROLLBACK");
        }),
      );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    await expect(
      normalization.normalize({
        brandId,
        capabilityExecutionRef: acquired.capabilityExecutionRef,
      }),
    ).rejects.toThrow();
    spy.mockRestore();
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionCapabilityEvidence.count({
        where: { brandId },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    ).toBe(0);
  });

  it("rejects cross-Brand normalization of another Brand's execution", async () => {
    const brandA = await brand("tenant-a");
    const brandB = await brand("tenant-b");
    const mechanics = new Wave1FakeMechanics();
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const acquired = await acquisition.request(
      request(
        brandA,
        "https://tenant-wave.example/",
        "owned_website.brand_messaging",
      ),
    );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    await expect(
      normalization.normalize({
        brandId: brandB,
        capabilityExecutionRef: acquired.capabilityExecutionRef,
      }),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({
      code: "TENANCY_VIOLATION",
    });
  });
});
