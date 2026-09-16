import { Injectable } from "@nestjs/common";
import {
  BrandIntegrationProvider,
  BrandIntegrationStatus,
  DataExtractionCaptureStatus,
  DataExtractionSourceClass,
  InstagramAuthorizationHealth,
  InstagramCapabilityState,
  InstagramIdentityVerification,
  IntelligenceReadiness,
} from "@prisma/client";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { SemanticValidator } from "../../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../../brand-intelligence/contracts/validation/structural.validator";
import type { ProcessorExecutionResult } from "../../brand-intelligence/execution/domain/intelligence-execution.types";
import {
  ProcessorExecutorFailure,
  type ProcessorExecutor,
  type ProcessorExecutorContext,
} from "../../brand-intelligence/execution/executor/processor-executor";
import { instagramB3aVisualObservationSchema } from "../media/instagram-b3a-visual-observation";
import {
  INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
  INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
  InstagramContentBehaviorB4ValueSchema,
  InstagramContentBehaviorEvidenceManifestSchema,
  InstagramContentBehaviorPersistencePayloadSchema,
} from "./instagram-content-behavior.contract";

const b3aEvidencePayloadSchema = z
  .object({
    observationContractVersion: z.literal("1.0"),
    promptProfileVersion: z.string().min(1),
    modelProvider: z.string().min(1),
    modelIdentity: z.string().min(1),
    modelProfileVersion: z.string().min(1),
    observation: instagramB3aVisualObservationSchema,
  })
  .strict();

