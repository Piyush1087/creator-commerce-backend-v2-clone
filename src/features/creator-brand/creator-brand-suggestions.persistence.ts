import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canonicalJson } from "../brand-intelligence/contracts/bundle/canonical-json";
import { ContractRuntimeRegistry } from "../brand-intelligence/contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../brand-intelligence/contracts/validation/persistence-transition.validator";
import { SemanticValidator } from "../brand-intelligence/contracts/validation/semantic.validator";
import { StructuralValidator } from "../brand-intelligence/contracts/validation/structural.validator";
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "../brand-intelligence/execution/domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "../brand-intelligence/execution/executor/processor-executor";
import type { ProcessorSuccessPersistenceHook } from "../brand-intelligence/execution/processor-persistence.hook";
import { IntelligenceCurrentStateRepository } from "../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../brand-intelligence/persistence/intelligence-generation.repository";
import { IntelligenceTransitionService } from "../brand-intelligence/transitions/intelligence-transition.service";
import {
  CREATOR_BRAND_COMPONENT_PATHS,
  CREATOR_BRAND_REGISTRY_KEY,
} from "./creator-brand-runtime.contract";
import { CreatorBrandPersistencePayloadSchema } from "./creator-brand-suggestions.processor";
import { CreatorBrandContentSourceAdapter } from "./creator-brand-content-source.adapter";
import type { CreatorWorkspaceActorContext } from "../../shared/creator/creator-workspace-actor.contract";

