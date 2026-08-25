import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  IntelligenceActionActorType,
  IntelligenceAuthority,
  IntelligenceBusinessStateRevisionKind,
  IntelligenceComponentTransitionOutcome,
  IntelligenceFreshness,
  IntelligenceNodeKind,
  IntelligenceProducerKind,
  IntelligenceProtectionState,
  IntelligenceReadiness,
  IntelligenceValueState,
  Prisma,
} from "@prisma/client";
import { PersistenceTransitionValidator } from "../../contracts/validation/persistence-transition.validator";
import type {
  CurrentComponentSnapshot,
  ProposedComponentTransition,
} from "../../contracts/validation/validation.types";
import { IntelligencePersistenceError } from "../../domain/intelligence-persistence.error";
import {
  canonicalActiveScope,
  sha256CanonicalExecution,
} from "../../execution/domain/execution-hash";
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "../../execution/domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import type { ProcessorSuccessPersistenceHook } from "../../execution/processor-persistence.hook";
import { IntelligenceCurrentStateRepository } from "../../persistence/intelligence-current-state.repository";
import {
  IntelligenceGenerationRepository,
  type PersistGenerationCommand,
} from "../../persistence/intelligence-generation.repository";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import {
  BRAND_MEANING_OBJECTS,
  type BrandMeaningObject,
  type BrandMeaningPersistencePayload,
} from "./brand-meaning-processor.executor";

function uuid(material: string): string {
  const chars = createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function invalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}

