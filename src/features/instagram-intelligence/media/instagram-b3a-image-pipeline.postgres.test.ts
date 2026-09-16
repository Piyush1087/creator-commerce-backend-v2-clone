import { createHash, randomUUID } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandInstagramDeletionService } from "../../brand-settings/services/brand-instagram-deletion.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageAcquisitionError } from "../../instagram/media/instagram-image-acquisition.types";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramB3aImagePipelineService } from "./instagram-b3a-image-pipeline.service";
import { InstagramB3aVisualModelPort } from "./instagram-b3a-visual-observation";

const databaseUrl = process.env.B3A_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class FixtureVisualModel extends InstagramB3aVisualModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity = "fixture-image-observer";
  readonly modelProfileVersion = "fixture-v1";
  observe = vi.fn().mockResolvedValue({
    description: "A centered blue geometric composition.",
    visibleElements: ["blue rectangle"],
    dominantColors: ["blue"],
    composition: "Centered with an even margin.",
  });
}

describePostgres("B3A PostgreSQL lineage and Settings deletion", () => {
  const prisma = new PrismaService();
  let root: string;
  let store: InstagramImageTemporaryStore;
  let purge: InstagramDerivedDataPurgeService;
  let writer: InstagramCaptureWriterService;
  const brandIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
    root = await mkdtemp(join(tmpdir(), "instagram-b3a-postgres-"));
    store = new InstagramImageTemporaryStore(join(root, "owned"));
    purge = new InstagramDerivedDataPurgeService(store);
    writer = new InstagramCaptureWriterService(prisma);
  });

  afterAll(async () => {
    if (brandIds.length) {
      for (const brandId of brandIds) {
        await purge.purgeTemporaryScope(brandId);
        await prisma.$transaction((tx) =>
          purge.purgePersistentInTransaction(tx, brandId),
        );
      }
      await prisma.brandProfile.deleteMany({ where: { id: { in: brandIds } } });
    }
    await prisma.$disconnect();
    await rm(root, { recursive: true, force: true });
  });

  async function fixture(label: string) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `b3a-${label}-${randomUUID()}.example.test`,
        name: `B3A ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    brandIds.push(brand.id);
    const providerAccountId = `account-${randomUUID()}`;
    const integration = await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: "fixture-handle",
        authorizationGeneration: 7,
        credentialVersion: 2,
      },
    });
    return { brand, integration, providerAccountId };
  }

  function pipelineFor(
    acquisitionImplementation?: (input: {
      brandProfileId: string;
      mediaId: string;
    }) => Promise<unknown>,
  ) {
    const acquisition = {
      acquire: vi.fn().mockImplementation(
        acquisitionImplementation ??
          (async (input: { brandProfileId: string; mediaId: string }) => {
            const created = await store.create(input.brandProfileId);
            const bytes = Buffer.from("deterministic fixture image bytes");
            await created.handle.writeFile(bytes);
            await created.handle.close();
            return {
              artifact: {
                temporaryPath: created.path,
                mediaType: "image/png",
                byteLength: bytes.length,
                width: 2,
                height: 3,
                sha256: createHash("sha256").update(bytes).digest("hex"),
                acquiredAt: "2026-09-11T10:00:00.000Z",
              },
              providerMediaId: input.mediaId,
              providerObservedAt: "2026-09-10T08:00:00.000Z",
            };
          }),
      ),
    };
    return {
      acquisition,
      pipeline: new InstagramB3aImagePipelineService(
        acquisition as never,
        new FixtureVisualModel(),
        writer,
        store,
      ),
    };
  }

  function input(state: Awaited<ReturnType<typeof fixture>>, mediaId: string) {
    return {
      brandProfileId: state.brand.id,
      integrationId: state.integration.id,
      providerAccountId: state.providerAccountId,
      authorizationGeneration: 7,
      mediaId,
      selection: "SELECTED" as const,
      now: () => new Date("2026-09-11T10:00:01.000Z"),
    };
  }

  async function counts(brandId: string) {
    const where = { brandId };
    return Promise.all([
      prisma.dataExtractionResource.count({ where }),
      prisma.dataExtractionCapture.count({ where }),
      prisma.dataExtractionContentArtifact.count({ where }),
      prisma.dataExtractionCapabilityExecution.count({ where }),
      prisma.dataExtractionCapabilityResource.count({ where }),
      prisma.dataExtractionEvidenceItem.count({ where }),
      prisma.dataExtractionCapabilityEvidence.count({ where }),
      prisma.dataExtractionSemanticObservation.count({ where }),
      prisma.dataExtractionObservationSupport.count({ where }),
      prisma.dataExtractionProviderExecutionLink.count({ where }),
    ]);
  }

  it("persists completed-Capture image lineage, safe metadata and one observation with replay stability", async () => {
    const state = await fixture("lineage");
    const { pipeline } = pipelineFor();
    const first = await pipeline.execute(input(state, "media-lineage"));
    const firstCounts = await counts(state.brand.id);
    const replay = await pipeline.execute(input(state, "media-lineage"));
    const replayCounts = await counts(state.brand.id);

    expect(first.reasonCode).toBe("INSPECTED");
    expect(replay.lineage).toEqual({ ...first.lineage, reused: true });
    expect(firstCounts).toEqual([1, 1, 2, 1, 1, 1, 1, 1, 1, 2]);
    expect(replayCounts).toEqual(firstCounts);

    const lineage = first.lineage!;
    const [resource, capture, execution, artifacts, evidence, observation] =
      await Promise.all([
        prisma.dataExtractionResource.findUniqueOrThrow({
          where: { resourceRef: lineage.resourceRef },
        }),
        prisma.dataExtractionCapture.findUniqueOrThrow({
          where: { captureRef: lineage.captureRef },
        }),
        prisma.dataExtractionCapabilityExecution.findUniqueOrThrow({
          where: { capabilityExecutionRef: lineage.capabilityExecutionRef },
        }),
        prisma.dataExtractionContentArtifact.findMany({
          where: { contentArtifactRef: { in: [...lineage.artifactRefs] } },
        }),
        prisma.dataExtractionEvidenceItem.findUniqueOrThrow({
          where: { evidenceRef: lineage.evidenceRefs[0] },
        }),
        prisma.dataExtractionSemanticObservation.findFirstOrThrow({
          where: { brandId: state.brand.id },
        }),
      ]);
    expect(resource).toMatchObject({
      sourceClass: "INSTAGRAM_OWNED",
      resourceType: "INSTAGRAM_MEDIA",
      providerAccountId: state.providerAccountId,
    });
    expect(capture).toMatchObject({
      status: "COMPLETED",
      capturedAt: new Date("2026-09-11T10:00:00.000Z"),
      observedAt: new Date("2026-09-10T08:00:00.000Z"),
    });
    expect(execution).toMatchObject({
      capabilityId: "instagram.media_visual_observations",
      availability: "AVAILABLE",
      providerIntegrationId: state.integration.id,
      authorizationGeneration: 7,
    });
    expect(artifacts).toHaveLength(2);
    expect(evidence).toMatchObject({
      captureRef: lineage.captureRef,
      contentArtifactRef: lineage.artifactRefs[1],
      capabilityId: "instagram.media_visual_observations",
    });
    expect(observation.capabilityId).toBe(
      "instagram.media_visual_observations",
    );
    expect(
      JSON.stringify({ resource, capture, execution, artifacts, evidence }),
    ).not.toMatch(
      /temporaryPath|accessToken|refreshToken|media_url|cdninstagram|fbcdn|base64/i,
    );
  });

  it("keeps failed acquisition UNKNOWN with no artifact, Evidence or observation", async () => {
    const state = await fixture("failure");
    const { pipeline } = pipelineFor(async () => {
      throw new InstagramImageAcquisitionError("INVALID_IMAGE");
    });
    const result = await pipeline.execute(input(state, "media-failure"));
    expect(result).toMatchObject({
      visualInspection: "UNAVAILABLE",
      visualSemanticResult: "UNKNOWN",
      reasonCode: "ACQUISITION_FAILED",
    });
    expect(await counts(state.brand.id)).toEqual([
      1, 1, 0, 1, 1, 0, 0, 0, 0, 2,
    ]);
    const capture = await prisma.dataExtractionCapture.findFirstOrThrow({
      where: { brandId: state.brand.id },
    });
    expect(capture.status).toBe("FAILED");
    expect(capture.capturedAt).toBeNull();
  });

  it("Settings deletion purges only target Instagram derivations/temp while preserving website and another Brand", async () => {
    const target = await fixture("delete-target");
    const other = await fixture("delete-other");
    const { pipeline } = pipelineFor();
    await pipeline.execute(input(target, "media-target"));
    await pipeline.execute(input(other, "media-other"));
    const websiteRef = `resource:website:${randomUUID()}`;
    await prisma.dataExtractionResource.create({
      data: {
        resourceRef: websiteRef,
        brandId: target.brand.id,
        sourceClass: "OWNED_WEBSITE",
        resourceType: "OWNED_WEB_PAGE",
        canonicalResourceKey: `https://${target.brand.domain}/`,
        canonicalResourceKeyHash: createHash("sha256")
          .update(`https://${target.brand.domain}/`)
          .digest("hex"),
        canonicalUrl: `https://${target.brand.domain}/`,
      },
    });
    const targetStale = await store.create(target.brand.id);
    await targetStale.handle.writeFile("delete me");
    await targetStale.handle.close();
    const otherFresh = await store.create(other.brand.id);
    await otherFresh.handle.writeFile("preserve me");
    await otherFresh.handle.close();

    const deletion = new BrandInstagramDeletionService(
      prisma,
      {} as never,
      purge,
    );
    const receipt = await deletion.requestByMetaCallback({
      providerAppScopedUserId: target.integration.providerAppScopedUserId!,
      callbackRequestHash: createHash("sha256")
        .update(`callback-${randomUUID()}`)
        .digest("hex"),
      confirmationCode: `confirmation-${randomUUID()}`,
    });
    expect(receipt.requestIds).toHaveLength(1);
    expect(await counts(target.brand.id)).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(await counts(other.brand.id)).toEqual([
      1, 1, 2, 1, 1, 1, 1, 1, 1, 2,
    ]);
    expect(
      await prisma.dataExtractionResource.findUnique({
        where: { resourceRef: websiteRef },
      }),
    ).not.toBeNull();
    await expect(access(targetStale.path)).rejects.toThrow();
    await expect(access(otherFresh.path)).resolves.toBeUndefined();

    const afterFence = await pipeline.execute(input(target, "media-target"));
    expect(afterFence.reasonCode).toBe("FINAL_FENCE_REJECTED");
    expect(await counts(target.brand.id)).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("changed provider account rejects the final transaction atomically and cleans the temporary image", async () => {
    const state = await fixture("account-fence");
    await prisma.brandIntegration.update({
      where: { id: state.integration.id },
      data: { providerAccountId: `changed-${randomUUID()}` },
    });
    const { pipeline } = pipelineFor();
    const result = await pipeline.execute(input(state, "media-account-fence"));
    expect(result.reasonCode).toBe("FINAL_FENCE_REJECTED");
    expect(await counts(state.brand.id)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
