import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

import { InstagramIntelligenceAuthorizedImageAcquisitionService } from "../../brand-settings/services/instagram-intelligence-image-acquisition.service";
import { InstagramCaptureWriterService } from "../../data-extraction/evidence/instagram/instagram-capture-writer.service";
import {
  InstagramImageAcquisitionError,
  type InstagramTemporaryImageArtifact,
} from "../../instagram/media/instagram-image-acquisition.types";
import { InstagramImageTemporaryStore } from "../../instagram/media/instagram-image-temporary-store";
import type { InstagramLocatorKind } from "../../instagram/media/instagram-contained-image-acquisition.service";
import {
  INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION,
  INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
  INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
  InstagramB3aVisualModelPort,
  instagramB3aVisualObservationSchema,
} from "./instagram-b3a-visual-observation";

export type InstagramB3aTruthResult = Readonly<{
  visualInspection: "INSPECTED" | "NOT_INSPECTED" | "UNAVAILABLE";
  visualSemanticResult: "AVAILABLE" | "UNKNOWN";
  reasonCode:
    | "INSPECTED"
    | "NOT_SELECTED"
    | "LOCATOR_UNAVAILABLE"
    | "SECURITY_REJECTED"
    | "ACQUISITION_FAILED"
    | "MODEL_FAILURE"
    | "INVALID_MODEL_OUTPUT"
    | "FINAL_FENCE_REJECTED";
  lineage?: Readonly<{
    resourceRef: string;
    captureRef: string;
    capabilityExecutionRef: string;
    artifactRefs: readonly string[];
    evidenceRefs: readonly string[];
    reused: boolean;
  }>;
}>;

@Injectable()
export class InstagramB3aImagePipelineService {
  constructor(
    private readonly acquisition: InstagramIntelligenceAuthorizedImageAcquisitionService,
    private readonly visualModel: InstagramB3aVisualModelPort,
    private readonly writer: InstagramCaptureWriterService,
    private readonly temporaryStore: InstagramImageTemporaryStore,
  ) {}

