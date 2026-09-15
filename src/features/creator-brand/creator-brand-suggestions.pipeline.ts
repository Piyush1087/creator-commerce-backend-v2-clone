import { Inject, Injectable } from "@nestjs/common";
import { IntelligenceProcessorExecutionStatus } from "@prisma/client";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { PrismaService } from "../../prisma/prisma.service";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import { CreatorBrandContentSourceAdapter } from "./creator-brand-content-source.adapter";
import {
  CREATOR_BRAND_COMPONENT_PATHS,
  CREATOR_BRAND_REGISTRY_KEY,
  creatorBrandVerifiedContract,
} from "./creator-brand-runtime.contract";
import {
  CREATOR_BRAND_SEMANTIC_PORT,
  CREATOR_BRAND_SEMANTIC_PROFILE,
  type CreatorBrandSemanticPort,
} from "./creator-brand-suggestions.processor";

@Injectable()
export class CreatorBrandSuggestionsPipeline {
  constructor(
    private readonly source: CreatorBrandContentSourceAdapter,
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
    private readonly prisma: PrismaService,
    @Inject(CREATOR_BRAND_SEMANTIC_PORT)
    private readonly semantic: CreatorBrandSemanticPort,
  ) {}
  async execute(actor: CreatorWorkspaceActorContext) {
    const source = await this.source.read(actor);
    if (!source)
      return {
        state: "UNAVAILABLE" as const,
        reused: false,
        generationIds: [],
      };
    const identity = `creator-brand:${sha256Canonical({
      source: source.manifestHash,
      sourceContentGeneration: source.objectGenerationId,
      valueHash: source.valueHash,
      bundleHash:
        creatorBrandVerifiedContract().bundle.manifest.bundleContentHash,
      profile: CREATOR_BRAND_SEMANTIC_PROFILE,
      semantic: this.semantic.identity(),
      account: source.providerAccountId,
      generation: source.authorizationGeneration,
    })}`;
    const created = await this.executions.createOrReturnOwnerScoped({
      ownerScopeId: source.ownerScopeId,
      subjectRef: source.subject.ownerCreatorProfileId,
      triggerType: "CREATOR_BRAND_POST_CONTENT_SUCCESS",
      triggerRef: identity,
      triggerIdempotencyKey: identity,
      correlationRef: identity,
      requestedImpact: {
        objectSemanticId: "creator_brand_suggestions",
        componentPaths: CREATOR_BRAND_COMPONENT_PATHS,
      },
      processors: [
        {
          registryKey: CREATOR_BRAND_REGISTRY_KEY,
          activeScope: CREATOR_BRAND_COMPONENT_PATHS.map(
            (componentSemanticPath) => ({
              ownerScopeId: source.ownerScopeId,
              subjectId: source.subject.ownerCreatorProfileId,
              objectSemanticId: "creator_brand_suggestions",
              pathSchemeVersion: 1,
              componentSemanticPath,
            }),
          ),
          dependencyManifest: {
            kind: "CREATOR_BRAND_INPUT_V1",
            source,
            semanticIdentity: this.semantic.identity(),
          },
          evidenceManifest: source,
          executionIntentKey: identity,
          maxAttempts: 1,
          dependencyEligible: true,
        },
      ],
    });
    const processor = created.processorExecutions[0];
    const reused =
      processor.status === IntelligenceProcessorExecutionStatus.COMPLETED;
    if (!reused) {
      const completed = await this.worker.runExact(
        processor.id,
        `creator-brand:${source.ownerScopeId}`,
        60_000,
      );
      if (
        completed.processorExecution.status !==
        IntelligenceProcessorExecutionStatus.COMPLETED
      )
        throw new Error("CREATOR_BRAND_EXECUTION_FAILED_CURRENT_PRESERVED");
    }
    const generations = await this.prisma.intelligenceObjectGeneration.findMany(
      {
        where: {
          ownerScopeId: source.ownerScopeId,
          processorExecutionId: processor.id,
        },
        select: { id: true },
      },
    );
    return {
      state: "AVAILABLE" as const,
      reused,
      generationIds: generations.map((row) => row.id),
      executionId: processor.executionId,
      processorExecutionId: processor.id,
    };
  }
}