@Injectable()
export class BrandMeaningPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly currentState: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly validator: PersistenceTransitionValidator,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    if (claim.processorExecution.processorId !== "brand_meaning")
      invalid("WRONG_PROCESSOR_PERSISTENCE_HOOK");
    const raw = result.persistencePayload;
    if (
      !raw ||
      typeof raw !== "object" ||
      (raw as { kind?: unknown }).kind !== "BRAND_MEANING_V1"
    )
      invalid("MISSING_VALIDATED_PERSISTENCE_PAYLOAD");
    try {
      await this.persist(tx, claim, raw as BrandMeaningPersistencePayload);
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof IntelligencePersistenceError)
        throw new ProcessorExecutorFailure({
          category:
            error.code === "PERSISTENCE_INVARIANT"
              ? "RETRYABLE_TECHNICAL"
              : "VALIDATION_FAILURE",
          code: `PERSISTENCE_${error.code}`,
        });
      throw new ProcessorExecutorFailure({
        category: "RETRYABLE_TECHNICAL",
        code:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? `PERSISTENCE_DATABASE_${error.code}`
            : "BRAND_MEANING_PERSISTENCE_TRANSITION_FAILED",
      });
    }
  }

  private async persist(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    payload: BrandMeaningPersistencePayload,
  ): Promise<void> {
    const execution = claim.processorExecution;
    const { prepared, output } = payload;
    const scope = prepared.activeScope;
    if (
      prepared.brandId !== execution.brandId ||
      scope.some((address) => address.brandId !== execution.brandId) ||
      sha256CanonicalExecution(canonicalActiveScope(scope)) !==
        execution.activeScopeHash ||
      prepared.dependencyManifestHash !== execution.dependencyManifestHash ||
      prepared.evidenceManifestHash !== execution.evidenceManifestHash
    )
      invalid("PERSISTENCE_DEPENDENCY_MISMATCH");
    const locked = await this.currentState.lockInCanonicalOrder(tx, scope);
    const evidenceByRef = new Map(
      prepared.evidence.capabilityResults.flatMap((cap) =>
        cap.evidence.map((item) => [item.evidenceRef, item] as const),
      ),
    );
    const snapshots: CurrentComponentSnapshot[] = [];
    const proposals: ProposedComponentTransition[] = [];
    const commands: PersistGenerationCommand[] = [];
    for (const address of scope) {
      if (
        !BRAND_MEANING_OBJECTS.some((id) => id === address.objectSemanticId) ||
        address.componentSemanticPath !== "$"
      )
        invalid("PERSISTENCE_UNOWNED_OBJECT_PATH");
      const objectId = address.objectSemanticId as BrandMeaningObject;
      const value = output[objectId];
      const metadata = output.output_metadata[objectId];
      if (value === undefined || (value === null) !== (metadata === null))
        invalid("PERSISTENCE_OUTPUT_ALIGNMENT");
      const state =
        value === null
          ? IntelligenceValueState.EXPLICIT_NULL
          : IntelligenceValueState.VALUE;
      const valuePayload = value === null ? Prisma.JsonNull : value;
      const valueHash = sha256CanonicalExecution(
        value === null ? { valueState: state } : value,
      );
      const readiness =
        value === null
          ? IntelligenceReadiness.NOT_READY
          : IntelligenceReadiness.READY;
      const authority =
        metadata?.authority === "OBSERVED"
          ? IntelligenceAuthority.OBSERVED
          : IntelligenceAuthority.CREATOR_SHOP_DERIVED;
      const freshness = metadata?.freshness ?? IntelligenceFreshness.UNKNOWN;
      const current = locked.get(this.currentState.key(address));
      const protectedCurrent =
        current !== undefined &&
        current.protectionState !== IntelligenceProtectionState.UNPROTECTED;
      const objectGenerationId = uuid(`${execution.id}:${objectId}`);
      const componentId = uuid(`${execution.id}:${objectId}:$`);
      // Null metadata means no asserted supporting Evidence. Never substitute all
      // prepared Evidence for an independently nullable Object.
      const evidenceRefs = [...new Set(metadata?.evidence_refs ?? [])].sort();
      const expectedCurrent = current
        ? {
            state: "PRESENT" as const,
            generationId: current.currentComponentGenerationId,
            revision: current.revision,
          }
        : { state: "ABSENT" as const };
      snapshots.push({
        ...address,
        exists: Boolean(current),
        generationId: current?.currentComponentGenerationId,
        revision: current?.revision,
        authority: current?.currentAuthority,
        protected: protectedCurrent,
      });
      proposals.push({
        ...address,
        disposition: protectedCurrent ? "CREATE_CANDIDATE" : "APPLY_CURRENT",
        authority,
        expectedCurrent,
        basisGenerationId: protectedCurrent
          ? current?.currentComponentGenerationId
          : undefined,
        basisRevision: protectedCurrent ? current?.revision : undefined,
        evidenceRefs,
        businessStateRefs: prepared.canonicalState.entries.map(
          (entry) => entry.businessStateReference.revisionToken,
        ),
      });
      commands.push({
        object: {
          id: objectGenerationId,
          brandId: execution.brandId,
          objectSemanticId: objectId,
          objectContractId: "objects",
          objectContractVersion: "1.0",
          outputContractId: execution.outputContractId,
          outputContractVersion: execution.outputContractVersion,
          producerKind: IntelligenceProducerKind.PROCESSOR_OUTPUT,
          producerId: execution.processorId,
          producerVersion: execution.processorVersion,
          bundleId: execution.bundleId,
          bundleVersion: execution.bundleVersion,
          bundleHash: execution.bundleHash,
          processorExecutionId: execution.id,
          successfulAttemptId: claim.attempt.id,
          valueState: state,
          valuePayload,
          valueHash,
          objectMetadataPayload:
            metadata === null
              ? Prisma.JsonNull
              : (metadata as unknown as Prisma.InputJsonValue),
          readiness,
          freshnessAtGeneration: freshness,
          activeScope: canonicalActiveScope([
            address,
          ]) as unknown as Prisma.InputJsonValue,
          activeScopeHash: sha256CanonicalExecution(
            canonicalActiveScope([address]),
          ),
        },
        components: [
          {
            id: componentId,
            componentSemanticPath: "$",
            pathSchemeVersion: 1,
            nodeKind: IntelligenceNodeKind.SCALAR,
            componentContractId: objectId,
            componentContractVersion: execution.outputContractVersion,
            valueState: state,
            valuePayload,
            valueHash,
            authority,
            sourceClass: metadata?.source_class ?? "SYSTEM_DERIVATION_INPUT",
            readiness,
            freshnessAtGeneration: freshness,
            metadataPayload:
              metadata === null
                ? Prisma.JsonNull
                : (metadata as unknown as Prisma.InputJsonValue),
            supersedesComponentGenerationId:
              current && !protectedCurrent
                ? current.currentComponentGenerationId
                : null,
          },
        ],
        evidenceReferences: evidenceRefs.map((evidenceRef) => {
          const evidence = evidenceByRef.get(evidenceRef);
          if (!evidence) invalid("PERSISTENCE_UNKNOWN_EVIDENCE_REFERENCE");
          return {
            id: uuid(`${componentId}:evidence:${evidenceRef}`),
            componentSemanticPath: "$",
            evidenceRef,
            capabilityId: evidence.capabilityId,
            captureId: evidence.captureRef,
            captureVersion: evidence.captureVersion,
            sourceClass: evidence.sourceClass,
            capturedAt: new Date(evidence.capturedAt),
            observedFreshness: evidence.freshness.state,
            evidenceManifestRef: execution.id,
            evidenceManifestHash: execution.evidenceManifestHash,
          };
        }),
        businessStateReferences: prepared.canonicalState.entries.map(
          (entry) => {
            const ref = entry.businessStateReference;
            return {
              id: uuid(
                `${componentId}:business:${entry.semantic}:${ref.revisionToken}`,
              ),
              componentSemanticPath: "$",
              entityType: ref.entityType,
              entityId: ref.entityId,
              semanticFieldPath: ref.semanticFieldPath,
              revisionKind:
                IntelligenceBusinessStateRevisionKind[ref.revisionKind],
              revisionToken: ref.revisionToken,
              observedAt: new Date(ref.observedAt),
              canonicalSnapshotRef: ref.canonicalSnapshotRef,
            };
          },
        ),
      });
    }
    const validation = this.validator.validate({
      registryKey: prepared.registryKey,
      activeScope: scope,
      currentState: snapshots,
      proposals,
    });
    if (!validation.valid)
      invalid(
        `PERSISTENCE_${validation.issues[0]?.code ?? "INVALID_TRANSITION"}`,
      );
    // All Objects, lineage, and independent transitions share the caller's live-lease transaction.
    for (const command of commands)
      await this.generations.persistInTransaction(tx, command);
    const transition = await this.transitions.transitionInTransaction(tx, {
      action: {
        id: uuid(`${execution.id}:success-transition`),
        brandId: execution.brandId,
        actionType: "PROCESSOR_GENERATION_APPLY",
        actorType: IntelligenceActionActorType.PROCESSOR,
        actorRef: execution.processorId,
        requestIdempotencyKey: execution.processorExecutionKey,
        correlationRef: execution.executionId,
        reasonCode: "VALIDATED_PROCESSOR_RESULT",
        processorExecutionId: execution.id,
      },
      decisions: proposals.map((proposal) => ({
        kind: "APPLY_GENERATION" as const,
        brandId: proposal.brandId,
        objectSemanticId: proposal.objectSemanticId,
        pathSchemeVersion: proposal.pathSchemeVersion,
        componentSemanticPath: proposal.componentSemanticPath,
        expectedCurrent: proposal.expectedCurrent,
        generationId: uuid(`${execution.id}:${proposal.objectSemanticId}:$`),
        discrepancyCode: "PROTECTED_VALUE_CONFLICT",
      })),
    });
    const accepted = new Set<IntelligenceComponentTransitionOutcome>([
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
      IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      IntelligenceComponentTransitionOutcome.NOOP_EQUIVALENT,
    ]);
    if (transition.outcomes.some((outcome) => !accepted.has(outcome.outcome)))
      invalid("PERSISTENCE_TRANSITION_REJECTED");
  }
}
