import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  IntelligenceAuthority,
  IntelligenceComponentTransitionOutcome,
  IntelligenceFreshness,
  IntelligenceNodeKind,
  IntelligenceReadiness,
  IntelligenceValueState,
  Prisma,
} from "@prisma/client";
import { canonicalJson } from "../../contracts/bundle/canonical-json";
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
  type ComponentGenerationWrite,
  type EvidenceReferenceWrite,
  type BusinessStateReferenceWrite,
} from "../../persistence/intelligence-generation.repository";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import {
  characterCurrentFingerprint,
  characterInvalid,
  characterScopeAllows,
  itemPath,
  validateCharacterIdentity,
} from "./brand-character-identity";
import {
  BrandCharacterStateRepository,
  type CharacterCurrentState,
} from "./brand-character-state.repository";
import {
  BRAND_CHARACTER_OBJECTS,
  type BrandCharacterPersistencePayload,
  type CharacterItemMetadata,
} from "./brand-character.types";

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
const stateKey = (row: {
  objectSemanticId: string;
  componentSemanticPath: string;
}) => `${row.objectSemanticId}:${row.componentSemanticPath}`;

/** Only plans/persists Character components inside W1.0D's caller-owned live-lease transaction. */
@Injectable()
export class BrandCharacterPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly currentState: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly validator: PersistenceTransitionValidator,
    private readonly catalogue: BrandCharacterStateRepository,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    if (claim.processorExecution.processorId !== "brand_character")
      characterInvalid("WRONG_PROCESSOR_PERSISTENCE_HOOK");
    const raw = result.persistencePayload;
    if (
      !raw ||
      typeof raw !== "object" ||
      (raw as { kind?: unknown }).kind !== "BRAND_CHARACTER_V1"
    )
      characterInvalid("MISSING_VALIDATED_PERSISTENCE_PAYLOAD");
    try {
      await this.persist(tx, claim, raw as BrandCharacterPersistencePayload);
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
            : "CHARACTER_PERSISTENCE_FAILED",
      });
    }
  }

  private async persist(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    payload: BrandCharacterPersistencePayload,
  ): Promise<void> {
    const execution = claim.processorExecution;
    const { prepared, output, current: before } = payload;
    if (
      prepared.brandId !== execution.brandId ||
      prepared.activeScope.some((a) => a.brandId !== execution.brandId) ||
      sha256CanonicalExecution(canonicalActiveScope(prepared.activeScope)) !==
        execution.activeScopeHash ||
      prepared.dependencyManifestHash !== execution.dependencyManifestHash ||
      prepared.evidenceManifestHash !== execution.evidenceManifestHash
    )
      characterInvalid("PERSISTENCE_DEPENDENCY_MISMATCH");
    const objects = BRAND_CHARACTER_OBJECTS.filter((id) =>
      prepared.activeScope.some((a) => a.objectSemanticId === id),
    );
    const address = (
      objectSemanticId: string,
      componentSemanticPath: string,
    ): ComponentSemanticAddress => ({
      brandId: execution.brandId,
      objectSemanticId,
      componentSemanticPath,
      pathSchemeVersion: 1,
    });
    const allAddresses = [
      ...objects.map((id) => address(id, "$")),
      ...before.map((row) =>
        address(row.objectSemanticId, row.componentSemanticPath),
      ),
      ...objects.flatMap((id) =>
        (output[id] ?? []).map((item) =>
          address(id, itemPath(item.semantic_id)),
        ),
      ),
    ];
    // The collection root serializes concurrent Character item admission; concrete item locks
    // also coordinate with authorized W1.0B application actions. No provider call is inside this transaction.
    const lockAddresses = [
      ...new Map(allAddresses.map((a) => [stateKey(a), a])).values(),
    ];
    await this.currentState.lockInCanonicalOrder(tx, lockAddresses);
    const live = await this.catalogue.read(execution.brandId, objects, tx);
    if (
      characterCurrentFingerprint(live) !== characterCurrentFingerprint(before)
    )
      throw new ProcessorExecutorFailure({
        category: "RETRYABLE_TECHNICAL",
        code: "CHARACTER_CURRENT_BASIS_CHANGED",
      });
    validateCharacterIdentity(output, live, prepared.activeScope);
    const byPath = new Map(live.map((row) => [stateKey(row), row]));
    const evidence = new Map(
      prepared.evidence.capabilityResults.flatMap((cap) =>
        cap.evidence.map((item) => [item.evidenceRef, item] as const),
      ),
    );
    const proposals: ProposedComponentTransition[] = [];
    const snapshots: CurrentComponentSnapshot[] = [];
    const generationIds = new Map<string, string>();

    for (const objectId of objects) {
      const components: ComponentGenerationWrite[] = [];
      const evidenceRefs: EvidenceReferenceWrite[] = [];
      const businessRefs: BusinessStateReferenceWrite[] = [];
      const emitted = output[objectId];
      const metas = new Map(
        (output.output_metadata[objectId] ?? []).map((meta) => [
          meta.semantic_id,
          meta,
        ]),
      );
      const root = byPath.get(`${objectId}:$`);
      const liveItems = live.filter(
        (row) =>
          row.objectSemanticId === objectId &&
          row.componentSemanticPath !== "$" &&
          row.lifecycle === "ACTIVE" &&
          row.currentComponentGeneration.valueState === "VALUE",
      );

      const add = (
        path: string,
        value: unknown,
        meta: CharacterItemMetadata | null,
        nodeKind: IntelligenceNodeKind,
        readiness: IntelligenceReadiness,
      ) => {
        if (!characterScopeAllows(prepared.activeScope, objectId, path))
          characterInvalid("PERSISTENCE_OUTSIDE_CHARACTER_SCOPE");
        const addr = address(objectId, path);
        const prior = byPath.get(stateKey(addr));
        const state =
          value === null
            ? IntelligenceValueState.EXPLICIT_NULL
            : IntelligenceValueState.VALUE;
        const valueHash = sha256CanonicalExecution(
          value === null ? { valueState: state } : value,
        );
        const normalizedMeta = meta
          ? { ...meta, evidence_refs: [...meta.evidence_refs].sort() }
          : {};
        const authority: IntelligenceAuthority =
          meta?.authority ?? IntelligenceAuthority.SYSTEM_DERIVED;
        const freshness = meta?.freshness ?? IntelligenceFreshness.CURRENT;
        if (
          this.unchanged(
            prior,
            valueHash,
            normalizedMeta,
            authority,
            readiness,
            freshness,
          )
        )
          return;
        const protectedCurrent =
          prior !== undefined && prior.protectionState !== "UNPROTECTED";
        const id = uuid(`${execution.id}:${objectId}:${path}`);
        generationIds.set(stateKey(addr), id);
        components.push({
          id,
          componentSemanticPath: path,
          pathSchemeVersion: 1,
          nodeKind,
          componentContractId: objectId,
          componentContractVersion: "1.0",
          valueState: state,
          valuePayload:
            value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue),
          valueHash,
          authority,
          sourceClass: meta?.source_class ?? "SYSTEM_DERIVATION_INPUT",
          readiness,
          freshnessAtGeneration: freshness,
          metadataPayload: normalizedMeta as Prisma.InputJsonValue,
          supersedesComponentGenerationId:
            prior && !protectedCurrent
              ? prior.currentComponentGenerationId
              : null,
        });
        for (const ref of meta?.evidence_refs ?? []) {
          const item = evidence.get(ref);
          if (!item) characterInvalid("PERSISTENCE_UNKNOWN_EVIDENCE_REFERENCE");
          evidenceRefs.push({
            id: uuid(`${id}:evidence:${ref}`),
            componentSemanticPath: path,
            evidenceRef: ref,
            capabilityId: item.capabilityId,
            captureId: item.captureRef,
            captureVersion: item.captureVersion,
            sourceClass: item.sourceClass,
            capturedAt: new Date(item.capturedAt),
            observedFreshness: item.freshness.state,
            evidenceManifestRef: execution.id,
            evidenceManifestHash: execution.evidenceManifestHash,
          });
        }
        for (const entry of prepared.canonicalState.entries) {
          const ref = entry.businessStateReference;
          businessRefs.push({
            id: uuid(`${id}:business:${entry.semantic}:${ref.revisionToken}`),
            componentSemanticPath: path,
            entityType: ref.entityType,
            entityId: ref.entityId,
            semanticFieldPath: ref.semanticFieldPath,
            revisionKind: ref.revisionKind,
            revisionToken: ref.revisionToken,
            observedAt: new Date(ref.observedAt),
            canonicalSnapshotRef: ref.canonicalSnapshotRef,
          });
        }
        snapshots.push({
          ...addr,
          exists: !!prior,
          generationId: prior?.currentComponentGenerationId,
          revision: prior?.revision,
          authority: prior?.currentAuthority,
          protected: protectedCurrent,
        });
        proposals.push({
          ...addr,
          disposition: protectedCurrent ? "CREATE_CANDIDATE" : "APPLY_CURRENT",
          authority,
          expectedCurrent: prior
            ? {
                state: "PRESENT",
                generationId: prior.currentComponentGenerationId,
                revision: prior.revision,
              }
            : { state: "ABSENT" },
          basisGenerationId: protectedCurrent
            ? prior?.currentComponentGenerationId
            : undefined,
          basisRevision: protectedCurrent ? prior?.revision : undefined,
          evidenceRefs: meta?.evidence_refs ?? [],
          businessStateRefs: prepared.canonicalState.entries.map(
            (entry) => entry.businessStateReference.revisionToken,
          ),
        });
      };

      // Materialization anchor stores structure only, never an aggregate copy of item truth.
      // No automatic removal rule exists in character reasoning/output: null/omission preserves
      // prior membership. Only a first evaluated null becomes an EXPLICIT_NULL root.
      if (
        prepared.activeScope.some(
          (a) =>
            a.objectSemanticId === objectId && a.componentSemanticPath === "$",
        )
      ) {
        if (
          !root ||
          (emitted?.length &&
            root.currentComponentGeneration.valueState !== "VALUE")
        ) {
          add(
            "$",
            emitted === null && !liveItems.length ? null : [],
            null,
            IntelligenceNodeKind.COLLECTION,
            emitted?.length || liveItems.length
              ? IntelligenceReadiness.READY
              : IntelligenceReadiness.NOT_READY,
          );
        } else if (emitted?.length && root.currentReadiness !== "READY") {
          add(
            "$",
            [],
            null,
            IntelligenceNodeKind.COLLECTION,
            IntelligenceReadiness.READY,
          );
        }
      } else if (!root && emitted?.length)
        characterInvalid("CHARACTER_COLLECTION_NOT_MATERIALIZED");
      for (const item of [...(emitted ?? [])].sort((a, b) =>
        a.semantic_id.localeCompare(b.semantic_id),
      )) {
        const meta = metas.get(item.semantic_id);
        if (!meta) characterInvalid("PERSISTENCE_ITEM_METADATA_MISSING");
        add(
          itemPath(item.semantic_id),
          item,
          meta,
          IntelligenceNodeKind.SEMANTIC_ITEM,
          IntelligenceReadiness.READY,
        );
      }
      if (!components.length) continue;
      const objectProposals = proposals.filter(
        (proposal) => proposal.objectSemanticId === objectId,
      );
      const validation = this.validator.validate({
        registryKey: prepared.registryKey,
        activeScope: objectProposals,
        currentState: snapshots,
        proposals: objectProposals,
      });
      if (!validation.valid)
        characterInvalid(
          `PERSISTENCE_${validation.issues[0]?.code ?? "INVALID_TRANSITION"}`,
        );
      const objectValue =
        emitted === null
          ? null
          : [...emitted].sort((a, b) =>
              a.semantic_id.localeCompare(b.semantic_id),
            );
      await this.generations.persistInTransaction(tx, {
        object: {
          id: uuid(`${execution.id}:${objectId}`),
          brandId: execution.brandId,
          objectSemanticId: objectId,
          objectContractId: "objects",
          objectContractVersion: "1.0",
          outputContractId: execution.outputContractId,
          outputContractVersion: execution.outputContractVersion,
          producerKind: "PROCESSOR_OUTPUT",
          producerId: execution.processorId,
          producerVersion: execution.processorVersion,
          bundleId: execution.bundleId,
          bundleVersion: execution.bundleVersion,
          bundleHash: execution.bundleHash,
          processorExecutionId: execution.id,
          successfulAttemptId: claim.attempt.id,
          valueState: emitted === null ? "EXPLICIT_NULL" : "VALUE",
          valuePayload:
            objectValue === null
              ? Prisma.JsonNull
              : (objectValue as unknown as Prisma.InputJsonValue),
          valueHash: sha256CanonicalExecution(objectValue),
          objectMetadataPayload:
            output.output_metadata[objectId] === null
              ? Prisma.JsonNull
              : ([...(output.output_metadata[objectId] ?? [])].sort((a, b) =>
                  a.semantic_id.localeCompare(b.semantic_id),
                ) as unknown as Prisma.InputJsonValue),
          readiness: emitted?.length ? "READY" : "NOT_READY",
          freshnessAtGeneration: "CURRENT",
          activeScope: canonicalActiveScope(
            objectProposals,
          ) as unknown as Prisma.InputJsonValue,
          activeScopeHash: sha256CanonicalExecution(
            canonicalActiveScope(objectProposals),
          ),
        },
        components,
        evidenceReferences: evidenceRefs,
        businessStateReferences: businessRefs,
      });
    }
    if (!proposals.length) return;
    const transition = await this.transitions.transitionInTransaction(tx, {
      action: {
        id: uuid(`${execution.id}:success-transition`),
        brandId: execution.brandId,
        actionType: "PROCESSOR_GENERATION_APPLY",
        actorType: "PROCESSOR",
        actorRef: execution.processorId,
        requestIdempotencyKey: execution.processorExecutionKey,
        correlationRef: execution.executionId,
        reasonCode: "VALIDATED_CHARACTER_ITEMS",
        processorExecutionId: execution.id,
      },
      decisions: proposals.map((proposal) => ({
        kind: "APPLY_GENERATION" as const,
        brandId: proposal.brandId,
        objectSemanticId: proposal.objectSemanticId,
        componentSemanticPath: proposal.componentSemanticPath,
        pathSchemeVersion: 1,
        expectedCurrent: proposal.expectedCurrent,
        generationId: generationIds.get(stateKey(proposal))!,
        discrepancyCode: "PROTECTED_VALUE_CONFLICT",
      })),
    });
    const accepted = new Set<IntelligenceComponentTransitionOutcome>([
      "APPLIED_CURRENT",
      "RECORDED_CANDIDATE",
      "NOOP_EQUIVALENT",
    ]);
    if (transition.outcomes.some((outcome) => !accepted.has(outcome.outcome)))
      characterInvalid("PERSISTENCE_TRANSITION_REJECTED");
  }

  private unchanged(
    prior: CharacterCurrentState | undefined,
    hash: string,
    metadata: unknown,
    authority: IntelligenceAuthority,
    readiness: IntelligenceReadiness,
    freshness: IntelligenceFreshness,
  ): boolean {
    if (
      !prior ||
      prior.lifecycle !== "ACTIVE" ||
      prior.currentComponentGeneration.valueHash !== hash
    )
      return false;
    if (prior.protectionState !== "UNPROTECTED") return true;
    return (
      prior.currentAuthority === authority &&
      prior.currentReadiness === readiness &&
      prior.currentFreshness === freshness &&
      canonicalJson(prior.currentComponentGeneration.metadataPayload) ===
        canonicalJson(metadata)
    );
  }
}
