import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramIntelligenceAuthorizedVideoAcquisitionService } from "../../brand-settings/services/instagram-intelligence-video-acquisition.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramVideoDecoderPort } from "../../instagram/media/video/instagram-video-decoder";
import { InstagramVideoTemporaryStore } from "../../instagram/media/video/instagram-video-temporary-store";
import {
  INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
  INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
  INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
  INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE,
  INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
  assertInstagramExtractedFrame,
  selectInstagramVideoFrameTimestamps,
  type InstagramExtractedFrame,
  type InstagramTemporaryVideoArtifact,
  InstagramVideoError,
} from "../../instagram/media/video/instagram-video.types";
import {
  InstagramW1VideoFrameModelPort,
  instagramW1VideoFrameObservationSchema,
} from "./instagram-w1-video-frame-observation";

export type InstagramW1VideoResult = Readonly<{
  visualInspection: "INSPECTED" | "UNAVAILABLE";
  visualSemanticResult: "AVAILABLE" | "UNKNOWN";
  reasonCode: string;
  framesRequested: number;
  framesExtracted: number;
  framesObserved: number;
  reused: boolean;
  evidenceRefs: readonly string[];
}>;

@Injectable()
export class InstagramW1VideoPipelineService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly acquisition: InstagramIntelligenceAuthorizedVideoAcquisitionService,
    private readonly decoder: InstagramVideoDecoderPort,
    private readonly model: InstagramW1VideoFrameModelPort,
    private readonly writer: InstagramCaptureWriterService,
    private readonly store: InstagramVideoTemporaryStore,
  ) {}

  isEnabled() {
    return (
      this.config
        .get<string>("INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED")
        ?.trim()
        .toLowerCase() === "true"
    );
  }

  async execute(input: {
    brandProfileId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    mediaId: string;
    windowEnd: Date;
    sourceCaptureRef: string;
    sourceEvidenceRefs: readonly string[];
    now?: () => Date;
    signal?: AbortSignal;
  }): Promise<InstagramW1VideoResult> {
    validateInput(input);
    const now = input.now ?? (() => new Date());
    const startedAt = now().toISOString();
    let video: InstagramTemporaryVideoArtifact | undefined;
    let frames: readonly InstagramExtractedFrame[] = [];
    try {
      const acquired = await this.acquisition.acquire({
        brandProfileId: input.brandProfileId,
        integrationId: input.integrationId,
        expectedProviderAccountId: input.providerAccountId,
        expectedAuthorizationGeneration: input.authorizationGeneration,
        mediaId: input.mediaId,
        now,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      video = acquired.artifact;
      const executionIdentity = digestCanonical({
        brandProfileId: input.brandProfileId,
        providerAccountId: input.providerAccountId,
        authorizationGeneration: input.authorizationGeneration,
        providerMediaId: input.mediaId,
        sourceCaptureRef: input.sourceCaptureRef,
        sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
        sourceCaptureWindowEnd: input.windowEnd.toISOString(),
        verifiedVideoFingerprint: video.sha256,
        videoAnalysisProfile: INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
        frameSelectionProfile: INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE,
        frameObservationContract:
          INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
        framePromptProfile: INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
        modelProvider: this.model.providerIdentity,
        modelIdentity: this.model.modelIdentity,
        modelProfileVersion: this.model.modelProfileVersion,
      });
      const replay = await this.loadReplay(input, executionIdentity);
      if (replay.length > 0) {
        return {
          visualInspection: "INSPECTED",
          visualSemanticResult: "AVAILABLE",
          reasonCode: "EXACT_VIDEO_EXECUTION_REUSED",
          framesRequested: replay.length,
          framesExtracted: replay.length,
          framesObserved: replay.length,
          reused: true,
          evidenceRefs: replay,
        };
      }

      const probe = await this.decoder.probe(video, input.signal);
      const timestamps = selectInstagramVideoFrameTimestamps(
        probe.durationMilliseconds,
      );
      frames = await this.decoder.extractFrames({
        artifact: video,
        timestampsMilliseconds: timestamps,
        isolationScope: input.brandProfileId,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      const successful: Array<{
        frame: InstagramExtractedFrame;
        observation: ReturnType<
          typeof instagramW1VideoFrameObservationSchema.parse
        >;
      }> = [];
      for (const frame of frames) {
        assertInstagramExtractedFrame(frame);
        try {
          const candidate = await this.model.observe({
            providerMediaId: input.mediaId,
            verifiedVideoFingerprint: video.sha256,
            frame,
            promptProfileVersion: INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
            observationContractVersion:
              INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
          });
          successful.push({
            frame,
            observation:
              instagramW1VideoFrameObservationSchema.parse(candidate),
          });
        } catch {
          // Partial frame success is explicit below; no failed model payload is persisted.
        }
      }
      const elapsedMilliseconds = Math.max(
        0,
        now().getTime() - Date.parse(startedAt),
      );
      const basePayload = {
        providerMediaId: input.mediaId,
        verifiedVideoFingerprint: video.sha256,
        videoAnalysisProfile: INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
        frameSelectionProfile: INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE,
        observationContractVersion:
          INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
        promptProfileVersion: INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
        modelProvider: this.model.providerIdentity,
        modelIdentity: this.model.modelIdentity,
        modelProfileVersion: this.model.modelProfileVersion,
        executionIdentity,
        sourceCaptureRef: input.sourceCaptureRef,
        sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
        inspectionDepth: "MULTI_FRAME_SAMPLED",
        limitations: [
          "SAMPLED_FRAMES_ARE_NOT_COMPLETE_VIDEO",
          "AUDIO_NOT_ANALYZED",
          "TRANSCRIPT_NOT_ACQUIRED",
          "TEMPORAL_SEQUENCE_NOT_ANALYZED",
        ],
      } as const;
      const artifacts = [
        {
          artifactKey: "verified-video-metadata",
          payload: {
            ...basePayload,
            byteLength: video.byteLength,
            mediaType: video.mediaType,
            probe,
            framesRequested: timestamps.length,
            framesExtracted: frames.length,
            framesObserved: successful.length,
            processingLatencyMilliseconds: elapsedMilliseconds,
            cleanupPolicy: "NONE_AFTER_EXECUTION",
          },
        },
        ...successful.map(({ frame }) => ({
          artifactKey: `frame-${frame.ordinal}`,
          payload: frameMetadata(frame, video!.sha256),
        })),
      ];
      const evidence = successful.map(({ frame, observation }) => ({
        evidenceKey: `frame-${frame.ordinal}`,
        artifactKey: `frame-${frame.ordinal}`,
        payload: {
          ...basePayload,
          frame: frameMetadata(frame, video!.sha256),
          observation,
        },
        freshness: "CURRENT" as const,
        representativeness: "CONTEXT_SPECIFIC" as const,
        semanticObservationKey: `instagram:video-frame:${digestCanonical({ executionIdentity, ordinal: frame.ordinal })}`,
      }));
      const availability =
        successful.length === timestamps.length &&
        frames.length === timestamps.length
          ? "AVAILABLE"
          : "PARTIAL";
      const lineage = await this.writer.write({
        brandId: input.brandProfileId,
        providerAccountId: input.providerAccountId,
        authorizationGeneration: input.authorizationGeneration,
        resourceType: "INSTAGRAM_MEDIA",
        mediaId: input.mediaId,
        capabilityId: "instagram.media_visual_observations",
        requestKey: `w1-video:${executionIdentity}`,
        providerExecutionRef: `provider-execution:instagram:${executionIdentity}`,
        normalizationContractVersion:
          INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
        startedAt,
        completedAt: now().toISOString(),
        capturedAt: video.acquiredAt,
        ...(acquired.providerObservedAt
          ? { observedAt: acquired.providerObservedAt }
          : {}),
        availability,
        retryability:
          availability === "AVAILABLE" ? "NOT_APPLICABLE" : "RETRYABLE",
        reasonCodes: [
          availability === "AVAILABLE"
            ? "W1_SELECTED_VIDEO_FRAMES_AVAILABLE"
            : "W1_SELECTED_VIDEO_FRAMES_PARTIAL",
        ],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: availability === "AVAILABLE" ? "COMPLETE" : "PARTIAL",
          failureCategories:
            availability === "AVAILABLE" ? [] : ["VIDEO_FRAME_OBSERVATION"],
          detailCodes: [
            `REQUESTED_${timestamps.length}`,
            `EXTRACTED_${frames.length}`,
            `OBSERVED_${successful.length}`,
          ],
        },
        artifacts,
        evidence,
      });
      return {
        visualInspection: successful.length ? "INSPECTED" : "UNAVAILABLE",
        visualSemanticResult: successful.length ? "AVAILABLE" : "UNKNOWN",
        reasonCode:
          availability === "AVAILABLE"
            ? "MULTI_FRAME_INSPECTED"
            : successful.length
              ? "PARTIAL_FRAME_INSPECTION"
              : "MODEL_FAILURE",
        framesRequested: timestamps.length,
        framesExtracted: frames.length,
        framesObserved: successful.length,
        reused: lineage.reused,
        evidenceRefs: lineage.evidenceRefs,
      };
    } catch (error) {
      if (error instanceof InstagramVideoError) {
        try {
          const failureIdentity = digestCanonical({
            brandProfileId: input.brandProfileId,
            providerAccountId: input.providerAccountId,
            authorizationGeneration: input.authorizationGeneration,
            providerMediaId: input.mediaId,
            sourceCaptureRef: input.sourceCaptureRef,
            sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
            videoAnalysisProfile: INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
            frameSelectionProfile: INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE,
            verifiedVideoFingerprint: video?.sha256 ?? null,
            failureCategory: error.code,
          });
          await this.writer.write({
            brandId: input.brandProfileId,
            providerAccountId: input.providerAccountId,
            authorizationGeneration: input.authorizationGeneration,
            resourceType: "INSTAGRAM_MEDIA",
            mediaId: input.mediaId,
            capabilityId: "instagram.media_visual_observations",
            requestKey: `w1-video-failure:${failureIdentity}`,
            providerExecutionRef: `provider-execution:instagram:${failureIdentity}`,
            normalizationContractVersion:
              INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
            startedAt,
            completedAt: now().toISOString(),
            ...(video ? { capturedAt: video.acquiredAt } : {}),
            availability: video ? "PARTIAL" : "UNAVAILABLE",
            retryability: ["UNSAFE_URL", "UNSAFE_DNS"].includes(error.code)
              ? "NON_RETRYABLE"
              : "RETRYABLE",
            reasonCodes: [`W1_VIDEO_${error.code}`],
            coverage: "SINGLE_RESOURCE",
            acquisitionQuality: {
              state: video ? "PARTIAL" : "UNAVAILABLE",
              failureCategories: ["VIDEO_PROCESSING"],
              detailCodes: [error.code],
            },
            artifacts: video
              ? [
                  {
                    artifactKey: "verified-video-metadata",
                    payload: {
                      providerMediaId: input.mediaId,
                      verifiedVideoFingerprint: video.sha256,
                      mediaType: video.mediaType,
                      byteLength: video.byteLength,
                      videoAnalysisProfile: INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
                      cleanupPolicy: "NONE_AFTER_EXECUTION",
                    },
                  },
                ]
              : [],
            evidence: [],
          });
        } catch {
          return {
            visualInspection: "UNAVAILABLE",
            visualSemanticResult: "UNKNOWN",
            reasonCode: "FINAL_FENCE_REJECTED",
            framesRequested: 0,
            framesExtracted: frames.length,
            framesObserved: 0,
            reused: false,
            evidenceRefs: [],
          };
        }
      }
      return {
        visualInspection: "UNAVAILABLE",
        visualSemanticResult: "UNKNOWN",
        reasonCode:
          error instanceof InstagramVideoError
            ? error.code
            : "FINAL_FENCE_REJECTED",
        framesRequested: 0,
        framesExtracted: frames.length,
        framesObserved: 0,
        reused: false,
        evidenceRefs: [],
      };
    } finally {
      await Promise.all(
        frames.map((frame) =>
          this.store.remove(frame.temporaryPath).catch(() => undefined),
        ),
      );
      if (video)
        await this.store.remove(video.temporaryPath).catch(() => undefined);
    }
  }

  private async loadReplay(
    input: {
      brandProfileId: string;
      providerAccountId: string;
      authorizationGeneration: number;
    },
    executionIdentity: string,
  ) {
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: input.brandProfileId,
        capabilityId: "instagram.media_visual_observations",
        normalizationContractVersion:
          INSTAGRAM_VIDEO_NORMALIZATION_CONTRACT_VERSION,
        boundedPayload: {
          path: ["executionIdentity"],
          equals: executionIdentity,
        },
        capture: {
          status: "COMPLETED",
          providerAccountId: input.providerAccountId,
          authorizationGeneration: input.authorizationGeneration,
        },
      },
      select: { evidenceRef: true },
      orderBy: { evidenceRef: "asc" },
    });
    return rows.map((row) => row.evidenceRef);
  }
}

