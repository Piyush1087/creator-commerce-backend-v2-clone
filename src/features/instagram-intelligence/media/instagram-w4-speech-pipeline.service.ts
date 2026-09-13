import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { InstagramIntelligenceAuthorizedVideoAcquisitionService } from "../../brand-settings/services/instagram-intelligence-video-acquisition.service";
import { canonicalJson } from "../../brand-intelligence/contracts/bundle/canonical-json";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import { InstagramAudioExtractorPort } from "../../instagram/media/video/instagram-audio-extractor";
import {
  INSTAGRAM_AUDIO_EXTRACTION_PROFILE,
  INSTAGRAM_SPEECH_ANALYSIS_PROFILE,
  INSTAGRAM_SPEECH_CUE_FINALIZER_VERSION,
  INSTAGRAM_SPEECH_NORMALIZATION_VERSION,
  INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
  INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
  InstagramSpeechTranscriptionPort,
  finalizeInstagramSpeechTranscript,
  finalizeInstagramSpokenCues,
  type InstagramTemporaryAudioArtifact,
} from "../../instagram/media/video/instagram-speech";
import { InstagramVideoDecoderPort } from "../../instagram/media/video/instagram-video-decoder";
import { InstagramVideoTemporaryStore } from "../../instagram/media/video/instagram-video-temporary-store";
import type { InstagramTemporaryVideoArtifact } from "../../instagram/media/video/instagram-video.types";

export type InstagramW4SpeechResult = Readonly<{
  state: "OBSERVED" | "EXPLICIT_EMPTY" | "UNKNOWN";
  reasonCode: string;
  segmentCount: number;
  reused: boolean;
  evidenceRefs: readonly string[];
}>;

@Injectable()
export class InstagramW4SpeechPipelineService {
  private readonly logger = new Logger(InstagramW4SpeechPipelineService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly acquisition: InstagramIntelligenceAuthorizedVideoAcquisitionService,
    private readonly decoder: InstagramVideoDecoderPort,
    private readonly extractor: InstagramAudioExtractorPort,
    private readonly transcription: InstagramSpeechTranscriptionPort,
    private readonly writer: InstagramCaptureWriterService,
    private readonly store: InstagramVideoTemporaryStore,
  ) {}

