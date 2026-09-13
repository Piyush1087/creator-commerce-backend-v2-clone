import { createHash, randomUUID } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandInstagramDeletionService } from "../../brand-settings/services/brand-instagram-deletion.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramVisualTextModelPort } from "../../instagram/media/instagram-visual-text";
import { InstagramB3aVisualModelPort } from "./instagram-b3a-visual-observation";
import { INSTAGRAM_B3B_NORMALIZATION_VERSION } from "./instagram-b3b-media-completion.service";
import { InstagramW2CarouselPipelineService } from "./instagram-w2-carousel-pipeline.service";

const databaseUrl = process.env.W2_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;

class FixtureVisualModel extends InstagramB3aVisualModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity = "w2-visual-fixture";
  readonly modelProfileVersion = "w2-visual-fixture-v1";
  readonly observe = vi.fn().mockResolvedValue({
    description: "A person and product in a centered still.",
    visibleElements: ["Launch Kit", "person"],
    dominantColors: ["blue"],
    composition: "centered",
  });
}

class FixtureTextModel extends InstagramVisualTextModelPort {
  readonly providerIdentity = "DETERMINISTIC_FIXTURE";
  readonly modelIdentity = "w2-text-fixture";
  readonly modelProfileVersion = "w2-text-fixture-v1";
  readonly observe = vi.fn().mockResolvedValue({
    state: "OBSERVED",
    spans: ["Launch Kit", "Paid partnership", "Shop now"],
  });
}

