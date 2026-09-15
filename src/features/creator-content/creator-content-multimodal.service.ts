import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import { canonicalJson } from "../brand-intelligence/contracts/bundle/canonical-json";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  INSTAGRAM_CAROUSEL_MAX_CHILDREN,
  type InstagramIntelligenceProviderReadClient,
  type InstagramField,
} from "../instagram/instagram-intelligence-provider.types";
import { InstagramContainedImageAcquisitionService } from "../instagram/media/instagram-contained-image-acquisition.service";
import { InstagramImageTemporaryStore } from "../instagram/media/instagram-image-temporary-store";
import { InstagramContainedVideoAcquisitionService } from "../instagram/media/video/instagram-contained-video-acquisition.service";
import { InstagramVideoTemporaryStore } from "../instagram/media/video/instagram-video-temporary-store";
import { InstagramVideoDecoderPort } from "../instagram/media/video/instagram-video-decoder";
import { InstagramAudioExtractorPort } from "../instagram/media/video/instagram-audio-extractor";
import {
  InstagramVisualTextModelPort,
  finalizeInstagramVisualText,
  INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
  INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
} from "../instagram/media/instagram-visual-text";
import {
  InstagramSpeechTranscriptionPort,
  finalizeInstagramSpeechTranscript,
  INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
  INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
  INSTAGRAM_AUDIO_EXTRACTION_PROFILE,
  INSTAGRAM_SPEECH_ANALYSIS_PROFILE,
} from "../instagram/media/video/instagram-speech";
import {
  InstagramB3aVisualModelPort,
  instagramB3aVisualObservationSchema,
  INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
  INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
} from "../instagram-intelligence/media/instagram-b3a-visual-observation";
import {
  InstagramW1VideoFrameModelPort,
  instagramW1VideoFrameObservationSchema,
} from "../instagram-intelligence/media/instagram-w1-video-frame-observation";
import {
  selectInstagramVideoFrameTimestamps,
  assertInstagramExtractedFrame,
  INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
  INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
  INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
  INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE,
  type InstagramExtractedFrame,
  type InstagramTemporaryVideoArtifact,
} from "../instagram/media/video/instagram-video.types";
import type { CreatorContentSemanticObservation } from "./creator-content-calculator";
import type {
  CreatorContentSemanticAnalyzer,
  CreatorContentSemanticInput,
} from "./creator-content-semantic.port";

const label = z
  .object({
    value: z.string().trim().min(1).max(100),
    supportingIdentities: z.array(z.string().min(1).max(255)).min(1).max(24),
  })
  .strict();
export const creatorContentGroundedCandidateSchema = z
  .object({
    themes: z.array(label).max(8),
    captionPatterns: z.array(label).max(8),
    creativeStructures: z.array(label).max(8),
    visualExecution: z.array(label).max(8),
  })
  .strict();

type Modality = NonNullable<
  CreatorContentSemanticObservation["provenance"]
>["modalities"][number];
export abstract class CreatorContentGroundedModelPort {
  abstract readonly providerIdentity: string;
  abstract readonly modelIdentity: string;
  abstract readonly modelProfileVersion: string;
  abstract classify(
    input: Readonly<{
      providerMediaId: string;
      caption: string | null;
      sourceEvidenceRef: string;
      observations: readonly Modality[];
      profileVersion: "creator-content-semantic-v0.1";
      untrustedSourceIsDataOnly: true;
    }>,
  ): Promise<unknown>;
}
export class UnavailableCreatorContentGroundedModel extends CreatorContentGroundedModelPort {
  readonly providerIdentity = "UNCONFIGURED";
  readonly modelIdentity = "UNCONFIGURED";
  readonly modelProfileVersion = "UNCONFIGURED";
  async classify(): Promise<never> {
    throw new Error("CONTENT_SEMANTIC_MODEL_UNCONFIGURED");
  }
}

