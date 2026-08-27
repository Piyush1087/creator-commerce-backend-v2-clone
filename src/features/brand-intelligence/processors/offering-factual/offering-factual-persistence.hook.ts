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
  type BusinessStateReferenceWrite,
  type ComponentGenerationWrite,
  type EvidenceReferenceWrite,
} from "../../persistence/intelligence-generation.repository";
import { ComponentPathCodec } from "../../semantic-path/component-path.codec";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import { offeringBusinessStateRef } from "./offering-factual-processor.executor";
import {
  OFFERING_FACTUAL_OBJECT,
  type OfferingFactualPersistencePayload,
} from "./offering-factual.types";

type JsonRecord = Readonly<Record<string, unknown>>;

interface ExtractedComponent {
  readonly value: unknown;
  readonly state: IntelligenceValueState;
  readonly metadata: unknown;
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

function invalid(code: string): never {
  throw new ProcessorExecutorFailure({ category: "VALIDATION_FAILURE", code });
}

@Injectable()
export class OfferingFactualPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly currentState: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly validator: PersistenceTransitionValidator,
    private readonly paths: ComponentPathCodec,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    if (claim.processorExecution.processorId !== "offering_factual_synthesis") {
      invalid("WRONG_PROCESSOR_PERSISTENCE_HOOK");
    }
    const raw = result.persistencePayload;
    if (
      !raw ||
      typeof raw !== "object" ||
      (raw as { kind?: unknown }).kind !== "OFFERING_FACTUAL_V1"
    ) {
      invalid("MISSING_VALIDATED_PERSISTENCE_PAYLOAD");
    }
    try {
      await this.persist(
        tx,
        claim,
        result,
        raw as OfferingFactualPersistencePayload,
      );
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
            : "OFFERING_FACTUAL_PERSISTENCE_TRANSITION_FAILED",
      });
    }
  }

  private async persist(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
    payload: OfferingFactualPersistencePayload,
  ): Promise<void> {
    const execution = claim.processorExecution;
    const { prepared, output, offeringRef } = payload;
    const scope = prepared.activeScope;
    if (
      prepared.brandId !== execution.brandId ||
      prepared.canonicalState.brandId !== execution.brandId ||
      prepared.evidence.brandId !== execution.brandId ||
      prepared.evidence.canonicalOfferingRef !== offeringRef ||
      prepared.canonicalState.offeringFacts?.length !== 1 ||
      prepared.canonicalState.offeringFacts[0].offeringId !== offeringRef ||
      scope.some(
        (address) =>
          address.brandId !== execution.brandId ||
          address.subjectId !== execution.subjectId ||
          address.objectSemanticId !== OFFERING_FACTUAL_OBJECT,
      ) ||
      sha256CanonicalExecution(canonicalActiveScope(scope)) !==
        execution.activeScopeHash ||
      prepared.dependencyManifestHash !== execution.dependencyManifestHash ||
      prepared.evidenceManifestHash !== execution.evidenceManifestHash
    ) {
      invalid("PERSISTENCE_DEPENDENCY_MISMATCH");
    }
    const newerBasis = await tx.intelligenceProcessorExecution.findFirst({
      where: {
        brandId: execution.brandId,
        subjectId: execution.subjectId,
        processorId: execution.processorId,
        createdAt: { gt: execution.createdAt },
        OR: [
          { dependencyManifestHash: { not: execution.dependencyManifestHash } },
          { evidenceManifestHash: { not: execution.evidenceManifestHash } },
          { activeScopeHash: { not: execution.activeScopeHash } },
        ],
      },
      select: { id: true },
    });
    if (newerBasis) {
      throw new ProcessorExecutorFailure({
        category: "RETRYABLE_TECHNICAL",
        code: "STALE_OFFERING_BASIS_COMPLETION",
      });
    }

    const locked = await this.currentState.lockInCanonicalOrder(tx, scope);
    const allEvidence = prepared.evidence.capabilityResults.flatMap(
      (capability) => capability.evidence,
    );
    const evidenceByRef = new Map(
      allEvidence.map((item) => [item.evidenceRef, item]),
    );
    const businessFact = prepared.canonicalState.offeringFacts[0];
    const businessRef = offeringBusinessStateRef(
      businessFact.offeringId,
      businessFact.businessStateReference,
    );
    const components: ComponentGenerationWrite[] = [];
    const evidenceReferences: EvidenceReferenceWrite[] = [];
    const businessStateReferences: BusinessStateReferenceWrite[] = [];
    const snapshots: CurrentComponentSnapshot[] = [];
    const proposals: ProposedComponentTransition[] = [];

    for (const address of scope) {
      const extracted = this.extract(output, address);
      const current = locked.get(this.currentState.key(address));
      const componentId = deterministicUuid(
        `${execution.id}:${OFFERING_FACTUAL_OBJECT}:${address.componentSemanticPath}`,
      );
      const evidenceRefs = this.stringRefs(extracted.metadata, "evidence_refs");
      const businessRefs = this.stringRefs(
        extracted.metadata,
        "business_state_refs",
      );
      const effectiveEvidenceRefs =
        address.componentSemanticPath === "$"
          ? this.rootRefs(output, "evidence_refs")
          : evidenceRefs;
      const effectiveBusinessRefs =
        address.componentSemanticPath === "$"
          ? this.rootRefs(output, "business_state_refs")
          : businessRefs;
      const authority = this.authority(extracted.metadata);
      const freshness = this.freshness(extracted.metadata);
      const state = extracted.state;
      components.push({
        id: componentId,
        pathSchemeVersion: address.pathSchemeVersion,
        componentSemanticPath: address.componentSemanticPath,
        nodeKind: extracted.nodeKind,
        componentContractId: OFFERING_FACTUAL_OBJECT,
        componentContractVersion: execution.outputContractVersion,
        valueState: state,
        valuePayload: jsonValue(extracted.value, state),
        valueHash: sha256CanonicalExecution(
          state === IntelligenceValueState.VALUE
            ? extracted.value
            : { valueState: state },
        ),
        authority,
        sourceClass: this.sourceClass(extracted.metadata),
        readiness:
          address.componentSemanticPath === "$"
            ? result.readiness
            : state === IntelligenceValueState.VALUE
              ? IntelligenceReadiness.READY
              : IntelligenceReadiness.NOT_READY,
        freshnessAtGeneration: freshness,
        metadataPayload: this.metadataJson(extracted.metadata),
        presentationOrder: extracted.presentationOrder,
        supersedesComponentGenerationId:
          current?.protectionState === IntelligenceProtectionState.UNPROTECTED
            ? current.currentComponentGenerationId
            : null,
      });
      for (const evidenceRef of effectiveEvidenceRefs) {
        const evidence = evidenceByRef.get(evidenceRef);
        if (!evidence) invalid("PERSISTENCE_UNKNOWN_EVIDENCE_REF");
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
      if (effectiveBusinessRefs.includes(businessRef)) {
        const reference = businessFact.businessStateReference;
        businessStateReferences.push({
          id: deterministicUuid(`${componentId}:business:${businessRef}`),
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
      const protectedCurrent =
        current !== undefined &&
        current.protectionState !== IntelligenceProtectionState.UNPROTECTED;
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
          ? current.currentComponentGenerationId
          : undefined,
        basisRevision: protectedCurrent ? current.revision : undefined,
        evidenceRefs: effectiveEvidenceRefs,
        businessStateRefs: effectiveBusinessRefs,
      });
    }

    const validation = this.validator.validate({
      registryKey: prepared.registryKey,
      activeScope: scope,
      currentState: snapshots,
      proposals,
    });
    if (!validation.valid) {
      invalid(
        `PERSISTENCE_${validation.issues[0]?.code ?? "INVALID_TRANSITION"}`,
      );
    }
    const profile = output.offering_factual_profile;
    const objectValueState =
      profile === null
        ? IntelligenceValueState.EXPLICIT_NULL
        : IntelligenceValueState.VALUE;
    const objectGenerationId = deterministicUuid(
      `${execution.id}:${OFFERING_FACTUAL_OBJECT}`,
    );
    const persisted = await this.generations.persistInTransaction(tx, {
      object: {
        id: objectGenerationId,
        brandId: execution.brandId,
        objectSemanticId: OFFERING_FACTUAL_OBJECT,
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
          profile === null ? { valueState: objectValueState } : profile,
        ),
        objectMetadataPayload: (output.output_metadata ??
          {}) as Prisma.InputJsonValue,
        readiness: result.readiness,
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
        subjectId: execution.subjectId,
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
          discrepancyCode: "PROTECTED_OFFERING_VALUE_CONFLICT",
        };
      }),
    });
    const accepted = new Set<IntelligenceComponentTransitionOutcome>([
      IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
      IntelligenceComponentTransitionOutcome.RECORDED_CANDIDATE,
      IntelligenceComponentTransitionOutcome.NOOP_EQUIVALENT,
    ]);
    if (transition.outcomes.some((outcome) => !accepted.has(outcome.outcome))) {
      invalid("PERSISTENCE_TRANSITION_REJECTED");
    }
  }

  private extract(
    output: JsonRecord,
    address: ComponentSemanticAddress,
  ): ExtractedComponent {
    const profile = record(output.offering_factual_profile);
    const metadata = record(output.output_metadata) ?? {};
    if (address.componentSemanticPath === "$") {
      return this.component(
        output.offering_factual_profile,
        metadata,
        IntelligenceNodeKind.SCALAR,
      );
    }
    const decoded = this.paths.decode(
      address.componentSemanticPath,
      address.pathSchemeVersion,
    );
    const field = decoded.segments[0];
    if (field?.kind !== "field") invalid("PERSISTENCE_INVALID_COMPONENT_PATH");
    if (decoded.segments.length === 1) {
      return this.component(
        profile?.[field.value],
        metadata[field.value],
        IntelligenceNodeKind.OBJECT_FIELD,
      );
    }
    const item = decoded.segments[1];
    if (item?.kind !== "item" || decoded.segments.length !== 2) {
      invalid("PERSISTENCE_INVALID_ITEM_PATH");
    }
    const values = Array.isArray(profile?.[field.value])
      ? (profile[field.value] as unknown[])
      : [];
    const metadataValues = Array.isArray(metadata[field.value])
      ? (metadata[field.value] as unknown[])
      : [];
    const valueIndex = values.findIndex(
      (value) => record(value)?.semantic_id === item.semanticId,
    );
    const value = valueIndex >= 0 ? values[valueIndex] : undefined;
    const itemMetadata = metadataValues.find(
      (candidate) => record(candidate)?.semantic_id === item.semanticId,
    );
    return {
      ...this.component(
        value,
        itemMetadata,
        IntelligenceNodeKind.SEMANTIC_ITEM,
      ),
      presentationOrder: valueIndex >= 0 ? valueIndex : undefined,
    };
  }

  private component(
    value: unknown,
    metadata: unknown,
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

  private stringRefs(value: unknown, key: string): string[] {
    const found: string[] = [];
    const visit = (candidate: unknown): void => {
      if (Array.isArray(candidate)) {
        candidate.forEach(visit);
        return;
      }
      const item = record(candidate);
      if (!item) return;
      const refs = item[key];
      if (Array.isArray(refs)) {
        found.push(
          ...refs.filter((ref): ref is string => typeof ref === "string"),
        );
      }
      Object.values(item).forEach(visit);
    };
    visit(value);
    return [...new Set(found)].sort();
  }

  private rootRefs(output: JsonRecord, key: string): string[] {
    return this.stringRefs(output.output_metadata, key);
  }

  private authority(metadata: unknown): IntelligenceAuthority {
    const values = this.metadataStrings(metadata, "authority");
    if (values.length > 0 && values.every((value) => value === "OBSERVED")) {
      return IntelligenceAuthority.OBSERVED;
    }
    if (
      values.length > 0 &&
      values.every((value) => value === "SYSTEM_DERIVED")
    ) {
      return IntelligenceAuthority.SYSTEM_DERIVED;
    }
    return IntelligenceAuthority.CREATOR_SHOP_DERIVED;
  }

  private sourceClass(metadata: unknown): string {
    const values = this.metadataStrings(metadata, "source_class");
    return values.length === 1 ? values[0] : "MULTI_SOURCE";
  }

  private freshness(metadata: unknown): IntelligenceFreshness {
    const values = this.metadataStrings(metadata, "freshness");
    return values.includes("STALE")
      ? IntelligenceFreshness.STALE
      : values.length === 0 || values.includes("UNKNOWN")
        ? IntelligenceFreshness.UNKNOWN
        : IntelligenceFreshness.CURRENT;
  }

  private metadataStrings(value: unknown, key: string): string[] {
    const found: string[] = [];
    const visit = (candidate: unknown): void => {
      if (Array.isArray(candidate)) {
        candidate.forEach(visit);
        return;
      }
      const item = record(candidate);
      if (!item) return;
      if (typeof item[key] === "string") found.push(item[key]);
      Object.values(item).forEach(visit);
    };
    visit(value);
    return [...new Set(found)];
  }

  private metadataJson(value: unknown): Prisma.InputJsonValue {
    if (value === undefined) return {};
    if (value === null) return {};
    return value as Prisma.InputJsonValue;
  }
}
