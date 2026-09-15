import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";
import { IntelligenceExecutionService } from "../brand-intelligence/execution/intelligence-execution.service";
import { ProcessorWorkerService } from "../brand-intelligence/execution/processor-worker.service";
import { readOwnerScopedIntelligenceCurrent } from "../brand-intelligence/projection/owner-scoped-current.read";
import {
  AudienceV1ConsumerSchema,
  AUDIENCE_V1_PATHS,
} from "./creator-audience-v1.contract";
import {
  AUDIENCE_V1_REGISTRY_KEY,
  AUDIENCE_V1_BUNDLE_HASH,
} from "./creator-audience-v1.runtime";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import { AudienceV1SourceReader } from "./creator-audience-v1.source";

/** A derived execution over admitted current inputs. This never acquires source or calls a model. */
@Injectable()
export class AudienceV1Pipeline {
  constructor(
    private readonly source: AudienceV1SourceReader,
    private readonly executions: IntelligenceExecutionService,
    private readonly worker: ProcessorWorkerService,
    private readonly prisma: PrismaService,
  ) {}
  async execute(actor: CreatorWorkspaceActorContext, now = new Date()) {
    const source = await this.source.read(actor, now);
    if (!source)
      return {
        state: "UNAVAILABLE" as const,
        reused: false,
        generationIds: [],
      };
    const { identity } = source.manifest;
    const replay = await this.prisma.$queryRaw<
      Array<{
        id: string;
        value: unknown;
        valueHash: string;
        processorId: string;
      }>
    >(Prisma.sql`
      SELECT o.object_generation_id AS id, o.value_payload AS value, o.value_hash AS "valueHash", p.processor_execution_id AS "processorId"
      FROM intelligence_executions e JOIN intelligence_processor_executions p
        ON p.owner_scope_id=e.owner_scope_id AND p.execution_id=e.execution_id
      JOIN intelligence_object_generations o ON o.owner_scope_id=p.owner_scope_id AND o.processor_execution_id=p.processor_execution_id
      WHERE e.owner_scope_id=${identity.ownerScopeId} AND e.trigger_idempotency_key=${identity.requestIdentity}
        AND e.status='COMPLETED' AND p.status='COMPLETED' AND p.processor_id='creator_audience_v1'
        AND o.bundle_hash=${AUDIENCE_V1_BUNDLE_HASH} AND p.bundle_hash=${AUDIENCE_V1_BUNDLE_HASH}
        AND p.evidence_manifest_hash=${sha256Canonical(source.manifest)}`);
    if (replay.length === 1) {
      const object = replay[0];
      if (object.valueHash !== sha256Canonical(object.value))
        throw new Error("CREATOR_AUDIENCE_V1_REPLAY_HASH_INVALID");
      return {
        state: source.value.status,
        reused: true,
        currentPreserved: false,
        value: AudienceV1ConsumerSchema.parse(object.value),
        generationIds: [object.id],
        processorExecutionId: object.processorId,
      };
    }
    const prior = await this.prisma.$transaction(async (tx) => {
      const current = (
        await readOwnerScopedIntelligenceCurrent(
          tx,
          identity.ownerScopeId,
          "creator_audience",
        )
      ).find((row) => row.componentSemanticPath === AUDIENCE_V1_PATHS[0]);
      if (!current) return null;
      const object = current.currentComponentGeneration.objectGeneration;
      if (
        object.bundleHash !== AUDIENCE_V1_BUNDLE_HASH ||
        object.valueHash !== sha256Canonical(object.valuePayload)
      )
        throw new Error("CREATOR_AUDIENCE_V1_CURRENT_HASH_INVALID");
      const metadata = object.objectMetadataPayload as Prisma.JsonObject;
      return metadata.integrationId === identity.integrationId &&
        metadata.providerAccountId === identity.providerAccountId
        ? { object, value: AudienceV1ConsumerSchema.parse(object.valuePayload) }
        : null;
    });
    // Never replace valid same-account derived current with an incomplete changed execution.
    if (source.value.status !== "READY" && prior)
      return {
        state: "PARTIAL" as const,
        reused: false,
        currentPreserved: true,
        value: prior.value,
        generationIds: [prior.object.id],
      };
    const created = await this.executions.createOrReturnOwnerScoped({
      ownerScopeId: identity.ownerScopeId,
      subjectRef: identity.creatorProfileId,
      triggerType: "CREATOR_AUDIENCE_V1_POST_SOURCE_SUCCESS",
      triggerRef: identity.requestIdentity,
      triggerIdempotencyKey: identity.requestIdentity,
      correlationRef: identity.requestIdentity,
      requestedImpact: {
        objectSemanticId: "creator_audience",
        componentPaths: [...AUDIENCE_V1_PATHS],
      },
      processors: [
        {
          registryKey: AUDIENCE_V1_REGISTRY_KEY,
          activeScope: AUDIENCE_V1_PATHS.map((componentSemanticPath) => ({
            ownerScopeId: identity.ownerScopeId,
            subjectId: identity.creatorProfileId,
            objectSemanticId: "creator_audience",
            pathSchemeVersion: 1,
            componentSemanticPath,
          })),
          dependencyManifest: {
            kind: "CREATOR_AUDIENCE_V1_INPUT",
            value: source.value,
          },
          evidenceManifest: source.manifest,
          executionIntentKey: identity.requestIdentity,
          maxAttempts: 1,
          dependencyEligible: true,
        },
      ],
    });
    const processor = created.processorExecutions[0];
    const reused = processor.status === "COMPLETED";
    if (!reused) {
      const completed = await this.worker.runExact(
        processor.id,
        `creator-audience-v1:${identity.ownerScopeId}`,
        60_000,
      );
      if (completed.processorExecution.status !== "COMPLETED")
        throw new Error(
          "CREATOR_AUDIENCE_V1_EXECUTION_FAILED_CURRENT_PRESERVED",
        );
    }
    // Exact replay projects its own immutable Object, never a different later current.
    const generations = await this.prisma.intelligenceObjectGeneration.findMany(
      {
        where: {
          ownerScopeId: identity.ownerScopeId,
          processorExecutionId: processor.id,
        },
        select: { id: true, valuePayload: true },
      },
    );
    if (generations.length !== 1)
      throw new Error("CREATOR_AUDIENCE_V1_GENERATION_INVARIANT");
    return {
      state: source.value.status,
      reused,
      currentPreserved: false,
      value: AudienceV1ConsumerSchema.parse(generations[0].valuePayload),
      generationIds: generations.map((row) => row.id),
      processorExecutionId: processor.id,
    };
  }
}