describePostgres(
  "Week 2 carousel PostgreSQL lineage, replay and deletion",
  () => {
    const prisma = new PrismaService();
    const writer = new InstagramCaptureWriterService(prisma);
    let root = "";
    let store: InstagramImageTemporaryStore;
    let purge: InstagramDerivedDataPurgeService;
    const brandIds: string[] = [];

    beforeAll(async () => {
      await prisma.$connect();
      root = await mkdtemp(join(tmpdir(), "instagram-w2-postgres-"));
      store = new InstagramImageTemporaryStore(join(root, "owned"));
      purge = new InstagramDerivedDataPurgeService(store);
    });

    afterAll(async () => {
      for (const brandId of brandIds) {
        await purge.purgeTemporaryScope(brandId);
        await prisma.$transaction((tx) =>
          purge.purgePersistentInTransaction(tx, brandId),
        );
      }
      if (brandIds.length) {
        await prisma.dataExtractionResource.deleteMany({
          where: { brandId: { in: brandIds } },
        });
        await prisma.offering.deleteMany({
          where: { brandProfileId: { in: brandIds } },
        });
        await prisma.brandProfile.deleteMany({
          where: { id: { in: brandIds } },
        });
      }
      await prisma.$disconnect();
      await rm(root, { recursive: true, force: true });
    });

    async function fixture(label: string) {
      const brand = await prisma.brandProfile.create({
        data: {
          domain: `w2-${label}-${randomUUID()}.example.test`,
          name: `W2 ${label}`,
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
      await prisma.offering.create({
        data: {
          brandProfileId: brand.id,
          type: "PRODUCT",
          name: "Launch Kit",
          url: "https://example.test/launch-kit",
          locationIds: [],
        },
      });
      return { brand, integration, providerAccountId };
    }

    async function lightLineage(state: Awaited<ReturnType<typeof fixture>>) {
      return writer.write({
        brandId: state.brand.id,
        providerAccountId: state.providerAccountId,
        authorizationGeneration: 7,
        resourceType: "INSTAGRAM_MEDIA",
        mediaId: "carousel-parent",
        capabilityId: "instagram.media_inventory",
        requestKey: `w2-light:${randomUUID()}`,
        providerExecutionRef: `provider-execution:instagram:${randomUUID()}`,
        normalizationContractVersion: INSTAGRAM_B3B_NORMALIZATION_VERSION,
        startedAt: "2026-09-12T00:00:00.000Z",
        completedAt: "2026-09-12T00:00:01.000Z",
        capturedAt: "2026-09-12T00:00:01.000Z",
        availability: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: ["W2_FIXTURE_LIGHT"],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "COMPLETE",
          failureCategories: [],
          detailCodes: [],
        },
        artifacts: [
          {
            artifactKey: "light",
            payload: { providerMediaId: "carousel-parent" },
          },
        ],
        evidence: [
          {
            evidenceKey: "light",
            artifactKey: "light",
            payload: { providerMediaId: "carousel-parent" },
            freshness: "CURRENT",
            representativeness: "CONTEXT_SPECIFIC",
          },
        ],
      });
    }

    function pipeline(state: Awaited<ReturnType<typeof fixture>>) {
      const authorization = {
        assertReplayAuthorized: vi.fn().mockResolvedValue(undefined),
        acquire: vi.fn(async (input: { mediaId: string }) => {
          const created = await store.create(state.brand.id);
          const bytes = Buffer.from(`bounded-child-${input.mediaId}`);
          await created.handle.writeFile(bytes);
          await created.handle.close();
          return {
            artifact: {
              temporaryPath: created.path,
              mediaType: "image/png",
              byteLength: bytes.length,
              width: 3,
              height: 4,
              sha256: createHash("sha256").update(bytes).digest("hex"),
              acquiredAt: "2026-09-12T00:00:02.000Z",
            },
            providerMediaId: input.mediaId,
            providerObservedAt: "2026-09-11T00:00:00.000Z",
          };
        }),
      };
      const visual = new FixtureVisualModel();
      const text = new FixtureTextModel();
      return {
        authorization,
        visual,
        text,
        service: new InstagramW2CarouselPipelineService(
          prisma,
          authorization as never,
          visual,
          text,
          writer,
          store,
        ),
      };
    }

    async function counts(brandId: string) {
      return {
        resources: await prisma.dataExtractionResource.count({
          where: { brandId },
        }),
        captures: await prisma.dataExtractionCapture.count({
          where: { brandId },
        }),
        artifacts: await prisma.dataExtractionContentArtifact.count({
          where: { brandId },
        }),
        evidence: await prisma.dataExtractionEvidenceItem.count({
          where: { brandId },
        }),
        observations: await prisma.dataExtractionSemanticObservation.count({
          where: { brandId },
        }),
      };
    }

    it("persists one parent sweep, exact child support, stable replay, isolation and target-only Settings deletion", async () => {
      const target = await fixture("target");
      const other = await fixture("other");
      const source = await lightLineage(target);
      await lightLineage(other);
      const { service, authorization, visual, text } = pipeline(target);
      const input = {
        brandProfileId: target.brand.id,
        integrationId: target.integration.id,
        providerAccountId: target.providerAccountId,
        authorizationGeneration: 7,
        parentMediaId: "carousel-parent",
        children: {
          availability: "AVAILABLE" as const,
          stopReason: "EXHAUSTED" as const,
          children: [
            {
              providerMediaId: "child-image",
              ordinal: 0,
              mediaType: { state: "OBSERVED" as const, value: "IMAGE" },
              mediaProductType: { state: "OBSERVED" as const, value: "FEED" },
            },
            {
              providerMediaId: "child-video",
              ordinal: 1,
              mediaType: { state: "OBSERVED" as const, value: "VIDEO" },
              mediaProductType: { state: "OBSERVED" as const, value: "FEED" },
            },
          ],
        },
        windowEnd: new Date("2026-09-12T00:00:00.000Z"),
        sourceCaptureRef: source.captureRef,
        sourceEvidenceRefs: source.evidenceRefs,
        now: () => new Date("2026-09-12T00:00:03.000Z"),
      };

      const first = await service.execute(input);
      const firstCounts = await counts(target.brand.id);
      const replay = await service.execute(input);
      expect(replay).toMatchObject({ reused: true, coverage: first.coverage });
      expect(replay.evidenceRefs).toEqual(first.evidenceRefs);
      expect(await counts(target.brand.id)).toEqual(firstCounts);
      expect(authorization.assertReplayAuthorized).toHaveBeenCalledTimes(2);
      expect(authorization.acquire).toHaveBeenCalledTimes(2);
      expect(visual.observe).toHaveBeenCalledTimes(2);
      expect(text.observe).toHaveBeenCalledTimes(2);
      expect(first.coverage).toMatchObject({
        providerChildCountReturned: 2,
        childCountRepresented: 2,
        childCountAttempted: 2,
        childCountVisuallyInspected: 2,
        imageFullCount: 1,
        videoCoverOnlyCount: 1,
        state: "COMPLETE",
        completeVisualScope: true,
        completeVideoScope: false,
      });

      const rows = await prisma.dataExtractionEvidenceItem.findMany({
        where: {
          brandId: target.brand.id,
          evidenceRef: { in: [...first.evidenceRefs] },
        },
        include: { capture: true, resource: true },
        orderBy: { evidenceRef: "asc" },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.capture.status === "COMPLETED")).toBe(
        true,
      );
      expect(rows.every((row) => row.capture.capturedAt !== null)).toBe(true);
      expect(new Set(rows.map((row) => row.captureRef)).size).toBe(1);
      expect(new Set(rows.map((row) => row.resourceRef)).size).toBe(1);
      expect(
        rows
          .map((row) => {
            const payload = row.boundedPayload as Record<string, unknown>;
            const child = payload.child as {
              providerMediaId: string;
              ordinal: number;
            };
            return child;
          })
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((child) => child.providerMediaId),
      ).toEqual(["child-image", "child-video"]);
      expect(JSON.stringify(rows)).not.toMatch(
        /temporaryPath|accessToken|refreshToken|media_url|cdninstagram|fbcdn|base64|system message|developer message/i,
      );
      expect(
        await prisma.dataExtractionEvidenceItem.count({
          where: { brandId: other.brand.id },
        }),
      ).toBe(1);

      const websiteRef = `resource:website:${randomUUID()}`;
      const websiteUrl = `https://${target.brand.domain}/`;
      await prisma.dataExtractionResource.create({
        data: {
          resourceRef: websiteRef,
          brandId: target.brand.id,
          sourceClass: "OWNED_WEBSITE",
          resourceType: "OWNED_WEB_PAGE",
          canonicalResourceKey: websiteUrl,
          canonicalResourceKeyHash: createHash("sha256")
            .update(websiteUrl)
            .digest("hex"),
          canonicalUrl: websiteUrl,
        },
      });

      const targetTemp = await store.create(target.brand.id);
      await targetTemp.handle.writeFile("delete me");
      await targetTemp.handle.close();
      const otherTemp = await store.create(other.brand.id);
      await otherTemp.handle.writeFile("preserve me");
      await otherTemp.handle.close();
      const deletion = new BrandInstagramDeletionService(
        prisma,
        {} as never,
        purge,
      );
      await deletion.requestByMetaCallback({
        providerAppScopedUserId: target.integration.providerAppScopedUserId!,
        callbackRequestHash: createHash("sha256")
          .update(`callback-${randomUUID()}`)
          .digest("hex"),
        confirmationCode: `confirmation-${randomUUID()}`,
      });
      expect(await counts(target.brand.id)).toEqual({
        resources: 1,
        captures: 0,
        artifacts: 0,
        evidence: 0,
        observations: 0,
      });
      expect(
        await prisma.dataExtractionResource.findUnique({
          where: { resourceRef: websiteRef },
        }),
      ).not.toBeNull();
      expect(await counts(other.brand.id)).toMatchObject({ evidence: 1 });
      await expect(access(targetTemp.path)).rejects.toThrow();
      await expect(access(otherTemp.path)).resolves.toBeUndefined();
    });
  },
);