@Injectable()
export class InstagramContentBehaviorProcessor implements ProcessorExecutor {
  readonly processorId = INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly structural: StructuralValidator,
    private readonly semantic: SemanticValidator,
  ) {}

  async execute(
    context: ProcessorExecutorContext,
  ): Promise<ProcessorExecutionResult> {
    const manifest = InstagramContentBehaviorEvidenceManifestSchema.safeParse(
      context.processorExecution.evidenceManifest,
    );
    if (!manifest.success) this.fail("B4_INVALID_EVIDENCE_MANIFEST");
    const input = manifest.data;
    if (
      input.brandProfileId !== context.processorExecution.brandId ||
      context.processorExecution.processorId !== this.processorId
    ) {
      this.fail("B4_EXECUTION_SCOPE_MISMATCH");
    }

    const integration = await this.prisma.brandIntegration.findUnique({
      where: { id: input.integrationId },
      select: {
        brandProfileId: true,
        provider: true,
        status: true,
        isActive: true,
        providerAccountId: true,
        authorizationGeneration: true,
        identityVerification: true,
        authorizationHealth: true,
        firstPartyProfileCapability: true,
      },
    });
    if (
      !integration ||
      integration.brandProfileId !== input.brandProfileId ||
      integration.provider !== BrandIntegrationProvider.INSTAGRAM ||
      integration.providerAccountId !== input.providerAccountId ||
      integration.authorizationGeneration !== input.authorizationGeneration ||
      !integration.isActive ||
      integration.status !== BrandIntegrationStatus.CONNECTED ||
      integration.identityVerification !==
        InstagramIdentityVerification.VERIFIED ||
      integration.authorizationHealth !==
        InstagramAuthorizationHealth.CONNECTED_FULL ||
      integration.firstPartyProfileCapability !== InstagramCapabilityState.YES
    ) {
      this.fail("B4_AUTHORIZATION_GENERATION_UNAVAILABLE");
    }

    const evidence = await this.prisma.dataExtractionEvidenceItem.findUnique({
      where: {
        brandId_evidenceRef: {
          brandId: input.brandProfileId,
          evidenceRef: input.evidenceRef,
        },
      },
      include: { capture: true, resource: true },
    });
    if (
      !evidence ||
      evidence.capabilityId !== "instagram.media_visual_observations" ||
      evidence.resource.sourceClass !==
        DataExtractionSourceClass.INSTAGRAM_OWNED ||
      evidence.capture.status !== DataExtractionCaptureStatus.COMPLETED ||
      !evidence.capture.capturedAt ||
      evidence.capture.providerIntegrationId !== input.integrationId ||
      evidence.capture.providerAccountId !== input.providerAccountId ||
      evidence.capture.authorizationGeneration !== input.authorizationGeneration
    ) {
      this.fail("B4_EVIDENCE_UNAVAILABLE");
    }
    const visual = b3aEvidencePayloadSchema.safeParse(evidence.boundedPayload);
    if (!visual.success) this.fail("B4_VISUAL_OBSERVATION_INVALID");

    const windowEnd = new Date(input.windowEnd);
    const windowStart = new Date(
      windowEnd.getTime() - 30 * 24 * 60 * 60 * 1000,
    );
    const observedAt = evidence.capture.observedAt;
    if (!observedAt || observedAt < windowStart || observedAt > windowEnd) {
      this.fail("B4_EVIDENCE_OUTSIDE_WINDOW");
    }

    const sourceUnknown = {
      state: "UNKNOWN" as const,
      reasonCode: "INSUFFICIENT_EVIDENCE" as const,
    };
    const value = InstagramContentBehaviorB4ValueSchema.parse({
      semanticId: "instagram_content_behavior",
      objectContractVersion: "1.0",
      outputContractVersion: "1.0",
      sourceScope: "INSTAGRAM_OWNED",
      state: "PARTIAL_CURRENT",
      readiness: "PARTIAL",
      freshness: "CURRENT",
      currentPreserved: false,
      generatedAt: windowEnd.toISOString(),
      window: {
        start: windowStart.toISOString(),
        end: windowEnd.toISOString(),
        days: 30,
      },
      results: [],
      signals: [],
      learnings: [],
      components: {
        window: {
          state: "AVAILABLE",
          value: {
            start: windowStart.toISOString(),
            end: windowEnd.toISOString(),
            days: 30,
          },
        },
        corpus_summary: {
          state: "AVAILABLE",
          value: {
            eligiblePostCount: 1,
            observedPostCount: 1,
            deepInspectedImageCount: 1,
          },
        },
        posting_cadence: sourceUnknown,
        format_mix: {
          state: "AVAILABLE",
          value: {
            observedCounts: { IMAGE: 1 },
            broaderMix: sourceUnknown,
          },
        },
        theme_patterns: sourceUnknown,
        caption_patterns: sourceUnknown,
        creative_structure_patterns: sourceUnknown,
        offering_presence_patterns: sourceUnknown,
        creator_presence_patterns: sourceUnknown,
        representative_media_refs: {
          state: "AVAILABLE",
          value: [
            {
              mediaType: "IMAGE",
              resourceRef: evidence.resourceRef,
              captureRef: evidence.captureRef,
              evidenceRefs: [evidence.evidenceRef],
              visualObservation: visual.data.observation,
            },
          ],
        },
        bounded_learnings: {
          state: "INTENTIONALLY_ABSENT",
          reasonCode: "INSUFFICIENT_SAMPLE",
        },
        coverage: {
          state: "AVAILABLE",
          value: {
            eligibleCount: 1,
            observedCount: 1,
            deepInspectedCount: 1,
            unavailableCount: 0,
            notInspectedCount: 0,
          },
        },
      },
      coverage: {
        state: "COMPLETE",
        eligibleCount: 1,
        observedCount: 1,
        coveragePercent: 100,
        reasonCodes: [],
      },
      evidenceRefs: [evidence.evidenceRef],
    });

    const bundle = this.contracts.getVerifiedBundle(
      INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
    );
    const structural = this.structural.validate(bundle, value);
    if (!structural.valid) {
      this.fail(`B4_${structural.issues[0]?.code ?? "STRUCTURAL_REJECTED"}`);
    }
    const semantic = this.semantic.validate(structural.value, {
      bundle,
      evidenceManifest: [
        {
          evidenceRef: evidence.evidenceRef,
          capabilityId: evidence.capabilityId,
          semanticId: "instagram.media_visual_observations",
          revisionIdentity: `${evidence.captureRef}:1`,
          sourceClass: "INSTAGRAM_OWNED",
        },
      ],
      businessStateManifest: [],
    });
    if (!semantic.valid) {
      this.fail(`B4_${semantic.issues[0]?.code ?? "SEMANTIC_REJECTED"}`);
    }

    const payload = InstagramContentBehaviorPersistencePayloadSchema.parse({
      kind: "INSTAGRAM_CONTENT_BEHAVIOR_B4_PERSISTENCE_V1",
      value,
      evidence: {
        evidenceRef: evidence.evidenceRef,
        capabilityId: evidence.capabilityId,
        resourceRef: evidence.resourceRef,
        captureRef: evidence.captureRef,
        captureVersion: "1",
        capturedAt: evidence.capture.capturedAt.toISOString(),
        observedFreshness: evidence.freshnessAtEmission,
      },
      account: {
        integrationId: input.integrationId,
        providerAccountId: input.providerAccountId,
        authorizationGeneration: input.authorizationGeneration,
      },
    });
    return {
      readiness: IntelligenceReadiness.PARTIAL,
      telemetry: { evidenceCount: 1, source: "INSTAGRAM_OWNED" },
      persistencePayload: payload,
    };
  }

  private fail(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code,
    });
  }
}