@Injectable()
export class CreatorBrandSuggestionsPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly current: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly persistenceValidator: PersistenceTransitionValidator,
    private readonly structuralValidator: StructuralValidator,
    private readonly semanticValidator: SemanticValidator,
    private readonly contracts: ContractRuntimeRegistry,
    private readonly sourceAdapter: CreatorBrandContentSourceAdapter,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    const payload = CreatorBrandPersistencePayloadSchema.safeParse(
      result.persistencePayload,
    );
    if (!payload.success) this.fail("INVALID_PAYLOAD");
    const verified = this.contracts.getVerifiedBundle(
      CREATOR_BRAND_REGISTRY_KEY,
    );
    const execution = claim.processorExecution;
    if (
      execution.processorId !== verified.manifest.processorId ||
      execution.bundleHash !== verified.manifest.bundleContentHash ||
      canonicalJson(payload.data.source) !==
        canonicalJson(execution.evidenceManifest)
    )
      this.fail("CONTRACT_OR_LINEAGE_MISMATCH");
    const source = payload.data.source;
    // Lock the existing Settings fence and current Content before re-admission.
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM creator_social_integrations WHERE id=${source.integrationId} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT current_component_id FROM intelligence_current_components WHERE owner_scope_id=${source.ownerScopeId} AND object_semantic_id='creator_content' ORDER BY component_semantic_path FOR UPDATE`,
    );
    const actor = {
      workspaceId: source.subject.creatorWorkspaceId,
      subjectCreatorProfileId: source.subject.ownerCreatorProfileId,
      subjectOwnerUserId: source.subject.ownerUserId,
    } as CreatorWorkspaceActorContext;
    const admitted = await this.sourceAdapter.readInTransaction(tx, actor);
    if (!admitted || admitted.manifestHash !== source.manifestHash)
      this.fail("SOURCE_CHANGED");
    const structural = this.structuralValidator.validate(
      verified,
      payload.data.value,
    );
    const semantic = this.semanticValidator.validate(payload.data.value, {
      bundle: verified,
      evidenceManifest: payload.data.source.evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        capabilityId: "instagram.media_insights",
        semanticId: item.evidenceRef,
        revisionIdentity: item.contentHash,
        sourceClass: "INSTAGRAM_OWNED",
        freshness: "CURRENT",
      })),
      businessStateManifest: [],
    });
    if (!structural.valid || !semantic.valid)
      this.fail(
        structural.issues[0]?.code ??
          semantic.issues[0]?.code ??
          "OUTPUT_VALIDATION_REJECTED",
      );

    const addresses = CREATOR_BRAND_COMPONENT_PATHS.map(
      (componentSemanticPath) => ({
        ownerScopeId: payload.data.source.ownerScopeId,
        subjectId: execution.subjectId,
        objectSemanticId: "creator_brand_suggestions",
        pathSchemeVersion: 1,
        componentSemanticPath,
      }),
    );
    const locked = await this.current.lockOwnerScopedInCanonicalOrder(
      tx,
      addresses,
    );
    const referenced = (path: string): string[] => {
      const family =
        payload.data.value.families[
          path.slice(4) as keyof typeof payload.data.value.families
        ];
      const refs = [
        ...new Set(
          Object.values(family).flatMap((field) =>
            field.availability === "AVAILABLE"
              ? field.support.evidenceRefs
              : [],
          ),
        ),
      ].sort();
      // Insufficient components cite the exact accepted basis, not a fabricated candidate.
      return refs.length
        ? refs
        : payload.data.source.evidence.map((item) => item.evidenceRef).sort();
    };
    const validation = this.persistenceValidator.validate({
      registryKey: CREATOR_BRAND_REGISTRY_KEY,
      activeScope: addresses,
      currentState: addresses.map((address) => {
        const prior = locked.get(this.current.ownerScopedKey(address));
        return prior
          ? {
              ...address,
              exists: true as const,
              generationId: prior.currentComponentGenerationId,
              revision: prior.revision,
              authority: prior.currentAuthority,
              protected: prior.protectionState !== "UNPROTECTED",
            }
          : { ...address, exists: false as const, protected: false };
      }),
      proposals: addresses.map((address) => {
        const prior = locked.get(this.current.ownerScopedKey(address));
        return {
          ...address,
          disposition: "APPLY_CURRENT" as const,
          authority: "CREATOR_SHOP_DERIVED",
          expectedCurrent: prior
            ? {
                state: "PRESENT" as const,
                generationId: prior.currentComponentGenerationId,
                revision: prior.revision,
              }
            : { state: "ABSENT" as const },
          evidenceRefs: referenced(address.componentSemanticPath),
          businessStateRefs: [],
        };
      }),
    });
    if (!validation.valid)
      this.fail(validation.issues[0]?.code ?? "PERSISTENCE_REJECTED");
    const objectId = stableUuid(`${execution.id}:creator-brand-object`);
    const componentIds = new Map(
      addresses.map((address) => [
        address.componentSemanticPath,
        stableUuid(`${execution.id}:${address.componentSemanticPath}`),
      ]),
    );
    const readiness = "PARTIAL";
    await this.generations.persistOwnerScopedInTransaction(tx, {
      ownerScopeId: payload.data.source.ownerScopeId,
      subjectId: execution.subjectId,
      object: {
        id: objectId,
        objectSemanticId: "creator_brand_suggestions",
        objectContractId: "creator_brand_suggestions",
        objectContractVersion: "1.0",
        outputContractId: execution.outputContractId,
        outputContractVersion: execution.outputContractVersion,
        producerId: execution.processorId,
        producerVersion: execution.processorVersion,
        bundleId: execution.bundleId,
        bundleVersion: execution.bundleVersion,
        bundleHash: execution.bundleHash,
        processorExecutionId: execution.id,
        successfulAttemptId: claim.attempt.id,
        valuePayload: payload.data.value as unknown as Prisma.InputJsonValue,
        valueHash: hash(canonicalJson(payload.data.value)),
        metadataPayload: {
          sourceScope: "INSTAGRAM_OWNED",
          integrationId: payload.data.source.integrationId,
          providerAccountId: payload.data.source.providerAccountId,
          authorizationGeneration: payload.data.source.authorizationGeneration,
          requestIdentity: payload.data.source.manifestHash,
          captureRef: payload.data.source.captureRef,
          sourceContentGenerationId: payload.data.source.objectGenerationId,
        },
        readiness,
        activeScope: addresses as unknown as Prisma.InputJsonValue,
        activeScopeHash: execution.activeScopeHash,
      },
      components: addresses.map((address, order) => {
        const value =
          payload.data.value.families[
            address.componentSemanticPath.slice(
              4,
            ) as keyof typeof payload.data.value.families
          ];
        return {
          id: componentIds.get(address.componentSemanticPath)!,
          path: address.componentSemanticPath,
          contractId: `creator_brand_suggestions.${address.componentSemanticPath.slice(4)}`,
          contractVersion: "1.0",
          valuePayload: value as Prisma.InputJsonValue,
          valueHash: hash(canonicalJson(value)),
          readiness,
          metadataPayload: {
            sourceScope: "INSTAGRAM_OWNED",
            evidenceRefs: referenced(address.componentSemanticPath),
          },
          order,
        };
      }),
      evidence: addresses.flatMap((address) =>
        payload.data.source.evidence
          .filter((item) =>
            referenced(address.componentSemanticPath).includes(
              item.evidenceRef,
            ),
          )
          .map((item) => ({
            id: stableUuid(
              `${execution.id}:${address.componentSemanticPath}:${item.evidenceRef}`,
            ),
            componentPath: address.componentSemanticPath,
            evidenceRef: item.evidenceRef,
            capabilityId: "instagram.media_insights",
            captureRef: payload.data.source.captureRef,
            capturedAt: new Date(item.capturedAt),
            manifestRef: execution.executionId,
            manifestHash: execution.evidenceManifestHash,
          })),
      ),
    });
    const outcomes = await this.transitions.applyOwnerScopedInTransaction(tx, {
      ownerScopeId: payload.data.source.ownerScopeId,
      actionId: stableUuid(`${execution.id}:creator-brand-transition`),
      subjectId: execution.subjectId,
      processorExecutionId: execution.id,
      requestIdempotencyKey: execution.processorExecutionKey,
      correlationRef: execution.executionId,
      actorRef: execution.processorId,
      decisions: addresses.map((address) => ({
        address,
        generationId: componentIds.get(address.componentSemanticPath)!,
        expected: locked.get(this.current.ownerScopedKey(address)) ?? null,
      })),
    });
    if (outcomes.some((outcome) => outcome !== "APPLIED_CURRENT"))
      this.fail("CURRENT_TRANSITION_REJECTED");
  }

  private fail(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code: `CREATOR_BRAND_${code}`,
    });
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function stableUuid(material: string): string {
  const chars = hash(material).slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
