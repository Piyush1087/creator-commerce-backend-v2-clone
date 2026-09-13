import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramDerivedDataPurgeService } from "../../data-extraction/evidence/instagram/instagram-derived-data-purge.service";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import { INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION } from "../../instagram/media/video/instagram-video.types";
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
  readonly failingMediaIds = new Set(["media-video"]);
  readonly analyze = vi.fn(
    async ({ context }: { context: InstagramC3ModelContext }) => {
      if (this.failingMediaIds.has(context.media.id))
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
        creatorPresence: visual
          ? {
              state: "PRESENT" as const,
              supportModalities: ["VISUAL" as const],
            }
          : { state: "UNKNOWN" as const, supportModalities: [] },
        offeringPresence: caption
          ? {
              state: "PRESENT" as const,
              supportModalities: ["CAPTION" as const],
            }
          : { state: "UNKNOWN" as const, supportModalities: [] },
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
        if (mediaType === "REEL") {
          await writeVideoFrames(mediaId);
        } else {
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
                description:
                  "A bounded still observation with brand and creator in still",
                visibleElements: ["person", "product", "Launch Kit"],
                dominantColors: ["blue"],
                composition: "centered",
              },
            },
            mediaId,
            INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION,
          );
        }
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
      depth: "PARTIAL_DEEP",
      inspectedFrameCount: 2,
      reasonCodes: [
        "SAMPLED_FRAMES_ARE_NOT_COMPLETE_VIDEO",
        "AUDIO_NOT_ANALYZED",
        "TRANSCRIPT_NOT_ACQUIRED",
        "TEMPORAL_SEQUENCE_NOT_ANALYZED",
      ],
    });
    const frameRows = await prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId,
        normalizationContractVersion:
          INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
      },
      orderBy: { evidenceRef: "asc" },
    });
    expect(frameRows).toHaveLength(2);
    const frameRefs = frameRows.map((row) => row.evidenceRef);
    expect(
      first.media.find((item) => item.mediaId === "media-reel")?.observation
        ?.evidenceRefs,
    ).toEqual(expect.arrayContaining(frameRefs));
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
    expect(
      derived.every((row) => {
        const semanticPayload = asRecord(
          asRecord(row.boundedPayload).semanticPayload,
        );
        return evidenceRefsFrom(semanticPayload).every((ref) =>
          row.parentEvidenceRefs.includes(ref),
        );
      }),
    ).toBe(true);
    expect(
      derived
        .filter(
          (row) => row.capabilityId === "instagram.media_offering_signals",
        )
        .every(
          (row) =>
            row.parentEvidenceRefs.length === 1 &&
            !row.parentEvidenceRefs.includes(c2EvidenceRef),
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

    const imageResult = first.media.find(
      (item) => item.mediaId === "media-image",
    )!;
    const peerRefs = first.media
      .filter(
        (item) => item.state === "AVAILABLE" && item.mediaId !== "media-image",
      )
      .flatMap((item) => item.derivedEvidenceRefs)
      .sort();
    const priorRows = await c3RowsForMedia("media-image");
    const priorC3Count = await c3RowCounts();
    await write(
      brandId,
      "account-c3",
      7,
      "instagram.media_visual_observations",
      "media-image-visual-changed",
      {
        inspectionDepth: "IMAGE_ONLY",
        observation: {
          description: "Changed bounded still with Launch Kit",
          visibleElements: ["product"],
        },
      },
      "media-image",
      INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION,
      "2026-09-12T00:00:00.500Z",
    );
    model.failingMediaIds.add("media-image");
    const failedReplacement = await c3.execute({
      ...requestBase(),
      brandProfileId: brandId,
      c2EvidenceRef,
    });
    expect(
      failedReplacement.media.find((item) => item.mediaId === "media-image"),
    ).toMatchObject({
      state: "UNAVAILABLE",
      derivedEvidenceRefs: [],
      reasonCode: "PROVIDER_FAILURE",
      replayed: false,
    });
    expect(
      failedReplacement.media
        .filter(
          (item) =>
            item.state === "AVAILABLE" && item.mediaId !== "media-image",
        )
        .flatMap((item) => item.derivedEvidenceRefs)
        .sort(),
    ).toEqual(peerRefs);
    expect(await c3RowCounts()).toEqual(priorC3Count);
    expect(await c3RowsForMedia("media-image")).toEqual(priorRows);
    await expect(
      c3.replayCompleted({
        brandProfileId: brandId,
        mediaId: "media-image",
        executionIdentity: imageResult.executionIdentity,
      }),
    ).resolves.toMatchObject({ refs: [...imageResult.derivedEvidenceRefs] });
    expect(await c3RowsForMedia("media-image")).toEqual(priorRows);
    expect(
      await prisma.intelligenceCurrentComponent.count({
        where: { brandId },
      }),
    ).toBe(beforeCurrent);
  }, 15_000);

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
    eventAt = capturedAt,
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
      startedAt: eventAt,
      completedAt: eventAt,
      capturedAt: eventAt,
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

  async function writeVideoFrames(mediaId: string) {
    const payloads = [0, 1].map((frameOrdinal) => ({
      providerMediaId: mediaId,
      verifiedVideoFingerprint: "f".repeat(64),
      videoAnalysisProfile: "selected-reel-frames-v1",
      frameSelectionProfile: "canonical-six-timestamps-v1",
      observationContractVersion: "1.0",
      promptProfileVersion: "video-frame-description-v1",
      modelProvider: "DETERMINISTIC_FIXTURE",
      modelIdentity: "fixture-video-observer",
      modelProfileVersion: "fixture-v1",
      executionIdentity: "e".repeat(64),
      inspectionDepth: "MULTI_FRAME_SAMPLED",
      limitations: ["SAMPLED_FRAMES_ARE_NOT_COMPLETE_VIDEO"],
      frame: {
        verifiedVideoFingerprint: "f".repeat(64),
        frameOrdinal,
        requestedTimestampMilliseconds: frameOrdinal * 1_500,
        actualTimestampMilliseconds: null,
        mediaType: "image/jpeg",
        byteLength: 1_024,
        width: 1_280,
        height: 720,
        contentHash: String(frameOrdinal + 1).repeat(64),
      },
      observation: {
        description: `Centered still sampled frame ${frameOrdinal}`,
        visibleElements: ["person", "product", "Launch Kit"],
        dominantColors: ["blue"],
        composition: "centered",
      },
    }));
    await writer.write({
      brandId,
      providerAccountId: "account-c3",
      authorizationGeneration: 7,
      resourceType: "INSTAGRAM_MEDIA",
      mediaId,
      capabilityId: "instagram.media_visual_observations",
      requestKey: `c3:${mediaId}-video-frames:${brandId}`,
      providerExecutionRef: `provider-execution:c3:${mediaId}-video-frames:${brandId}`,
      normalizationContractVersion:
        INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
      startedAt: capturedAt,
      completedAt: capturedAt,
      capturedAt,
      availability: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: ["C3_W1_VIDEO_FIXTURE"],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "COMPLETE",
        failureCategories: [],
        detailCodes: [],
      },
      artifacts: payloads.map((payload, index) => ({
        artifactKey: `frame-${index}`,
        payload,
      })),
      evidence: payloads.map((payload, index) => ({
        evidenceKey: `frame-${index}`,
        artifactKey: `frame-${index}`,
        payload,
        freshness: "CURRENT",
        representativeness: "CONTEXT_SPECIFIC",
      })),
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

  async function c3RowCounts() {
    const where = {
      brandId,
      normalizationContractVersion: "instagram.per-media-semantics.c3.v1",
    };
    return {
      evidence: await prisma.dataExtractionEvidenceItem.count({ where }),
      observations: await prisma.dataExtractionSemanticObservation.count({
        where: {
          brandId,
          semanticObservationKey: { startsWith: "instagram-c3:" },
        },
      }),
      supports: await prisma.dataExtractionObservationSupport.count({
        where: {
          brandId,
          evidence: {
            normalizationContractVersion: "instagram.per-media-semantics.c3.v1",
          },
        },
      }),
    };
  }

  async function c3RowsForMedia(mediaId: string) {
    const rows = await prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId,
        normalizationContractVersion: "instagram.per-media-semantics.c3.v1",
        boundedPayload: { path: ["mediaId"], equals: mediaId },
      },
      include: { observationSupports: true },
      orderBy: { evidenceRef: "asc" },
    });
    return rows.map((row) => ({
      evidenceRef: row.evidenceRef,
      contentHash: row.contentHash,
      observationKey: row.semanticObservationKey,
      parentEvidenceRefs: row.parentEvidenceRefs,
      provenance: row.provenance,
      supports: row.observationSupports.map((support) => ({
        observationKey: support.semanticObservationKey,
        evidenceRef: support.evidenceRef,
        capabilityId: support.capabilityId,
      })),
    }));
  }

  function evidenceRefsFrom(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(evidenceRefsFrom);
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const own = Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((ref): ref is string => typeof ref === "string")
      : [];
    return [
      ...own,
      ...Object.entries(row)
        .filter(([key]) => key !== "evidenceRefs")
        .flatMap(([, child]) => evidenceRefsFrom(child)),
    ];
  }

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
});
