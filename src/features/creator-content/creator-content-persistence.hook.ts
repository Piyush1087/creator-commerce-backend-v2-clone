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
  CREATOR_CONTENT_COMPONENT_PATHS,
  CREATOR_CONTENT_REGISTRY_KEY,
  CreatorContentEvidenceManifestSchema,
  CreatorContentPersistencePayloadSchema,
  creatorContentComponentValue,
} from "./creator-content-runtime.contract";

@Injectable()
export class CreatorContentPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly current: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly persistenceValidator: PersistenceTransitionValidator,
    private readonly structuralValidator: StructuralValidator,
    private readonly semanticValidator: SemanticValidator,
    private readonly contracts: ContractRuntimeRegistry,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    const payload = CreatorContentPersistencePayloadSchema.safeParse(
      result.persistencePayload,
    );
    const manifest = CreatorContentEvidenceManifestSchema.safeParse(
      claim.processorExecution.evidenceManifest,
    );
    if (!payload.success || !manifest.success) this.fail("INVALID_PAYLOAD");
    const verified = this.contracts.getVerifiedBundle(
      CREATOR_CONTENT_REGISTRY_KEY,
    );
    const execution = claim.processorExecution;
    if (
      execution.processorId !== verified.manifest.processorId ||
      execution.bundleHash !== verified.manifest.bundleContentHash ||
      canonicalJson(payload.data.identity) !==
        canonicalJson(manifest.data.identity) ||
      canonicalJson(payload.data.evidence) !==
        canonicalJson(manifest.data.evidence)
    )
      this.fail("CONTRACT_OR_LINEAGE_MISMATCH");
    await this.assertCurrentIntegration(tx, payload.data.identity);
    const structural = this.structuralValidator.validate(
      verified,
      payload.data.value,
    );
    const semantic = this.semanticValidator.validate(payload.data.value, {
      bundle: verified,
      evidenceManifest: payload.data.evidence.map((item) => ({
        evidenceRef: item.evidenceRef,
        capabilityId: "instagram.media_insights",
        semanticId: item.providerMediaId,
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

    const addresses = CREATOR_CONTENT_COMPONENT_PATHS.map(
      (componentSemanticPath) => ({
        ownerScopeId: payload.data.identity.ownerScopeId,
        subjectId: execution.subjectId,
        objectSemanticId: "creator_content",
        pathSchemeVersion: 1,
        componentSemanticPath,
      }),
    );
    const locked = await this.current.lockOwnerScopedInCanonicalOrder(
      tx,
      addresses,
    );
    const allRefs = payload.data.evidence.map((item) => item.evidenceRef);
    const referenced = (path: string): string[] => {
      if (path === "$/f/content_highlights")
        return [
          ...new Set(
            payload.data.value.highlights.flatMap((item) => item.evidenceRefs),
          ),
        ].sort();
      if (
        path === "$/f/representative_content" &&
        payload.data.value.representatives.length > 0
      )
        return [
          ...new Set(
            payload.data.value.representatives.flatMap(
              (item) => item.evidenceRefs,
            ),
          ),
        ].sort();
      return [...allRefs].sort();
    };
    const validation = this.persistenceValidator.validate({
      registryKey: CREATOR_CONTENT_REGISTRY_KEY,
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
    const objectId = stableUuid(`${execution.id}:creator-content-object`);
    const componentIds = new Map(
      addresses.map((address) => [
        address.componentSemanticPath,
        stableUuid(`${execution.id}:${address.componentSemanticPath}`),
      ]),
    );
    const readiness =
      payload.data.value.status === "READY" ? "READY" : "PARTIAL";
    await this.generations.persistOwnerScopedInTransaction(tx, {
      ownerScopeId: payload.data.identity.ownerScopeId,
      subjectId: execution.subjectId,
      object: {
        id: objectId,
        objectSemanticId: "creator_content",
        objectContractId: "creator_content",
        objectContractVersion: "creator_content_v0.1",
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
          integrationId: payload.data.identity.integrationId,
          providerAccountId: payload.data.identity.providerAccountId,
          authorizationGeneration:
            payload.data.identity.authorizationGeneration,
          requestIdentity: payload.data.identity.requestIdentity,
          captureRef: payload.data.identity.captureRef,
        },
        readiness,
        activeScope: addresses as unknown as Prisma.InputJsonValue,
        activeScopeHash: execution.activeScopeHash,
      },
      components: addresses.map((address, order) => {
        const value = creatorContentComponentValue(
          payload.data.value,
          address.componentSemanticPath,
        );
        return {
          id: componentIds.get(address.componentSemanticPath)!,
          path: address.componentSemanticPath,
          contractId: `creator_content.${address.componentSemanticPath.slice(4)}`,
          contractVersion: "creator_content_v0.1",
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
        payload.data.evidence
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
            captureRef: payload.data.identity.captureRef,
            capturedAt: new Date(item.capturedAt),
            manifestRef: execution.executionId,
            manifestHash: execution.evidenceManifestHash,
          })),
      ),
    });
    const outcomes = await this.transitions.applyOwnerScopedInTransaction(tx, {
      ownerScopeId: payload.data.identity.ownerScopeId,
      actionId: stableUuid(`${execution.id}:creator-content-transition`),
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

  private async assertCurrentIntegration(
    tx: Prisma.TransactionClient,
    identity: {
      creatorProfileId: string;
      integrationId: string;
      providerAccountId: string;
      authorizationGeneration: number;
    },
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ valid: boolean }>>(
      Prisma.sql`SELECT (creator_profile_id=${identity.creatorProfileId} AND native_platform_user_id=${identity.providerAccountId} AND authorization_generation=${identity.authorizationGeneration} AND disconnected_at IS NULL AND token_state_condition='ACTIVE'::"OAuthTokenStatus" AND authorization_health='USABLE'::"ProviderAuthorizationHealth" AND basic_authorization_capability='AVAILABLE'::"ProviderCapabilityState" AND insights_capability='AVAILABLE'::"ProviderCapabilityState") AS valid FROM creator_social_integrations WHERE id=${identity.integrationId} FOR UPDATE`,
    );
    if (rows[0]?.valid !== true) this.fail("AUTHORIZATION_FENCE_REJECTED");
  }
  private fail(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code: `CREATOR_CONTENT_${code}`,
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