  async execute(input: {
    brandProfileId: string;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    mediaId: string;
    acquisitionMediaId?: string;
    locatorKind?: InstagramLocatorKind;
    inspectionDepth?:
      | "IMAGE_ONLY"
      | "CAROUSEL_REPRESENTATIVE_ONLY"
      | "COVER_ONLY";
    executionProfile?: "b3a-v1" | "b3b-carousel-v1" | "b3b-cover-v1";
    visualContext?: Readonly<Record<string, unknown>>;
    selection: "SELECTED" | "NOT_SELECTED";
    now?: () => Date;
    signal?: AbortSignal;
  }): Promise<InstagramB3aTruthResult> {
    validateIdentity(input);
    if (input.selection === "NOT_SELECTED") {
      return {
        visualInspection: "NOT_INSPECTED",
        visualSemanticResult: "UNKNOWN",
        reasonCode: "NOT_SELECTED",
      };
    }

    const now = input.now ?? (() => new Date());
    const startedAt = now().toISOString();
    let artifact: InstagramTemporaryImageArtifact | undefined;
    try {
      const acquired = await this.acquisition.acquire({
        brandProfileId: input.brandProfileId,
        integrationId: input.integrationId,
        expectedProviderAccountId: input.providerAccountId,
        expectedAuthorizationGeneration: input.authorizationGeneration,
        mediaId: input.acquisitionMediaId ?? input.mediaId,
        ...(input.locatorKind ? { locatorKind: input.locatorKind } : {}),
        now,
        ...(input.signal ? { signal: input.signal } : {}),
      });
      artifact = acquired.artifact;

      let modelOutput: unknown;
      try {
        modelOutput = await this.visualModel.observe({
          temporaryPath: artifact.temporaryPath,
          mediaType: artifact.mediaType,
          byteLength: artifact.byteLength,
          width: artifact.width,
          height: artifact.height,
          sha256: artifact.sha256,
          promptProfileVersion: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
          observationContractVersion:
            INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
        });
      } catch {
        return await this.persistModelUnknown(
          input,
          artifact,
          "MODEL_FAILURE",
          now,
        );
      }
      const parsed = instagramB3aVisualObservationSchema.safeParse(modelOutput);
      if (!parsed.success) {
        return await this.persistModelUnknown(
          input,
          artifact,
          "INVALID_MODEL_OUTPUT",
          now,
        );
      }

      const lineage = await this.writer.write({
        ...writerIdentity(input),
        startedAt,
        completedAt: now().toISOString(),
        capturedAt: artifact.acquiredAt,
        ...(acquired.providerObservedAt
          ? { observedAt: acquired.providerObservedAt }
          : {}),
        availability: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: ["B3A_IMAGE_VISUAL_OBSERVATION_AVAILABLE"],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "COMPLETE",
          failureCategories: [],
          detailCodes: [],
        },
        artifacts: [
          technicalArtifact(artifact),
          {
            artifactKey: "visual-observation",
            payload: observationPayload(this.visualModel, parsed.data, input),
          },
        ],
        evidence: [
          {
            evidenceKey: "visual-observation",
            artifactKey: "visual-observation",
            payload: observationPayload(this.visualModel, parsed.data, input),
            freshness: "CURRENT",
            representativeness: "CONTEXT_SPECIFIC",
            semanticObservationKey: `instagram:image-visual:${digest(
              `${input.providerAccountId}:${input.mediaId}:${artifact.sha256}:${INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION}`,
            )}`,
          },
        ],
      });
      return {
        visualInspection: "INSPECTED",
        visualSemanticResult: "AVAILABLE",
        reasonCode: "INSPECTED",
        lineage,
      };
    } catch (error) {
      if (artifact) {
        return {
          visualInspection: "UNAVAILABLE",
          visualSemanticResult: "UNKNOWN",
          reasonCode: "FINAL_FENCE_REJECTED",
        };
      }
      if (error instanceof InstagramImageAcquisitionError) {
        const reasonCode = acquisitionReason(error);
        try {
          const lineage = await this.writer.write({
            ...writerIdentity(input),
            startedAt,
            completedAt: now().toISOString(),
            availability: "UNAVAILABLE",
            retryability:
              error.code === "TIMEOUT" || error.code === "PROVIDER_FAILURE"
                ? "RETRYABLE"
                : "NON_RETRYABLE",
            reasonCodes: [`B3A_${error.code}`],
            coverage: "SINGLE_RESOURCE",
            acquisitionQuality: {
              state: "UNAVAILABLE",
              failureCategories: ["IMAGE_ACQUISITION"],
              detailCodes: [error.code],
            },
            artifacts: [],
            evidence: [],
          });
          return {
            visualInspection: "UNAVAILABLE",
            visualSemanticResult: "UNKNOWN",
            reasonCode,
            lineage,
          };
        } catch {
          return {
            visualInspection: "UNAVAILABLE",
            visualSemanticResult: "UNKNOWN",
            reasonCode: "FINAL_FENCE_REJECTED",
          };
        }
      }
      return {
        visualInspection: "UNAVAILABLE",
        visualSemanticResult: "UNKNOWN",
        reasonCode: "FINAL_FENCE_REJECTED",
      };
    } finally {
      if (artifact) await this.temporaryStore.remove(artifact.temporaryPath);
    }
  }

  private async persistModelUnknown(
    input: Parameters<InstagramB3aImagePipelineService["execute"]>[0],
    artifact: InstagramTemporaryImageArtifact,
    reasonCode: "MODEL_FAILURE" | "INVALID_MODEL_OUTPUT",
    now: () => Date,
  ): Promise<InstagramB3aTruthResult> {
    const lineage = await this.writer.write({
      ...writerIdentity(input),
      startedAt: artifact.acquiredAt,
      completedAt: now().toISOString(),
      capturedAt: artifact.acquiredAt,
      availability: "PARTIAL",
      retryability:
        reasonCode === "MODEL_FAILURE" ? "RETRYABLE" : "NON_RETRYABLE",
      reasonCodes: [`B3A_${reasonCode}`],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: {
        state: "PARTIAL",
        failureCategories: ["VISUAL_MODEL"],
        detailCodes: [reasonCode],
      },
      artifacts: [technicalArtifact(artifact)],
      evidence: [],
    });
    return {
      visualInspection: "UNAVAILABLE",
      visualSemanticResult: "UNKNOWN",
      reasonCode,
      lineage,
    };
  }
}

