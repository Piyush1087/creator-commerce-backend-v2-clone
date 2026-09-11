import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { InstagramC2FoundationsService } from "../foundations/instagram-c2-foundations.service";
import { INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION } from "../media/instagram-b3a-visual-observation";
import { INSTAGRAM_B3B_NORMALIZATION_VERSION } from "../media/instagram-b3b-media-completion.service";
import {
  InstagramC3SemanticModelPort,
  type InstagramC3ModelContext,
} from "./instagram-c3-semantic-model";
import { InstagramC3SemanticsService } from "./instagram-c3-semantics.service";

const databaseUrl = process.env.C3_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const describePostgres = databaseUrl ? describe : describe.skip;
const capturedAt = "2026-09-12T00:00:00.000Z";

class FixtureC3Model extends InstagramC3SemanticModelPort {
  readonly modelIdentity = "deterministic-c3-fixture";
  readonly modelProfileVersion = "fixture-profile-v1";
  readonly analyze = vi.fn(
    async ({ context }: { context: InstagramC3ModelContext }) => {
      if (context.media.id === "media-video")
        throw new Error("PROVIDER_FAILURE");
      const caption = context.caption.state === "AVAILABLE";
      const visual = context.visual.state === "AVAILABLE";
      return {
        themes: caption
          ? [
              {
                label: "Product launch",
                confidence: "LOW" as const,
                supportModalities: ["CAPTION" as const],
              },
            ]
          : [],
        captionPatterns: [],
        creativeStructures: [],
        visualExecutions: visual
          ? [
              {
                label: "Centered still",
                confidence: "LOW" as const,
                supportModalities: ["VISUAL" as const],
              },
            ]
          : [],
        creatorRoleSignals: visual
          ? [
              {
                label: "Educator",
                confidence: "LOW" as const,
                supportModalities: ["VISUAL" as const],
              },
            ]
          : [],
        creatorPresence: visual ? ("PRESENT" as const) : ("UNKNOWN" as const),
        offeringPresence: caption ? ("PRESENT" as const) : ("UNKNOWN" as const),
        offeringName: caption ? "Launch Kit" : null,
        collaborationCues:
          context.media.id === "media-image"
            ? [
                {
                  signalClass: "EXPLICIT_PARTNERSHIP_DISCLOSURE" as const,
                  sourceModality: "CAPTION" as const,
                  support: "paid partnership",
                },
                {
                  signalClass: "JOINT_BRAND_CREATOR_APPEARANCE" as const,
                  sourceModality: "VISUAL" as const,
                  support: "brand and creator in still",
                },
              ]
            : [],
      };
    },
  );
}

