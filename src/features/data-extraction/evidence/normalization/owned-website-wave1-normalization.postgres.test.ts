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
  failRoot = false;

  constructor(private readonly constrained = true) {}

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    this.calls.push(url);
    const path = new URL(url).pathname;
    if (this.failRoot && path === "/") {
      return {
        url,
        internalLinks: [],
        quality: {
          state: "UNAVAILABLE",
          failureCategories: ["RESOURCE_UNAVAILABLE"],
          detailCodes: ["FAKE_FAILURE"],
        },
        attempts: [
          {
            providerExecutionRef: `provider-execution:${randomUUID()}`,
            attemptRole: "PRIMARY",
          },
        ],
        reasonCodes: ["NO_USABLE_CONTENT"],
      };
    }
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
    const prepared =
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
      });
    expect(prepared.completedAt).toBeNull();
    expect(prepared.availability).toBe("NOT_REQUESTED");

    const first = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });

    expect(first.availability).toBe("AVAILABLE");
    expect(first.evidenceRefs.length).toBeGreaterThan(0);
    const terminal =
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
      });
    expect(terminal.capabilityExecutionRef).toBe(
      acquired.capabilityExecutionRef,
    );
    expect(terminal.completedAt).not.toBeNull();
    expect(terminal.availability).toBe("AVAILABLE");
    expect(terminal.retryability).toBe("NOT_APPLICABLE");
    expect(terminal.acquisitionQuality).toBe("COMPLETE");
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
    const callsAfterNormalization = mechanics.calls.length;
    const dReplay = await acquisition.request({
      ...request(
        brandId,
        "https://wave-one.example/",
        "owned_website.brand_messaging",
      ),
      requestKey: (
        await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
          where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
        })
      ).requestKey,
    });
    expect(dReplay.capabilityExecutionRef).toBe(
      acquired.capabilityExecutionRef,
    );
    expect(mechanics.calls.length).toBe(callsAfterNormalization);
    expect(
      (
        await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
          where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
        })
      ).completedAt?.toISOString(),
    ).toBe(terminal.completedAt?.toISOString());
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
    const terminal =
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: constraint.capabilityExecutionRef },
      });
    expect(terminal.availability).toBe("AVAILABLE");
    expect(terminal.completedAt).not.toBeNull();
    expect(
      await prisma.dataExtractionCapabilityEvidence.count({
        where: {
          brandId,
          capabilityExecutionRef: constraint.capabilityExecutionRef,
        },
      }),
    ).toBe(0);
  });

  it("returns D-terminal UNAVAILABLE without reopening it or creating Evidence", async () => {
    const brandId = await brand("unavailable");
    const mechanics = new Wave1FakeMechanics();
    mechanics.failRoot = true;
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
        "https://unavailable-wave.example/",
        "owned_website.brand_messaging",
      ),
    );
    const before =
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
      });
    expect(before.availability).toBe("UNAVAILABLE");
    expect(before.completedAt).not.toBeNull();

    const result = await normalization.normalize({
      brandId,
      capabilityExecutionRef: acquired.capabilityExecutionRef,
    });
    const after =
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
      });
    expect(result.availability).toBe("UNAVAILABLE");
    expect(result.evidenceRefs).toEqual([]);
    expect(after.completedAt?.toISOString()).toBe(
      before.completedAt?.toISOString(),
    );
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(0);
  });

  it("projects derived Evidence as SYSTEM_DERIVATION_INPUT without rewriting its owned-site Resource", async () => {
    const brandId = await brand("derived-source-class");
    const mechanics = new Wave1FakeMechanics(true);
    const acquisition = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const normalization = new OwnedWebsiteWave1NormalizationService(
      persistence,
      prisma,
    );
    const root = "https://derived-source-class.example/";
    const messaging = await acquisition.request(
      request(brandId, root, "owned_website.brand_messaging"),
    );
    const ordinaryResult = await normalization.normalize({
      brandId,
      capabilityExecutionRef: messaging.capabilityExecutionRef,
    });
    const ordinary = await persistence
      .repositories()
      .evidenceItems.findByRef(brandId, ordinaryResult.evidenceRefs[0]!);
    expect(ordinary?.sourceClass).toBe("OWNED_WEBSITE");

    const derived = await acquisition.request(
      request(brandId, root, "derived_communication_constraint_evidence"),
    );
    const derivedResult = await normalization.normalize({
      brandId,
      capabilityExecutionRef: derived.capabilityExecutionRef,
    });
    expect(derivedResult.evidenceRefs.length).toBeGreaterThan(0);
    const derivedEvidence = await persistence
      .repositories()
      .evidenceItems.findByRef(brandId, derivedResult.evidenceRefs[0]!);
    const resource = await prisma.dataExtractionResource.findUniqueOrThrow({
      where: { resourceRef: derivedEvidence!.resourceRef },
    });
    expect(resource.sourceClass).toBe("OWNED_WEBSITE");
    expect(derivedEvidence?.sourceClass).toBe("SYSTEM_DERIVATION_INPUT");
    expect(derivedEvidence?.provenance.captureMethodClass).toBe(
      "DETERMINISTIC_DERIVATION",
    );
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
    const execution =
      await prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
        where: { capabilityExecutionRef: acquired.capabilityExecutionRef },
      });
    expect(execution.completedAt).toBeNull();
    expect(execution.availability).toBe("NOT_REQUESTED");
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
