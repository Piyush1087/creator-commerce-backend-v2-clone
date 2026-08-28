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
import { IntelligencePersistenceError } from "../../domain/intelligence-persistence.error";
import type {
  CurrentComponentSnapshot,
  ProposedComponentTransition,
} from "../../contracts/validation/validation.types";
import { sha256CanonicalExecution } from "../../execution/domain/execution-hash";
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "../../execution/domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "../../execution/executor/processor-executor";
import type { ProcessorSuccessPersistenceHook } from "../../execution/processor-persistence.hook";
import {
  IntelligenceGenerationRepository,
  type ComponentGenerationWrite,
  type EvidenceReferenceWrite,
  type BusinessStateReferenceWrite,
} from "../../persistence/intelligence-generation.repository";
import { IntelligenceCurrentStateRepository } from "../../persistence/intelligence-current-state.repository";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import type { BrandCommunicationPersistencePayload } from "./brand-communication-processor.executor";

type JsonRecord = Readonly<Record<string, unknown>>;

interface ExtractedComponent {
  readonly value: unknown;
  readonly state: IntelligenceValueState;
  readonly metadata: JsonRecord;
  readonly nodeKind: IntelligenceNodeKind;
  readonly presentationOrder?: number;
}

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function deterministicUuid(material: string): string {
  const chars = createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function jsonValue(value: unknown, state: IntelligenceValueState) {
  if (state === IntelligenceValueState.EXPLICIT_NULL) return Prisma.JsonNull;
  if (state === IntelligenceValueState.INTENTIONALLY_ABSENT) return undefined;
  return value as Prisma.InputJsonValue;
}

function outputReadiness(output: JsonRecord): IntelligenceReadiness {
  const profile = record(output.communication_profile);
  if (!profile) return IntelligenceReadiness.NOT_READY;
  const values = [
    profile.tone_traits,
    profile.free_text_guidance,
    profile.communication_constraints,
    profile.primary_language,
  ];
  return values.every((value) => value !== null && value !== undefined)
    ? IntelligenceReadiness.READY
    : values.some((value) => value !== null && value !== undefined)
      ? IntelligenceReadiness.PARTIAL
      : IntelligenceReadiness.NOT_READY;
}

@Injectable()
export class BrandCommunicationPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly currentState: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly persistenceValidator: PersistenceTransitionValidator,
    private readonly paths: ComponentPathCodec,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    if (claim.processorExecution.processorId !== "brand_communication") return;
    const payload = this.payload(result.persistencePayload);
    try {
      await this.persist(tx, claim, result, payload);
    } catch (error) {
      if (error instanceof ProcessorExecutorFailure) throw error;
      if (error instanceof IntelligencePersistenceError) {
        throw new ProcessorExecutorFailure({
          category:
            error.code === "PERSISTENCE_INVARIANT"
              ? "RETRYABLE_TECHNICAL"
              : "VALIDATION_FAILURE",
          code: `PERSISTENCE_${error.code}`,
        });
      }
      throw new ProcessorExecutorFailure({
        category: "RETRYABLE_TECHNICAL",
        code:
          error instanceof Prisma.PrismaClientKnownRequestError
            ? `PERSISTENCE_DATABASE_${error.code}`
            : "BRAND_COMMUNICATION_PERSISTENCE_TRANSITION_FAILED",
      });
    }
  }

  private async persist(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
    payload: BrandCommunicationPersistencePayload,
  ): Promise<void> {
    const execution = claim.processorExecution;
    const scope = payload.prepared.activeScope;
    const locked = await this.currentState.lockInCanonicalOrder(tx, scope);
    const objectGenerationId = deterministicUuid(
      `${execution.id}:communication_profile`,
    );
    const allEvidence = payload.prepared.evidence.capabilityResults.flatMap(
      (capability) => capability.evidence,
    );
    const evidenceByRef = new Map(
      allEvidence.map((item) => [item.evidenceRef, item]),
    );
    const components: ComponentGenerationWrite[] = [];
    const evidenceReferences: EvidenceReferenceWrite[] = [];
    const businessStateReferences: BusinessStateReferenceWrite[] = [];
    const proposals: ProposedComponentTransition[] = [];
    const snapshots: CurrentComponentSnapshot[] = [];

    for (const address of scope) {
      const extracted = this.extract(payload.output, address);
      const current = locked.get(this.currentState.key(address));
      const componentId = deterministicUuid(
        `${execution.id}:${address.objectSemanticId}:${address.componentSemanticPath}`,
      );
      const evidenceRefs = this.evidenceRefs(
        extracted.metadata,
        allEvidence.map((item) => item.evidenceRef),
      );
      const authority = this.authority(extracted.metadata);
      const sourceClass =
        typeof extracted.metadata.source_class === "string"
          ? extracted.metadata.source_class
          : "MULTI_SOURCE";
      const freshness = this.freshness(extracted.metadata);
      components.push({
        id: componentId,
        pathSchemeVersion: address.pathSchemeVersion,
        componentSemanticPath: address.componentSemanticPath,
        nodeKind: extracted.nodeKind,
        componentContractId: "communication_profile",
        componentContractVersion: execution.outputContractVersion,
        valueState: extracted.state,
        valuePayload: jsonValue(extracted.value, extracted.state),
        valueHash: sha256CanonicalExecution(
          extracted.state === IntelligenceValueState.VALUE
            ? extracted.value
            : { valueState: extracted.state },
        ),
        authority,
        sourceClass,
        readiness:
          extracted.state === IntelligenceValueState.VALUE
            ? IntelligenceReadiness.READY
            : IntelligenceReadiness.NOT_READY,
        freshnessAtGeneration: freshness,
        metadataPayload: extracted.metadata as Prisma.InputJsonValue,
        presentationOrder: extracted.presentationOrder,
        supersedesComponentGenerationId:
          current &&
          current.protectionState === IntelligenceProtectionState.UNPROTECTED
            ? current.currentComponentGenerationId
            : null,
      });
      for (const evidenceRef of evidenceRefs) {
        const evidence = evidenceByRef.get(evidenceRef);
        if (!evidence) continue;
        evidenceReferences.push({
          id: deterministicUuid(`${componentId}:evidence:${evidenceRef}`),
          componentSemanticPath: address.componentSemanticPath,
          evidenceRef,
          capabilityId: evidence.capabilityId,
          captureId: evidence.captureRef,
          captureVersion: evidence.captureVersion,
          sourceClass: evidence.sourceClass,
          capturedAt: new Date(evidence.capturedAt),
          observedFreshness: evidence.freshness.state,
          evidenceManifestRef: execution.id,
          evidenceManifestHash: execution.evidenceManifestHash,
        });
      }
      for (const entry of payload.prepared.canonicalState.entries) {
        const reference = entry.businessStateReference;
        businessStateReferences.push({
          id: deterministicUuid(
            `${componentId}:business:${entry.semantic}:${reference.revisionToken}`,
          ),
          componentSemanticPath: address.componentSemanticPath,
          entityType: reference.entityType,
          entityId: reference.entityId,
          semanticFieldPath: reference.semanticFieldPath,
          revisionKind:
            IntelligenceBusinessStateRevisionKind[reference.revisionKind],
          revisionToken: reference.revisionToken,
          observedAt: new Date(reference.observedAt),
          canonicalSnapshotRef: reference.canonicalSnapshotRef,
        });
      }
      const expectedCurrent = current
        ? {
            state: "PRESENT" as const,
            generationId: current.currentComponentGenerationId,
            revision: current.revision,
          }
        : { state: "ABSENT" as const };
      const protectedCurrent =
        current?.protectionState !== undefined &&
        current.protectionState !== IntelligenceProtectionState.UNPROTECTED;
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
        businessStateRefs: payload.prepared.canonicalState.entries.map(
          (entry) => entry.businessStateReference.revisionToken,
        ),
      });
    }

    const registryKey = payload.prepared.registryKey;
    const validation = this.persistenceValidator.validate({
      registryKey,
      activeScope: scope,
      currentState: snapshots,
      proposals,
    });
    if (!validation.valid) {
      throw new ProcessorExecutorFailure({
        category: "VALIDATION_FAILURE",
        code: `PERSISTENCE_${validation.issues[0]?.code ?? "INVALID_TRANSITION"}`,
      });
    }

    const profile = payload.output.communication_profile;
    const objectValueState =
      profile === null
        ? IntelligenceValueState.EXPLICIT_NULL
        : IntelligenceValueState.VALUE;
    const persisted = await this.generations.persistInTransaction(tx, {
      object: {
        id: objectGenerationId,
        brandId: execution.brandId,
        objectSemanticId: "communication_profile",
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
        valueState: objectValueState,
        valuePayload: jsonValue(profile, objectValueState),
        valueHash: sha256CanonicalExecution(
          profile === null ? { valueState: "EXPLICIT_NULL" } : profile,
        ),
        objectMetadataPayload: (record(payload.output.output_metadata) ??
          {}) as Prisma.InputJsonValue,
        readiness: result.readiness ?? outputReadiness(payload.output),
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        activeScope: execution.activeScope as Prisma.InputJsonValue,
        activeScopeHash: execution.activeScopeHash,
      },
      components,
      evidenceReferences,
      businessStateReferences,
    });

    const componentByPath = new Map(
      persisted.componentGenerations.map((component) => [
        component.componentSemanticPath,
        component,
      ]),
    );
    const transition = await this.transitions.transitionInTransaction(tx, {
      action: {
        id: deterministicUuid(`${execution.id}:success-transition`),
        brandId: execution.brandId,
        actionType: "PROCESSOR_GENERATION_APPLY",
        actorType: IntelligenceActionActorType.PROCESSOR,
        actorRef: execution.processorId,
        requestIdempotencyKey: execution.processorExecutionKey,
        correlationRef: execution.executionId,
        reasonCode: "VALIDATED_PROCESSOR_RESULT",
        processorExecutionId: execution.id,
      },
      decisions: scope.map((address) => {
        const current = locked.get(this.currentState.key(address));
        return {
          kind: "APPLY_GENERATION" as const,
          ...address,
          expectedCurrent: current
            ? {
                state: "PRESENT" as const,
                generationId: current.currentComponentGenerationId,
                revision: current.revision,
              }
            : { state: "ABSENT" as const },
          generationId: componentByPath.get(address.componentSemanticPath)!.id,
          discrepancyCode: "PROTECTED_VALUE_CONFLICT",
        };
      }),
    });
    const accepted = new Set<IntelligenceComponentTransitionOutcome>([
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
      IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      IntelligenceComponentTransitionOutcome.NOOP_EQUIVALENT,
    ]);
    if (transition.outcomes.some((outcome) => !accepted.has(outcome.outcome))) {
      throw new ProcessorExecutorFailure({
        category: "VALIDATION_FAILURE",
        code: "PERSISTENCE_TRANSITION_REJECTED",
      });
    }
  }

  private payload(value: unknown): BrandCommunicationPersistencePayload {
    if (
      !value ||
      typeof value !== "object" ||
      (value as { kind?: unknown }).kind !== "BRAND_COMMUNICATION_V1"
    ) {
      throw new ProcessorExecutorFailure({
        category: "VALIDATION_FAILURE",
        code: "MISSING_VALIDATED_PERSISTENCE_PAYLOAD",
      });
    }
    return value as BrandCommunicationPersistencePayload;
  }

  private extract(
    output: JsonRecord,
    address: ComponentSemanticAddress,
  ): ExtractedComponent {
    const profile = record(output.communication_profile);
    const metadata = record(output.output_metadata) ?? {};
    if (address.componentSemanticPath === "$") {
      return this.component(
        output.communication_profile,
        metadata,
        IntelligenceNodeKind.SCALAR,
      );
    }
    const decoded = this.paths.decode(
      address.componentSemanticPath,
      address.pathSchemeVersion,
    );
    const field = decoded.segments[0];
    if (field?.kind !== "field") throw new Error("INVALID_COMPONENT_PATH");
    if (decoded.segments.length === 1) {
      return this.component(
        profile?.[field.value],
        record(metadata[field.value]) ?? {},
        IntelligenceNodeKind.OBJECT_FIELD,
      );
    }
    const item = decoded.segments[1];
    if (item?.kind !== "item") throw new Error("INVALID_COMPONENT_ITEM_PATH");
    const values = Array.isArray(profile?.[field.value])
      ? (profile?.[field.value] as unknown[])
      : [];
    const metadataValues = Array.isArray(metadata[field.value])
      ? (metadata[field.value] as unknown[])
      : [];
    const valueIndex = values.findIndex(
      (value) => record(value)?.semantic_id === item.semanticId,
    );
    const value = valueIndex >= 0 ? values[valueIndex] : undefined;
    const itemMetadata =
      metadataValues.find(
        (candidate) => record(candidate)?.semantic_id === item.semanticId,
      ) ?? {};
    return {
      ...this.component(
        value,
        record(itemMetadata) ?? {},
        IntelligenceNodeKind.SEMANTIC_ITEM,
      ),
      presentationOrder: valueIndex >= 0 ? valueIndex : undefined,
    };
  }

  private component(
    value: unknown,
    metadata: JsonRecord,
    nodeKind: IntelligenceNodeKind,
  ): ExtractedComponent {
    return {
      value,
      state:
        value === undefined
          ? IntelligenceValueState.INTENTIONALLY_ABSENT
          : value === null
            ? IntelligenceValueState.EXPLICIT_NULL
            : IntelligenceValueState.VALUE,
      metadata,
      nodeKind,
    };
  }

  private evidenceRefs(
    metadata: JsonRecord,
    fallback: readonly string[],
  ): string[] {
    const refs = Array.isArray(metadata.evidence_refs)
      ? metadata.evidence_refs.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    return [...new Set(refs.length > 0 ? refs : fallback)].sort();
  }

  private authority(metadata: JsonRecord): IntelligenceAuthority {
    return metadata.authority === "OBSERVED"
      ? IntelligenceAuthority.OBSERVED
      : IntelligenceAuthority.CREATOR_SHOP_DERIVED;
  }

  private freshness(metadata: JsonRecord): IntelligenceFreshness {
    return metadata.freshness === "STALE"
      ? IntelligenceFreshness.STALE
      : metadata.freshness === "UNKNOWN"
        ? IntelligenceFreshness.UNKNOWN
        : IntelligenceFreshness.CURRENT;
  }
}