function frameMetadata(
  frame: InstagramExtractedFrame,
  videoFingerprint: string,
) {
  return {
    verifiedVideoFingerprint: videoFingerprint,
    frameOrdinal: frame.ordinal,
    requestedTimestampMilliseconds: frame.requestedTimestampMilliseconds,
    actualTimestampMilliseconds: frame.actualTimestampMilliseconds,
    mediaType: frame.mediaType,
    byteLength: frame.byteLength,
    width: frame.width,
    height: frame.height,
    contentHash: frame.sha256,
  };
}

function validateInput(input: {
  brandProfileId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  mediaId: string;
  windowEnd: Date;
  sourceCaptureRef: string;
  sourceEvidenceRefs: readonly string[];
}) {
  if (
    !input.brandProfileId.trim() ||
    !input.integrationId.trim() ||
    !input.providerAccountId.trim() ||
    !Number.isSafeInteger(input.authorizationGeneration) ||
    input.authorizationGeneration < 1 ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.mediaId) ||
    !input.sourceCaptureRef.trim() ||
    input.sourceEvidenceRefs.length === 0 ||
    input.sourceEvidenceRefs.some((ref) => !ref.trim()) ||
    !Number.isFinite(input.windowEnd.getTime())
  )
    throw new InstagramVideoError("INVALID_VIDEO");
}

function digestCanonical(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`)
    .join(",")}}`;
}