function writerIdentity(input: {
  brandProfileId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  mediaId: string;
}) {
  const profile =
    "executionProfile" in input && typeof input.executionProfile === "string"
      ? input.executionProfile
      : "b3a-v1";
  const identity = `${input.providerAccountId}:${input.authorizationGeneration}:${input.mediaId}:${profile}`;
  return {
    brandId: input.brandProfileId,
    providerAccountId: input.providerAccountId,
    authorizationGeneration: input.authorizationGeneration,
    resourceType: "INSTAGRAM_MEDIA" as const,
    mediaId: input.mediaId,
    capabilityId: "instagram.media_visual_observations" as const,
    requestKey: `b3a-image:${digest(identity)}`,
    providerExecutionRef: `provider-execution:instagram:${digest(identity)}`,
    normalizationContractVersion: INSTAGRAM_B3A_NORMALIZATION_CONTRACT_VERSION,
  };
}

function technicalArtifact(artifact: InstagramTemporaryImageArtifact) {
  return {
    artifactKey: "verified-image-metadata",
    payload: {
      mediaType: artifact.mediaType,
      byteLength: artifact.byteLength,
      width: artifact.width,
      height: artifact.height,
      contentHash: artifact.sha256,
      verificationContractVersion: "instagram-image-technical-safety-v1",
    },
  };
}

function observationPayload(
  model: InstagramB3aVisualModelPort,
  observation: {
    description: string;
    visibleElements: string[];
    dominantColors: string[];
    composition: string;
  },
  input?: {
    inspectionDepth?:
      | "IMAGE_ONLY"
      | "CAROUSEL_REPRESENTATIVE_ONLY"
      | "COVER_ONLY";
    visualContext?: Readonly<Record<string, unknown>>;
  },
) {
  return {
    observationContractVersion: INSTAGRAM_B3A_OBSERVATION_CONTRACT_VERSION,
    promptProfileVersion: INSTAGRAM_B3A_PROMPT_PROFILE_VERSION,
    modelProvider: model.providerIdentity,
    modelIdentity: model.modelIdentity,
    modelProfileVersion: model.modelProfileVersion,
    ...(input?.inspectionDepth
      ? { inspectionDepth: input.inspectionDepth }
      : {}),
    ...(input?.visualContext ? { visualContext: input.visualContext } : {}),
    observation,
  };
}

function acquisitionReason(
  error: InstagramImageAcquisitionError,
): InstagramB3aTruthResult["reasonCode"] {
  if (error.code === "LOCATOR_UNAVAILABLE") return "LOCATOR_UNAVAILABLE";
  if (
    [
      "UNSAFE_URL",
      "UNSAFE_DNS",
      "REDIRECT_REJECTED",
      "REDIRECT_LIMIT",
    ].includes(error.code)
  ) {
    return "SECURITY_REJECTED";
  }
  return "ACQUISITION_FAILED";
}

function validateIdentity(input: {
  brandProfileId: string;
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  mediaId: string;
  acquisitionMediaId?: string;
}): void {
  if (
    !input.brandProfileId.trim() ||
    !input.integrationId.trim() ||
    !input.providerAccountId.trim() ||
    !Number.isSafeInteger(input.authorizationGeneration) ||
    input.authorizationGeneration < 0 ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(input.mediaId) ||
    (input.acquisitionMediaId !== undefined &&
      !/^[A-Za-z0-9_-]{1,128}$/.test(input.acquisitionMediaId))
  ) {
    throw new Error("Invalid Instagram B3A media identity");
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