describePostgres("C3 per-media semantics PostgreSQL", () => {
  const prisma = new PrismaService();
  const writer = new InstagramCaptureWriterService(prisma);
  const c2 = new InstagramC2FoundationsService(prisma);
  const model = new FixtureC3Model();
  const c3 = new InstagramC3SemanticsService(prisma, model);
  const purge = new InstagramDerivedDataPurgeService(
    new InstagramImageTemporaryStore("c3-unused-images"),
  );
  let brandId = "";
  let otherBrandId = "";
  let c2EvidenceRef = "";

  beforeAll(async () => {
    await prisma.$connect();
    brandId = await createBrand("primary", "account-c3", 7);
    otherBrandId = await createBrand("other", "account-other", 2);
    await prisma.offering.create({
      data: {
        brandProfileId: brandId,
        type: "PRODUCT",
        name: "Launch Kit",
        url: "https://example.test/launch-kit",
        locationIds: [],
      },
    });
    const media = [
      ["media-image", "IMAGE", 1],
      ["media-carousel", "CAROUSEL_ALBUM", 2],
      ["media-reel", "REEL", 3],
      ["media-video", "VIDEO", null],
    ] as const;
    for (const [mediaId, mediaType, rank] of media) {
      await write(
        brandId,
        "account-c3",
        7,
        "instagram.media_inventory",
        `${mediaId}-light`,
        {
          providerMediaId: mediaId,
          mediaType: { state: "OBSERVED", value: mediaType },
          publishedTimestamp: {
            state: "OBSERVED",
            value: "2026-09-11T00:00:00.000Z",
          },
          caption: {
            state: "OBSERVED",
            sourceContent: `Launch #Drop with @maker ${mediaId === "media-image" ? "paid partnership" : ""}`,
            sourceHash: "a".repeat(64),
            truncated: false,
          },
          selection: rank
            ? { selectionRank: rank, reasonCodes: ["RECENT_FORMAT_COVERAGE"] }
            : {
                selectionRank: null,
                reasonCodes: ["MEDIA_NOT_SELECTED_FOR_DEEP_ANALYSIS"],
              },
          metrics: {
            reach: { state: "OBSERVED", value: 100 },
            likes: { state: "OBSERVED", value: 10 },
            total_interactions: { state: "OBSERVED", value: 12 },
          },
          ...(mediaType === "CAROUSEL_ALBUM"
            ? {
                carouselChildren: {
                  children: [{ providerMediaId: "child-1", ordinal: 0 }],
                },
              }
            : {}),
        },
        mediaId,
        INSTAGRAM_B3B_NORMALIZATION_VERSION,
      );
      if (rank) {
        await write(
          brandId,
          "account-c3",
          7,
          "instagram.media_visual_observations",
          `${mediaId}-visual`,
          {
            inspectionDepth:
              mediaType === "IMAGE"
                ? "IMAGE_ONLY"
                : mediaType === "CAROUSEL_ALBUM"
                  ? "CAROUSEL_REPRESENTATIVE_ONLY"
                  : "COVER_ONLY",
            observation: {
              description: "A bounded still observation",
              visibleElements: ["person", "product"],
              dominantColors: ["blue"],
              composition: "centered",
            },
          },
          mediaId,
          INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION,
        );
      }
    }
    await write(
      otherBrandId,
      "account-other",
      2,
      "instagram.media_inventory",
      "other-light",
      {
        providerMediaId: "other-media",
        mediaType: { state: "OBSERVED", value: "IMAGE" },
        publishedTimestamp: {
          state: "OBSERVED",
          value: "2026-09-11T00:00:00.000Z",
        },
      },
      "other-media",
      INSTAGRAM_B3B_NORMALIZATION_VERSION,
    );
    const result = await c2.execute(requestBase());
    c2EvidenceRef = result.observations.find(
      (item) => item.capabilityId === "instagram.media_inventory",
    )!.derivedEvidenceRef;
  });

  afterAll(async () => {
    for (const id of [brandId, otherBrandId]) {
      if (!id) continue;
      await prisma.$transaction((tx) =>
        purge.purgePersistentInTransaction(tx, id),
      );
      await prisma.offering.deleteMany({ where: { brandProfileId: id } });
      await prisma.brandProfile.delete({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it("persists successful peers with target-derived lineage and stable replay", async () => {
    const beforeCurrent = await prisma.intelligenceCurrentComponent.count({
      where: { brandId },
    });
    const first = await c3.execute({
      ...requestBase(),
      brandProfileId: brandId,
      c2EvidenceRef,
    });
    expect(first.media.map((item) => item.reasonCode).filter(Boolean)).toEqual([
      "PROVIDER_FAILURE",
    ]);
    expect(first).toMatchObject({
      executionState: "PARTIAL",
      eligibleCount: 4,
      successfulCount: 3,
      failedCount: 1,
    });
    expect(
      first.media.find((item) => item.mediaId === "media-video"),
    ).toMatchObject({
      state: "UNAVAILABLE",
      derivedEvidenceRefs: [],
    });
    const successful = first.media.filter((item) => item.state === "AVAILABLE");
    expect(
      successful.every((item) => item.derivedEvidenceRefs.length === 4),
    ).toBe(true);
    expect(
      first.media.find((item) => item.mediaId === "media-image")?.observation
        ?.likelyCollab,
    ).toMatchObject({
      state: "LIKELY_COLLAB",
      confidence: "MEDIUM",
      canonicalCreatorId: null,
      canonicalCollaborationId: null,
    });
    expect(
      first.media.find((item) => item.mediaId === "media-carousel")?.observation
        ?.inspection,
    ).toMatchObject({
      depth: "PARTIAL_DEEP",
      inspectedChildCount: 1,
      availableChildCount: 1,
    });
    expect(
      first.media.find((item) => item.mediaId === "media-reel")?.observation
        ?.inspection,
    ).toMatchObject({
      depth: "COVER_ONLY",
      reasonCodes: [
        "COVER_ONLY",
        "VIDEO_NOT_ANALYZED",
        "AUDIO_NOT_ANALYZED",
        "TRANSCRIPT_NOT_ACQUIRED",
      ],
    });
    const derived = await prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId,
        normalizationContractVersion: "instagram.per-media-semantics.c3.v1",
      },
      include: { observationSupports: true },
    });
    expect(derived).toHaveLength(12);
    expect(
      derived.every((row) => row.captureMethodClass === "MODEL_DERIVATION"),
    ).toBe(true);
    expect(
      derived
        .filter((row) => row.capabilityId === "instagram.caption_context")
        .every((row) => row.parentEvidenceRefs.includes(c2EvidenceRef)),
    ).toBe(true);
    expect(
      derived
        .filter((row) => row.capabilityId !== "instagram.caption_context")
        .every((row) => !row.parentEvidenceRefs.includes(c2EvidenceRef)),
    ).toBe(true);
    expect(
      derived.every(
        (row) =>
          row.observationSupports.length === 1 &&
          row.observationSupports[0]?.capabilityId === row.capabilityId &&
          row.observationSupports[0]?.evidenceRef === row.evidenceRef,
      ),
    ).toBe(true);
    const counts = await rowCounts();
    const calls = model.analyze.mock.calls.length;
    const replay = await c3.execute({
      ...requestBase(),
      brandProfileId: brandId,
      c2EvidenceRef,
    });
    expect(replay.media.filter((item) => item.replayed)).toHaveLength(3);
    expect(model.analyze.mock.calls.length).toBe(calls + 1);
    expect(await rowCounts()).toEqual(counts);
    expect(
      await prisma.intelligenceCurrentComponent.count({
        where: { brandId },
      }),
    ).toBe(beforeCurrent);
  });

  it("rejects tenant/account/generation/C2 substitution without mutating prior output", async () => {
    const before = await rowCounts();
    await expect(
      c3.execute({
        ...requestBase(),
        brandProfileId: brandId,
        providerAccountId: "account-other",
        c2EvidenceRef,
      }),
    ).rejects.toThrow("SOURCE_SCOPE_MISMATCH");
    await expect(
      c3.execute({
        ...requestBase(),
        brandProfileId: brandId,
        authorizationGeneration: 6,
        c2EvidenceRef,
      }),
    ).rejects.toThrow("SOURCE_SCOPE_MISMATCH");
    await expect(
      c3.execute({
        ...requestBase(),
        brandProfileId: otherBrandId,
        providerAccountId: "account-other",
        authorizationGeneration: 2,
        c2EvidenceRef,
      }),
    ).rejects.toThrow("C2_IDENTITY_MISMATCH");
    expect(await rowCounts()).toEqual(before);
  });

  it("Settings deletion removes C3 Instagram rows while another Brand survives", async () => {
    const otherBefore = await prisma.dataExtractionEvidenceItem.count({
      where: { brandId: otherBrandId },
    });
    await prisma.$transaction((tx) =>
      purge.purgePersistentInTransaction(tx, brandId),
    );
    expect(
      await prisma.dataExtractionEvidenceItem.count({ where: { brandId } }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionSemanticObservation.count({
        where: { brandId },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
    ).toBe(0);
    expect(
      await prisma.dataExtractionEvidenceItem.count({
        where: { brandId: otherBrandId },
      }),
    ).toBe(otherBefore);
  });

  function requestBase() {
    return {
      brandId,
      providerAccountId: "account-c3",
      authorizationGeneration: 7,
      executionCutoff: new Date("2026-09-12T00:00:01.000Z"),
      windowEnd: new Date(capturedAt),
    };
  }

  async function createBrand(
    label: string,
    account: string,
    generation: number,
  ) {
    const brand = await prisma.brandProfile.create({
      data: {
        domain: `c3-${label}-${randomUUID()}.example.test`,
        name: `C3 ${label}`,
        industry: "D2C",
        brandValues: [],
        policyFlags: [],
      },
    });
    await prisma.brandIntegration.create({
      data: {
        brandProfileId: brand.id,
        provider: "INSTAGRAM",
        status: "CONNECTED",
        isActive: true,
        providerAccountId: account,
        providerAppScopedUserId: `app-${randomUUID()}`,
        currentPlatformHandle: label,
        authorizationGeneration: generation,
        credentialVersion: 1,
      },
    });
    return brand.id;
  }

  async function write(
    id: string,
    account: string,
    generation: number,
    capabilityId: Parameters<
      InstagramCaptureWriterService["write"]
    >[0]["capabilityId"],
    key: string,
    payload: Record<string, unknown>,
    mediaId: string,
    normalizationContractVersion: string,
  ) {
    await writer.write({
      brandId: id,
      providerAccountId: account,
      authorizationGeneration: generation,
      resourceType: "INSTAGRAM_MEDIA",
      mediaId,
      capabilityId,
      requestKey: `c3:${key}:${id}`,
      providerExecutionRef: `provider-execution:c3:${key}:${id}`,
      normalizationContractVersion,
      startedAt: capturedAt,
      completedAt: capturedAt,
      capturedAt,
      availability: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: ["C3_FIXTURE"],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      artifacts: [{ artifactKey: key, payload }],
      evidence: [
        {
          evidenceKey: key,
          artifactKey: key,
          payload,
          freshness: "CURRENT",
          representativeness: "CONTEXT_SPECIFIC",
        },
      ],
    });
  }

  async function rowCounts() {
    return {
      evidence: await prisma.dataExtractionEvidenceItem.count({
        where: { brandId },
      }),
      observations: await prisma.dataExtractionSemanticObservation.count({
        where: { brandId },
      }),
      supports: await prisma.dataExtractionObservationSupport.count({
        where: { brandId },
      }),
      creators: await prisma.creatorProfile.count(),
      collaborations: await prisma.collaboration.count(),
      offerings: await prisma.offering.count({
        where: { brandProfileId: brandId },
      }),
    };
  }
});
