import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { IntelligenceProcessorExecutionStatus } from "@prisma/client";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import { CreatorAudienceCredentialFenceService } from "../creator-audience/creator-audience-credential-fence.service";
import {
  INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT,
  type InstagramField,
  type InstagramIntelligenceProviderReadClient,
} from "../instagram/instagram-intelligence-provider.types";
import {
  calculateCreatorContent,
  selectCreatorContentCorpus,
  type CreatorContentAcquiredMedia,
} from "./creator-content-calculator";
import {
  CreatorContentRepository,
  type CreatorContentPersistenceIdentity,
} from "./creator-content.repository";
import {
  CREATOR_CONTENT_COMPONENT_PATHS,
  CREATOR_CONTENT_REGISTRY_KEY,
} from "./creator-content-runtime.contract";
import {
  CREATOR_CONTENT_SEMANTIC_ANALYZER,
  type CreatorContentSemanticAnalyzer,
} from "./creator-content-semantic.port";

@Injectable()
export class CreatorContentPipelineService {
  constructor(
    private readonly fence: CreatorAudienceCredentialFenceService,
    private readonly repository: CreatorContentRepository,
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
    @Inject(INSTAGRAM_INTELLIGENCE_PROVIDER_READ_CLIENT)
    private readonly provider: InstagramIntelligenceProviderReadClient,
    @Inject(CREATOR_CONTENT_SEMANTIC_ANALYZER)
    private readonly semantic: CreatorContentSemanticAnalyzer,
  ) {}

  async execute(input: {
    actor: CreatorWorkspaceActorContext;
    integrationId: string;
    providerAccountId: string;
    authorizationGeneration: number;
    capturedAt?: Date;
    requestIdentity?: string;
  }) {
    const capturedAt = input.capturedAt ?? new Date();
    const identity: CreatorContentPersistenceIdentity = {
      creatorProfileId: input.actor.subjectCreatorProfileId,
      creatorWorkspaceId: input.actor.workspaceId,
      integrationId: input.integrationId,
      providerAccountId: input.providerAccountId,
      authorizationGeneration: input.authorizationGeneration,
      requestIdentity:
        input.requestIdentity ??
        creatorContentRequestIdentity({ ...input, capturedAt }),
    };
    const projected = await this.fence.project(input.actor);
    if (
      !projected.authorized ||
      projected.integrationId !== identity.integrationId ||
      projected.providerAccountId !== identity.providerAccountId ||
      projected.authorizationGeneration !== identity.authorizationGeneration
    )
      throw new Error("CREATOR_CONTENT_AUTHORIZATION_FENCE_REJECTED");
    const replay = await this.repository.replay(identity);
    if (replay) return { value: replay, reused: true, generationIds: [] };
    const credential = await this.fence.acquire(input.actor, identity);
    await this.repository.begin(identity);
    try {
      const inventory = await this.provider.readMediaInventory(
        credential,
        capturedAt,
      );
      const corpus = selectCreatorContentCorpus(inventory.items, capturedAt);
      const rows: CreatorContentAcquiredMedia[] = [];
      for (const media of corpus) {
        const mediaType =
          observed(media.mediaProductType) === "REELS"
            ? "REEL"
            : (observed(media.mediaType) ?? "UNKNOWN");
        const [insights, semantic] = await Promise.all([
          this.provider.readMediaInsights(
            credential,
            media.providerMediaId,
            mediaType,
          ),
          this.semantic.analyze({
            media,
            profileVersion: "creator-content-semantic-v0.1",
          }),
        ]);
        rows.push({
          media,
          insights,
          semantic,
          evidenceRef: `creator-content-evidence:${hash(`${identity.requestIdentity}:${media.providerMediaId}`)}`,
        });
      }
      const value = calculateCreatorContent({
        capturedAt,
        windowEnd: capturedAt,
        providerRowsReturned: inventory.coverage.rowsReturned,
        rows,
      });
      if (value.status === "UNAVAILABLE") {
        await this.repository.fail(identity);
        const previous = await this.repository.readCurrent(identity);
        return {
          value: previous
            ? {
                ...previous,
                sourceStatus: "PROVIDER_FAILURE" as const,
                processingState: "FAILED" as const,
                currentPreserved: true,
              }
            : value,
          reused: false,
          generationIds: [],
        };
      }
      const manifest = await this.repository.completeAcquisition({
        identity,
        rows,
        value,
      });
      const created = await this.executions.createOrReturnOwnerScoped({
        ownerScopeId: manifest.identity.ownerScopeId,
        subjectRef: identity.creatorProfileId,
        triggerType: "CREATOR_CONTENT_SCHEDULED",
        triggerRef: identity.requestIdentity,
        triggerIdempotencyKey: identity.requestIdentity,
        correlationRef: identity.requestIdentity,
        requestedImpact: {
          objectSemanticId: "creator_content",
          componentPaths: CREATOR_CONTENT_COMPONENT_PATHS,
        },
        processors: [
          {
            registryKey: CREATOR_CONTENT_REGISTRY_KEY,
            activeScope: CREATOR_CONTENT_COMPONENT_PATHS.map(
              (componentSemanticPath) => ({
                ownerScopeId: manifest.identity.ownerScopeId,
                subjectId: manifest.identity.creatorProfileId,
                objectSemanticId: "creator_content",
                pathSchemeVersion: 1,
                componentSemanticPath,
              }),
            ),
            dependencyManifest: {
              kind: "CREATOR_CONTENT_PROCESSOR_INPUT_V1",
              value,
            },
            evidenceManifest: manifest,
            executionIntentKey: identity.requestIdentity,
            maxAttempts: 1,
            dependencyEligible: true,
          },
        ],
      });
      const processor = created.processorExecutions[0];
      if (processor.status !== IntelligenceProcessorExecutionStatus.COMPLETED) {
        const completed = await this.worker.runExact(
          processor.id,
          `creator-content:${identity.creatorProfileId}`,
          60_000,
        );
        if (
          completed.processorExecution.status !==
          IntelligenceProcessorExecutionStatus.COMPLETED
        ) {
          const previous =
            await this.repository.readLatestCurrentSameAccount(identity);
          if (previous)
            return {
              value: {
                ...previous.value,
                sourceStatus: "PROVIDER_FAILURE" as const,
                processingState: "FAILED" as const,
                currentPreserved: true,
              },
              reused: false,
              generationIds: [],
            };
          throw new Error("CREATOR_CONTENT_INTELLIGENCE_EXECUTION_FAILED");
        }
      }
      return {
        value,
        reused: false,
        generationIds: await this.repository.generationIdsForProcessorExecution(
          processor.id,
        ),
      };
    } catch (error) {
      await this.repository.fail(identity);
      throw error;
    }
  }
}

export function creatorContentRequestIdentity(input: {
  integrationId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  capturedAt: Date;
}): string {
  const day = new Date(input.capturedAt);
  day.setUTCHours(0, 0, 0, 0);
  return `creator-content:${hash(`${input.integrationId}:${input.providerAccountId}:${input.authorizationGeneration}:${day.toISOString()}:creator-content-v0.1`)}`;
}
function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function observed(value: InstagramField<string>): string | null {
  if (value.state === "OBSERVED" || value.state === "EXPLICIT_EMPTY") {
    return value.value;
  }
  if (value.state === "OBSERVED_ZERO") return String(value.value);
  return null;
}
