import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { asBrandId, type BrandId } from "./domain/evidence-identities";
import { DataExtractionPersistenceError } from "./persistence/evidence-persistence.errors";
import { DataExtractionPersistenceService } from "./persistence/prisma-evidence-repositories";
import {
  OwnedWebsiteWave1AcquisitionService,
  type OwnedWebsitePageAcquisition,
  type OwnedWebsitePageAcquisitionMechanics,
} from "./acquisition/owned-website-wave1-acquisition.service";

const databaseUrl = process.env.DE_W1_0D_DATABASE_URL ?? process.env.DE_W1_0C_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class FakeMechanics implements OwnedWebsitePageAcquisitionMechanics {
  readonly calls: string[] = [];
  failRoot = false;

  async acquire(url: string): Promise<OwnedWebsitePageAcquisition> {
    this.calls.push(url);
    if (this.failRoot && new URL(url).pathname === "/") {
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
        reasonCodes: ["DIRECT_FETCH_FAILED", "NO_USABLE_CONTENT"],
      };
    }
    const path = new URL(url).pathname;
    const links =
      path === "/"
        ? [
            new URL("/about", url).toString(),
            new URL("/products", url).toString(),
            new URL("/pricing", url).toString(),
          ]
        : [];
    const body = `<html><body><main>${`Representative ${path} content for customers and products. `.repeat(
      30,
    )}</main>${links.map((link) => `<a href="${link}">${link}</a>`).join("")}</body></html>`;
    return {
      url,
      html: body,
      cleanText: `Representative ${path} clean text `.repeat(30),
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

describePostgres("DE-W1.0D durable owned-site acquisition", () => {
  const prisma = new PrismaService();
  const persistence = new DataExtractionPersistenceService(prisma);

  beforeAll(async () => prisma.$connect());
  afterAll(async () => prisma.$disconnect());

  async function brand(label: string): Promise<BrandId> {
    const row = await prisma.brandProfile.create({
      data: {
        domain: `de-w1-0d-${label}-${randomUUID()}.example`,
        name: `DE W1.0D ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    return asBrandId(row.id);
  }

  function request(brandId: BrandId, root: string, requestKey: string, freshnessIntent = "REUSE_ALLOWED" as const, capabilityId = "owned_website.brand_messaging" as const) {
    return {
      brandId,
      capabilityId,
      freshnessIntent,
      normalizationContractVersion: "1.0",
      requestKey,
      ownedWebsiteRoot: root,
      correlationRef: `correlation:${requestKey}`,
    };
  }

  it("persists Resource, Capture, content, provider lineage and capability scope without Evidence", async () => {
    const brandId = await brand("lineage");
    const mechanics = new FakeMechanics();
    const service = new OwnedWebsiteWave1AcquisitionService(
      persistence,
      mechanics as never,
    );
    const root = "https://example.com/";
    const result = await service.request(request(brandId, root, `request:${randomUUID()}`));

    expect(result.evidenceRefs).toEqual([]);
    expect(result.resourceRefs!.length).toBeGreaterThanOrEqual(2);
    expect(result.captureRefs!.length).toBe(result.resourceRefs!.length);

    const resources = await prisma.dataExtractionResource.findMany({ where: { brandId } });
    const captures = await prisma.dataExtractionCapture.findMany({ where: { brandId } });
    const artifacts = await prisma.dataExtractionContentArtifact.findMany({ where: { brandId } });
    const providerLinks = await prisma.dataExtractionProviderExecutionLink.findMany({ where: { brandId } });
    const scope = await prisma.dataExtractionCapabilityResource.findMany({ where: { brandId } });
    const evidence = await prisma.dataExtractionEvidenceItem.findMany({ where: { brandId } });
    const observations = await prisma.dataExtractionSemanticObservation.findMany({ where: { brandId } });

    expect(resources.some((row) => row.pageRole === "HOMEPAGE")).toBe(true);
    expect(captures.every((row) => row.status === "COMPLETED")).toBe(true);
    expect(artifacts.some((row) => row.kind === "ACQUIRED_SOURCE_BODY")).toBe(true);
    expect(artifacts.some((row) => row.kind === "NORMALIZED_TEXT")).toBe(true);
    expect(providerLinks.length).toBe(captures.length);
    expect(scope.length).toBe(resources.length);
    expect(evidence).toHaveLength(0);
    expect(observations).toHaveLength(0);
  });

  it("same request key replays terminal lineage without duplicate captures or provider attempts", async () => {
    const brandId = await brand("idempotent");
    const mechanics = new FakeMechanics();
    const service = new OwnedWebsiteWave1AcquisitionService(persistence, mechanics as never);
    const key = `request:${randomUUID()}`;
    const first = await service.request(request(brandId, "https://example.org/", key));
    const callCount = mechanics.calls.length;
    const second = await service.request(request(brandId, "https://example.org/", key));
    expect(second.capabilityExecutionRef).toBe(first.capabilityExecutionRef);
    expect(mechanics.calls.length).toBe(callCount);
    expect(await prisma.dataExtractionCapture.count({ where: { brandId } })).toBe(first.captureRefs!.length);
  });

  it("material request-key mismatch returns IDEMPOTENCY_CONFLICT", async () => {
    const brandId = await brand("conflict");
    const mechanics = new FakeMechanics();
    const service = new OwnedWebsiteWave1AcquisitionService(persistence, mechanics as never);
    const key = `request:${randomUUID()}`;
    await service.request(request(brandId, "https://example.net/", key));
    await expect(
      service.request(
        request(
          brandId,
          "https://example.net/",
          key,
          "FORCE_RECAPTURE",
        ),
      ),
    ).rejects.toMatchObject<DataExtractionPersistenceError>({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("REUSE_ALLOWED reuses existing captures across a new capability execution", async () => {
    const brandId = await brand("reuse");
    const mechanics = new FakeMechanics();
    const service = new OwnedWebsiteWave1AcquisitionService(persistence, mechanics as never);
    const root = "https://reuse.example.com/";
    const first = await service.request(request(brandId, root, `request:${randomUUID()}`));
    const callsAfterFirst = mechanics.calls.length;
    const second = await service.request(
      request(
        brandId,
        root,
        `request:${randomUUID()}`,
        "REUSE_ALLOWED",
        "observed_brand_communication_language_signals",
      ),
    );
    expect(second.capabilityExecutionRef).not.toBe(first.capabilityExecutionRef);
    expect(mechanics.calls.length).toBe(callsAfterFirst);
    expect(new Set(second.captureRefs).size).toBe(second.captureRefs!.length);
    expect(await prisma.dataExtractionCapabilityExecution.count({ where: { brandId } })).toBe(2);
  });

  it("FORCE_RECAPTURE creates new Capture history for the same Resource", async () => {
    const brandId = await brand("force");
    const mechanics = new FakeMechanics();
    const service = new OwnedWebsiteWave1AcquisitionService(persistence, mechanics as never);
    const root = "https://force.example.com/";
    const first = await service.request(request(brandId, root, `request:${randomUUID()}`));
    const second = await service.request(
      request(brandId, root, `request:${randomUUID()}`, "FORCE_RECAPTURE"),
    );
    const resourceCount = await prisma.dataExtractionResource.count({ where: { brandId } });
    const captureCount = await prisma.dataExtractionCapture.count({ where: { brandId } });
    expect(resourceCount).toBe(first.resourceRefs!.length);
    expect(captureCount).toBe(first.captureRefs!.length + second.captureRefs!.length);
  });

  it("failed root acquisition keeps failed attempt lineage and completes execution UNAVAILABLE", async () => {
    const brandId = await brand("failed");
    const mechanics = new FakeMechanics();
    mechanics.failRoot = true;
    const service = new OwnedWebsiteWave1AcquisitionService(persistence, mechanics as never);
    const result = await service.request(
      request(brandId, "https://failed.example.com/", `request:${randomUUID()}`),
    );
    const capture = await prisma.dataExtractionCapture.findFirstOrThrow({ where: { brandId } });
    const execution = await prisma.dataExtractionCapabilityExecution.findFirstOrThrow({ where: { brandId } });
    const providerLinks = await prisma.dataExtractionProviderExecutionLink.count({ where: { brandId } });
    expect(capture.status).toBe("FAILED");
    expect(execution.availability).toBe("UNAVAILABLE");
    expect(providerLinks).toBe(1);
    expect(result.evidenceRefs).toEqual([]);
  });

  it("same owned URL is Brand-isolated and never cross-reuses another Brand Resource/Capture", async () => {
    const brandA = await brand("tenant-a");
    const brandB = await brand("tenant-b");
    const mechanics = new FakeMechanics();
    const service = new OwnedWebsiteWave1AcquisitionService(persistence, mechanics as never);
    const root = "https://tenant.example.com/";
    const a = await service.request(request(brandA, root, `request:${randomUUID()}`));
    const b = await service.request(request(brandB, root, `request:${randomUUID()}`));
    expect(a.resourceRefs![0]).not.toBe(b.resourceRefs![0]);
    expect(a.captureRefs![0]).not.toBe(b.captureRefs![0]);
  });
});