/** Creator adapter over accepted provider-neutral security/modality primitives. No Brand lifecycle or metrics. */
@Injectable()
export class CreatorContentMultimodalService implements CreatorContentSemanticAnalyzer {
  constructor(
    private readonly config: ConfigService,
    private readonly fence: CreatorAudienceCredentialFenceService,
    @Inject(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    private readonly provider: InstagramIntelligenceProviderReadClient,
    private readonly image: InstagramContainedImageAcquisitionService,
    private readonly imageStore: InstagramImageTemporaryStore,
    private readonly video: InstagramContainedVideoAcquisitionService,
    private readonly videoStore: InstagramVideoTemporaryStore,
    private readonly decoder: InstagramVideoDecoderPort,
    private readonly audio: InstagramAudioExtractorPort,
    private readonly visual: InstagramB3aVisualModelPort,
    private readonly ocr: InstagramVisualTextModelPort,
    private readonly frameModel: InstagramW1VideoFrameModelPort,
    private readonly speech: InstagramSpeechTranscriptionPort,
    private readonly grounded: CreatorContentGroundedModelPort,
  ) {}

  replayProfileIdentity(): string {
    return digest({
      version: "creator-content-multimodal-v0.1",
      windowDays: 90,
      switches: [
        "INSTAGRAM_IMAGE_VISUAL_ENABLED",
        "INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED",
        "INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED",
      ].map((name) => [name, this.enabled(name)]),
      models: [
        this.visual,
        this.ocr,
        this.frameModel,
        this.speech,
        this.grounded,
      ].map((model) => [
        model.providerIdentity,
        model.modelIdentity,
        model.modelProfileVersion,
      ]),
      profiles: [
        INSTAGRAM_VIDEO_ANALYSIS_PROFILE,
        INSTAGRAM_VIDEO_FRAME_SELECTION_PROFILE,
        INSTAGRAM_AUDIO_EXTRACTION_PROFILE,
        INSTAGRAM_SPEECH_ANALYSIS_PROFILE,
        INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
        INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
        INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
        INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
        INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
        INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
        INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
        INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
      ],
    });
  }
  private enabled(name: string) {
    return this.config.get<string>(name)?.trim().toLowerCase() === "true";
  }

  async analyze(
    input: CreatorContentSemanticInput,
  ): Promise<CreatorContentSemanticObservation> {
    await this.assertFence(input);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.media.providerMediaId))
      throw new Error("CONTENT_MEDIA_ID_REJECTED");
    const modalities: Modality[] = [];
    const type = observed(input.media.mediaType);
    const product = observed(input.media.mediaProductType);
    const credential = () => this.fence.acquire(input.actor, input.identity);
    const scope = `creator:${input.actor.subjectCreatorProfileId}`;
    const inspectImage = async (
      mediaId: string,
      ordinal: number,
      cover: boolean,
    ) => {
      const supportIdentity = `${input.media.providerMediaId}:${mediaId}:${ordinal}:${cover ? "VIDEO_COVER_ONLY" : "IMAGE_FULL"}`;
      if (!this.enabled("INSTAGRAM_IMAGE_VISUAL_ENABLED")) {
        modalities.push({
          supportIdentity,
          mode: cover ? "VIDEO_COVER_ONLY" : "IMAGE_FULL",
          state: "UNAVAILABLE",
          observations: [],
        });
        return;
      }
      let path: string | undefined;
      let contentHash: string | undefined;
      const observations: unknown[] = [];
      try {
        await this.assertFence(input);
        const acquired = await this.image.acquire({
          credential: await credential(),
          mediaId,
          isolationScope: scope,
          locatorKind: cover
            ? "VIDEO_COVER"
            : mediaId === input.media.providerMediaId
              ? "IMAGE"
              : "CAROUSEL_CHILD",
        });
        path = acquired.artifact.temporaryPath;
        if (acquired.providerMediaId !== mediaId)
          throw new Error("CONTENT_CHILD_SUBSTITUTION");
        contentHash = acquired.artifact.sha256;
        const artifact = acquired.artifact;
        try {
          observations.push({
            kind: "VISUAL",
            contract: INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
            value: instagramB3aVisualObservationSchema.parse(
              await this.visual.observe({
                ...artifact,
                promptProfileVersion: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
                observationContractVersion:
                  INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
              }),
            ),
          });
        } catch {
          /* failed observation is not empty */
        }
        try {
          observations.push({
            kind: "OCR",
            contract: INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
            value: finalizeInstagramVisualText(
              await this.ocr.observe({
                ...artifact,
                promptProfileVersion:
                  INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
                observationContractVersion:
                  INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
                untrustedImageTextIsDataOnly: true,
              }),
            ),
          });
        } catch {
          /* UNKNOWN, not negative */
        }
      } catch (error) {
        if (error instanceof Error && /SUBSTITUTION|FENCE/.test(error.message))
          throw error;
      } finally {
        if (path) await this.imageStore.remove(path);
      }
      modalities.push({
        supportIdentity,
        mode: cover ? "VIDEO_COVER_ONLY" : "IMAGE_FULL",
        state:
          observations.length === 2
            ? "AVAILABLE"
            : observations.length
              ? "PARTIAL"
              : "UNKNOWN",
        ...(contentHash ? { contentHash } : {}),
        observations,
      });
    };
    if (type === "CAROUSEL_ALBUM") {
      const children = await this.provider.readCarouselChildren(
        await credential(),
        input.media.providerMediaId,
      );
      if (
        children.children.length > INSTAGRAM_CAROUSEL_MAX_CHILDREN ||
        new Set(children.children.map((child) => child.providerMediaId))
          .size !== children.children.length ||
        new Set(children.children.map((child) => child.ordinal)).size !==
          children.children.length ||
        children.children.some(
          (child) =>
            !Number.isInteger(child.ordinal) ||
            child.ordinal < 0 ||
            child.ordinal >= INSTAGRAM_CAROUSEL_MAX_CHILDREN ||
            child.providerMediaId === input.media.providerMediaId,
        )
      )
        throw new Error("CONTENT_CHILD_MANIFEST_REJECTED");
      modalities.push({
        supportIdentity: `${input.media.providerMediaId}:enumeration`,
        mode: "CHILD_ENUMERATION",
        state:
          children.availability === "AVAILABLE" &&
          children.stopReason === "EXHAUSTED"
            ? "AVAILABLE"
            : children.children.length
              ? "PARTIAL"
              : "UNKNOWN",
        observations: [
          {
            availability: children.availability,
            stopReason: children.stopReason,
            children: children.children.map((child) => ({
              providerMediaId: child.providerMediaId,
              ordinal: child.ordinal,
              mediaType: observed(child.mediaType),
            })),
          },
        ],
      });
      // Sequential parent/child processing bounds fan-out to one; maximum 24 * 10 acquisitions.
      for (const child of [...children.children].sort(
        (a, b) => a.ordinal - b.ordinal,
      )) {
        const childType = observed(child.mediaType);
        if (
          childType === "IMAGE" ||
          childType === "VIDEO" ||
          childType === "REEL"
        )
          await inspectImage(
            child.providerMediaId,
            child.ordinal,
            childType !== "IMAGE",
          );
        else
          modalities.push({
            supportIdentity: `${input.media.providerMediaId}:${child.providerMediaId}:${child.ordinal}`,
            mode: "UNSUPPORTED",
            state: "UNAVAILABLE",
            observations: [],
          });
      }
    } else if (type === "VIDEO" || product === "REELS" || product === "REEL") {
      let artifact: InstagramTemporaryVideoArtifact | undefined;
      let frames: readonly InstagramExtractedFrame[] = [];
      const framesEnabled = this.enabled(
        "INSTAGRAM_SELECTED_VIDEO_FRAMES_ENABLED",
      );
      const speechEnabled = this.enabled(
        "INSTAGRAM_SELECTED_VIDEO_SPEECH_ENABLED",
      );
      try {
        if (framesEnabled || speechEnabled) {
          const acquired = await this.video.acquire({
            credential: await credential(),
            mediaId: input.media.providerMediaId,
            isolationScope: scope,
          });
          artifact = acquired.artifact;
          if (acquired.providerMediaId !== input.media.providerMediaId)
            throw new Error("CONTENT_MEDIA_SUBSTITUTION");
          const probe = await this.decoder.probe(artifact);
          if (framesEnabled) {
            const timestamps = selectInstagramVideoFrameTimestamps(
              probe.durationMilliseconds,
            );
            frames = await this.decoder.extractFrames({
              artifact,
              timestampsMilliseconds: timestamps,
              isolationScope: scope,
            });
            if (
              frames.length > timestamps.length ||
              new Set(frames.map((frame) => frame.ordinal)).size !==
                frames.length
            )
              throw new Error("CONTENT_FRAME_MANIFEST_REJECTED");
            for (const frame of frames) {
              assertInstagramExtractedFrame(frame);
              if (
                timestamps[frame.ordinal] !==
                frame.requestedTimestampMilliseconds
              )
                throw new Error("CONTENT_FRAME_MANIFEST_REJECTED");
              const observations: unknown[] = [];
              try {
                observations.push({
                  kind: "VISUAL",
                  value: instagramW1VideoFrameObservationSchema.parse(
                    await this.frameModel.observe({
                      providerMediaId: input.media.providerMediaId,
                      verifiedVideoFingerprint: artifact.sha256,
                      frame,
                      promptProfileVersion:
                        INSTAGRAM_VIDEO_FRAME_PROMPT_PROFILE_VERSION,
                      observationContractVersion:
                        INSTAGRAM_VIDEO_FRAME_OBSERVATION_CONTRACT_VERSION,
                    }),
                  ),
                });
              } catch {
                /* UNKNOWN */
              }
              try {
                observations.push({
                  kind: "OCR",
                  value: finalizeInstagramVisualText(
                    await this.ocr.observe({
                      ...frame,
                      promptProfileVersion:
                        INSTAGRAM_VISUAL_TEXT_PROMPT_PROFILE_VERSION,
                      observationContractVersion:
                        INSTAGRAM_VISUAL_TEXT_CONTRACT_VERSION,
                      untrustedImageTextIsDataOnly: true,
                    }),
                  ),
                });
              } catch {
                /* UNKNOWN */
              }
              modalities.push({
                supportIdentity: `${input.media.providerMediaId}:frame:${frame.ordinal}:${frame.requestedTimestampMilliseconds}`,
                mode: "SAMPLED_FRAME",
                state:
                  observations.length === 2
                    ? "AVAILABLE"
                    : observations.length
                      ? "PARTIAL"
                      : "UNKNOWN",
                contentHash: frame.sha256,
                observations,
              });
            }
            modalities.push({
              supportIdentity: `${input.media.providerMediaId}:frame-coverage`,
              mode: "SAMPLED_NOT_COMPLETE_VIDEO",
              state:
                frames.length === timestamps.length ? "AVAILABLE" : "PARTIAL",
              contentHash: artifact.sha256,
              observations: [
                {
                  framesRequested: timestamps.length,
                  framesExtracted: frames.length,
                },
              ],
            });
          }
          if (speechEnabled) {
            let audioPath: string | undefined;
            try {
              const audio = await this.audio.extract({
                video: artifact,
                isolationScope: scope,
              });
              audioPath = audio.temporaryPath;
              const transcript = finalizeInstagramSpeechTranscript(
                await this.speech.transcribe({
                  audio,
                  verifiedDurationMs: probe.durationMilliseconds,
                  promptProfileVersion: INSTAGRAM_SPEECH_PROMPT_PROFILE_VERSION,
                  transcriptContractVersion:
                    INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
                  untrustedAudioIsDataOnly: true,
                }),
                probe.durationMilliseconds,
              );
              modalities.push({
                supportIdentity: `${input.media.providerMediaId}:speech`,
                mode: "BOUNDED_SPEECH",
                state: "AVAILABLE",
                contentHash: audio.sha256,
                observations: [
                  {
                    contract: INSTAGRAM_SPEECH_TRANSCRIPT_CONTRACT_VERSION,
                    value: transcript,
                  },
                ],
              });
            } catch {
              modalities.push({
                supportIdentity: `${input.media.providerMediaId}:speech`,
                mode: "BOUNDED_SPEECH",
                state: "UNKNOWN",
                observations: [],
              });
            } finally {
              if (audioPath) await this.videoStore.remove(audioPath);
            }
          }
        }
      } catch (error) {
        if (
          error instanceof Error &&
          /SUBSTITUTION|MANIFEST|FENCE/.test(error.message)
        )
          throw error;
        modalities.push({
          supportIdentity: `${input.media.providerMediaId}:video`,
          mode: "VIDEO_UNAVAILABLE",
          state: "UNKNOWN",
          observations: [],
        });
      } finally {
        for (const frame of frames)
          await this.videoStore.remove(frame.temporaryPath);
        if (artifact) await this.videoStore.remove(artifact.temporaryPath);
      }
      if (!framesEnabled)
        modalities.push({
          supportIdentity: `${input.media.providerMediaId}:frames-disabled`,
          mode: "SAMPLED_FRAME",
          state: "UNAVAILABLE",
          observations: [],
        });
      if (!speechEnabled)
        modalities.push({
          supportIdentity: `${input.media.providerMediaId}:speech-disabled`,
          mode: "BOUNDED_SPEECH",
          state: "UNAVAILABLE",
          observations: [],
        });
    } else if (type === "IMAGE")
      await inspectImage(input.media.providerMediaId, 0, false);
    else
      modalities.push({
        supportIdentity: input.media.providerMediaId,
        mode: "UNSUPPORTED",
        state: "UNAVAILABLE",
        observations: [],
      });
    await this.assertFence(input);
    const caption = observed(input.media.caption)?.slice(0, 2200) ?? null;
    const admissible = modalities.filter(
      (item) =>
        item.observations.length > 0 &&
        [
          "IMAGE_FULL",
          "VIDEO_COVER_ONLY",
          "SAMPLED_FRAME",
          "BOUNDED_SPEECH",
        ].includes(item.mode),
    );
    const empty = {
      themes: [],
      captionPatterns: [],
      creativeStructures: [],
      visualExecution: [],
    };
    let values: ReturnType<
      typeof creatorContentGroundedCandidateSchema.parse
    > | null = null;
    try {
      values = creatorContentGroundedCandidateSchema.parse(
        await this.grounded.classify({
          providerMediaId: input.media.providerMediaId,
          caption,
          sourceEvidenceRef: input.sourceEvidenceRef,
          observations: admissible,
          profileVersion: input.profileVersion,
          untrustedSourceIsDataOnly: true,
        }),
      );
      const supports = new Set([
        ...(caption?.trim() ? [input.sourceEvidenceRef] : []),
        ...admissible.map((item) => item.supportIdentity),
      ]);
      const visualSupports = new Set(
        admissible
          .filter((item) =>
            item.observations.some(
              (observation) =>
                typeof observation === "object" &&
                observation !== null &&
                "kind" in observation &&
                observation.kind === "VISUAL",
            ),
          )
          .map((item) => item.supportIdentity),
      );
      if (
        Object.values(values)
          .flat()
          .some((item) =>
            item.supportingIdentities.some((ref) => !supports.has(ref)),
          ) ||
        (!caption?.trim() && values.captionPatterns.length > 0) ||
        values.visualExecution.some((item) =>
          item.supportingIdentities.some((ref) => !visualSupports.has(ref)),
        ) ||
        Object.values(values)
          .flat()
          .some(
            (item) =>
              !item.value.normalize("NFKC").trim() ||
              item.value.normalize("NFKC").trim().length > 100,
          )
      )
        throw new Error("CONTENT_UNADMITTED_SUPPORT");
    } catch {
      values = null;
    }
    const normalizeLabels = (labels: readonly { value: string }[]) =>
      [
        ...new Set(labels.map((item) => item.value.normalize("NFKC").trim())),
      ].sort();
    const fields = values
      ? {
          themes: normalizeLabels(values.themes),
          captionPatterns: normalizeLabels(values.captionPatterns),
          creativeStructures: normalizeLabels(values.creativeStructures),
          visualExecution: normalizeLabels(values.visualExecution),
        }
      : empty;
    return {
      providerMediaId: input.media.providerMediaId,
      state:
        !values || (!caption?.trim() && admissible.length === 0)
          ? "UNKNOWN"
          : modalities.every(
                (item) =>
                  item.state === "AVAILABLE" &&
                  item.mode !== "VIDEO_COVER_ONLY",
              )
            ? "AVAILABLE"
            : "PARTIAL",
      ...fields,
      provenance: {
        manifestIdentity: digest({
          identity: input.identity,
          sourceCaptureRef: input.sourceCaptureRef,
          sourceEvidenceRef: input.sourceEvidenceRef,
          media: input.media,
          windowEnd: input.windowEnd.toISOString(),
          profile: this.replayProfileIdentity(),
          modalities,
          groundedSupport: values,
        }),
        modelIdentity: this.replayProfileIdentity(),
        modelVersions: [
          this.visual,
          this.ocr,
          this.frameModel,
          this.speech,
          this.grounded,
        ].map((model) => ({
          provider: model.providerIdentity,
          model: model.modelIdentity,
          profile: model.modelProfileVersion,
        })),
        modalities,
        groundedSupport: values,
      },
    };
  }
  private async assertFence(input: CreatorContentSemanticInput) {
    const requestDigest = createHash("sha256")
      .update(input.identity.requestIdentity)
      .digest("hex");
    const mediaDigest = createHash("sha256")
      .update(
        `${input.identity.requestIdentity}:${input.media.providerMediaId}`,
      )
      .digest("hex");
    if (
      input.sourceCaptureRef !== `creator-content-capture:${requestDigest}` ||
      input.sourceEvidenceRef !== `creator-content-evidence:${mediaDigest}`
    )
      throw new Error("CONTENT_SOURCE_MEDIA_FENCE_REJECTED");
    const projected = await this.fence.project(input.actor);
    if (
      !projected.authorized ||
      input.identity.creatorProfileId !== input.actor.subjectCreatorProfileId ||
      input.identity.creatorWorkspaceId !== input.actor.workspaceId ||
      projected.integrationId !== input.identity.integrationId ||
      projected.providerAccountId !== input.identity.providerAccountId ||
      projected.authorizationGeneration !==
        input.identity.authorizationGeneration
    )
      throw new Error("CONTENT_MULTIMODAL_FENCE_REJECTED");
  }
}
function observed(value: InstagramField<string>): string | null {
  return value.state === "OBSERVED" || value.state === "EXPLICIT_EMPTY"
    ? value.value
    : null;
}
function digest(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