  isEnabled() {
    return (
      this.config
        .get<string>("INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED")
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
  }): Promise<InstagramW4SpeechResult> {
    const now = input.now ?? (() => new Date());
    const startedAt = now().toISOString();
    let video: InstagramTemporaryVideoArtifact | undefined;
    let audio: InstagramTemporaryAudioArtifact | undefined;
    try {
      await this.acquisition.assertReplayAuthorized({
        brandProfileId: input.brandProfileId,
        integrationId: input.integrationId,
        expectedProviderAccountId: input.providerAccountId,
        expectedAuthorizationGeneration: input.authorizationGeneration,
      });
      const offerings = await this.prisma.offering.findMany({
        where: { brandProfileId: input.brandProfileId, isActive: true },
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      });
      const offeringSnapshot = digest(
        offerings.map((row) => ({ id: row.id, name: normalize(row.name) })),
      );
      const preIdentity = digest({
        brandProfileId: input.brandProfileId,
        integrationId: input.integrationId,
        providerAccountId: input.providerAccountId,
        authorizationGeneration: input.authorizationGeneration,
        mediaId: input.mediaId,
        sourceCaptureRef: input.sourceCaptureRef,
        sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
        windowEnd: input.windowEnd.toISOString(),
        speechProfile: INSTAGRAM_SPEECH_ANALYSIS_PROFILE,
        audioProfile: INSTAGRAM_AUDIO_EXTRACTION_PROFILE,
        transcriptContract: INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
        promptProfile: INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
        provider: this.transcription.providerIdentity,
        model: this.transcription.modelIdentity,
        modelProfile: this.transcription.modelProfileVersion,
        cueFinalizer: INSTAGRAM_SPEECH_CUE_FINALIZER_VERSION,
        offeringSnapshot,
      });
      const replay = await this.loadReplay(input, preIdentity);
      if (replay) {
        this.logger.log(
          `instagram.w4_speech replay=REUSED state=${replay.state} segments=${replay.segmentCount} current_preserved=true`,
        );
        return replay;
      }
      const acquired = await this.acquisition.acquire({
        brandProfileId: input.brandProfileId,
        integrationId: input.integrationId,
        expectedProviderAccountId: input.providerAccountId,
        expectedAuthorizationGeneration: input.authorizationGeneration,
        mediaId: input.mediaId,
        ...(input.now ? { now: input.now } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      });
      video = acquired.artifact;
      const probe = await this.decoder.probe(video, input.signal);
      audio = await this.extractor.extract({
        video,
        isolationScope: input.brandProfileId,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      const candidate = await this.transcription.transcribe({
        audio,
        verifiedDurationMs: probe.durationMilliseconds,
        promptProfileVersion: INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
        transcriptContractVersion: INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
        untrustedAudioIsDataOnly: true,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      const transcript = finalizeInstagramSpeechTranscript(
        candidate,
        probe.durationMilliseconds,
      );
      const cues = finalizeInstagramSpokenCues(transcript, offerings);
      const executionIdentity = digest({
        preIdentity,
        verifiedVideoFingerprint: video.sha256,
      });
      const metadata = {
        preAcquisitionReplayIdentity: preIdentity,
        executionIdentity,
        providerMediaId: input.mediaId,
        verifiedVideoFingerprint: video.sha256,
        sourceCaptureRef: input.sourceCaptureRef,
        sourceEvidenceRefs: [...input.sourceEvidenceRefs].sort(),
        speechProfile: INSTAGRAM_SPEECH_ANALYSIS_PROFILE,
        audioProfile: INSTAGRAM_AUDIO_EXTRACTION_PROFILE,
        transcriptContractVersion: INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
        promptProfileVersion: INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
        modelProvider: this.transcription.providerIdentity,
        modelIdentity: this.transcription.modelIdentity,
        modelProfileVersion: this.transcription.modelProfileVersion,
        offeringSnapshot,
        transcriptState: transcript.state,
        segmentCount: transcript.segments.length,
        cleanupPolicy: "NONE_AFTER_EXECUTION",
      } as const;
      const lineage = await this.writer.write({
        brandId: input.brandProfileId,
        providerAccountId: input.providerAccountId,
        authorizationGeneration: input.authorizationGeneration,
        resourceType: "INSTAGRAM_MEDIA",
        mediaId: input.mediaId,
        capabilityId: "instagram.media_audio_observations",
        requestKey: `w4-speech:${executionIdentity}`,
        providerExecutionRef: `provider-execution:instagram:${executionIdentity}`,
        normalizationContractVersion: INSTAGRAM_SPEECH_NORMALIZATION_VERSION,
        startedAt,
        completedAt: now().toISOString(),
        capturedAt: video.acquiredAt,
        availability: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: [
          transcript.state === "OBSERVED"
            ? "W4_SPEECH_OBSERVED"
            : "W4_SPEECH_EXPLICIT_EMPTY",
        ],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "COMPLETE",
          failureCategories: [],
          detailCodes: [`SEGMENTS_${transcript.segments.length}`],
        },
        artifacts: [
          {
            artifactKey: "audio-technical",
            payload: {
              ...metadata,
              audio: {
                byteLength: audio.byteLength,
                sha256: audio.sha256,
                mediaType: audio.mediaType,
                channels: audio.channels,
                sampleRateHz: audio.sampleRateHz,
                sampleFormat: audio.sampleFormat,
              },
            },
          },
        ],
        evidence: [
          {
            evidenceKey: "audio-technical",
            artifactKey: "audio-technical",
            payload: { ...metadata, audioAvailable: true },
            freshness: "CURRENT",
            representativeness: "CONTEXT_SPECIFIC",
          },
          {
            evidenceKey: "transcript",
            payload: { ...metadata, transcript, cues },
            freshness: "CURRENT",
            representativeness: "CONTEXT_SPECIFIC",
            semanticObservationKey: `instagram:speech:${executionIdentity}`,
            derivationParentEvidenceKey: "audio-technical",
          },
        ],
      });
      const characterCount = transcript.segments.reduce(
        (sum, segment) => sum + segment.text.length,
        0,
      );
      this.logger.log(
        `instagram.w4_speech extraction=SUCCESS audio_size=${audioSizeClass(audio.byteLength)} transcription=${transcript.state} segments=${transcript.segments.length} characters=${characterCount} provider=${this.transcription.providerIdentity} model=${this.transcription.modelIdentity} hook=${cues.hook ? 1 : 0} cta=${cues.ctaPhrases.length} offering=${cues.canonicalOfferingId ? 1 : 0} replay=NEW current_preserved=true`,
      );
      return {
        state: transcript.state,
        reasonCode:
          transcript.state === "OBSERVED"
            ? "SPEECH_OBSERVED"
            : "NO_INTELLIGIBLE_SPEECH",
        segmentCount: transcript.segments.length,
        reused: lineage.reused,
        evidenceRefs: lineage.evidenceRefs,
      };
    } catch (error) {
      this.logger.warn(
        `instagram.w4_speech extraction=${failureCategory(error, input.signal)} transcription=UNKNOWN replay=NONE current_preserved=true`,
      );
      return {
        state: "UNKNOWN",
        reasonCode: "SPEECH_UNAVAILABLE",
        segmentCount: 0,
        reused: false,
        evidenceRefs: [],
      };
    } finally {
      await this.removeTemporary(audio?.temporaryPath, "AUDIO");
      await this.removeTemporary(video?.temporaryPath, "VIDEO");
    }
  }

  private async removeTemporary(path: string | undefined, kind: string) {
    if (!path) return;
    try {
      await this.store.remove(path);
      this.logger.log(`instagram.w4_speech cleanup=${kind}_SUCCESS`);
    } catch (error) {
      this.logger.warn(
        `instagram.w4_speech cleanup=${kind}_FAILURE category=${failureCategory(error, undefined)}`,
      );
    }
  }

  private async loadReplay(
    input: {
      brandProfileId: string;
      providerAccountId: string;
      authorizationGeneration: number;
    },
    identity: string,
  ) {
    const rows = await this.prisma.dataExtractionEvidenceItem.findMany({
      where: {
        brandId: input.brandProfileId,
        capabilityId: "instagram.media_audio_observations",
        normalizationContractVersion: INSTAGRAM_SPEECH_NORMALIZATION_VERSION,
        boundedPayload: {
          path: ["preAcquisitionReplayIdentity"],
          equals: identity,
        },
        capture: {
          status: "COMPLETED",
          providerAccountId: input.providerAccountId,
          authorizationGeneration: input.authorizationGeneration,
        },
      },
      select: {
        evidenceRef: true,
        boundedPayload: true,
        captureMethodClass: true,
      },
      orderBy: { evidenceRef: "asc" },
    });
    if (rows.length !== 2) return null;
    const payload = rows
      .map((row) => record(row.boundedPayload))
      .find(
        (row) =>
          row.transcriptState === "OBSERVED" ||
          row.transcriptState === "EXPLICIT_EMPTY",
      );
    if (!payload) return null;
    const count = Number(payload.segmentCount);
    if (!Number.isSafeInteger(count) || count < 0 || count > 120) return null;
    const evidenceRefs = [...rows]
      .sort((left, right) =>
        left.captureMethodClass === right.captureMethodClass
          ? left.evidenceRef.localeCompare(right.evidenceRef)
          : left.captureMethodClass === "PROVIDER_MEDIATED_FETCH"
            ? -1
            : 1,
      )
      .map((row) => row.evidenceRef);
    return {
      state: payload.transcriptState as "OBSERVED" | "EXPLICIT_EMPTY",
      reasonCode: "EXACT_SPEECH_EXECUTION_REUSED",
      segmentCount: count,
      reused: true,
      evidenceRefs,
    };
  }
}

function digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
function normalize(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function audioSizeClass(byteLength: number) {
  if (byteLength <= 256 * 1024) return "SMALL";
  if (byteLength <= 2 * 1024 * 1024) return "MEDIUM";
  return "LARGE_BOUNDED";
}

function failureCategory(error: unknown, signal: AbortSignal | undefined) {
  if (signal?.aborted) return "ABORT";
  const message = error instanceof Error ? error.message : "";
  if (/TIMEOUT/u.test(message)) return "TIMEOUT";
  if (/NO_AUDIO|AUDIO_TRACK/u.test(message)) return "NO_AUDIO_TRACK";
  if (/TEMPORARY_STORAGE/u.test(message)) return "TEMPORARY_STORAGE";
  if (/SPEECH_PROVIDER_UNCONFIGURED/u.test(message)) return "UNCONFIGURED";
  if (/TRANSCRIPT|ZOD|INVALID/u.test(message.toUpperCase()))
    return "INVALID_OUTPUT";
  return "FAILURE";
}
