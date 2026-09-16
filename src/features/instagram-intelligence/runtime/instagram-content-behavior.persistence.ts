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

import { canonicalJson } from "../../brand-intelligence/contracts/bundle/canonical-json";
import { ContractRuntimeRegistry } from "../../brand-intelligence/contracts/registry/contract-runtime.registry";
import { PersistenceTransitionValidator } from "../../brand-intelligence/contracts/validation/persistence-transition.validator";
import type { ProcessorSuccessPersistenceHook } from "../../brand-intelligence/execution/processor-persistence.hook";
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "../../brand-intelligence/execution/domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "../../brand-intelligence/execution/executor/processor-executor";
import { IntelligenceCurrentStateRepository } from "../../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../../brand-intelligence/persistence/intelligence-generation.repository";
import type { ComponentSemanticAddress } from "../../brand-intelligence/semantic-path/component-path.types";
import { IntelligenceTransitionService } from "../../brand-intelligence/transitions/intelligence-transition.service";
import {
  INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
  INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID,
  INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
  InstagramContentBehaviorEvidenceManifestSchema,
  InstagramContentBehaviorPersistencePayloadSchema,
} from "./instagram-content-behavior.contract";

function stableUuid(material: string): string {
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

@Injectable()
export class InstagramContentBehaviorPersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly current: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly validator: PersistenceTransitionValidator,
    private readonly contracts: ContractRuntimeRegistry,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    const execution = claim.processorExecution;
    if (execution.processorId !== INSTAGRAM_CONTENT_BEHAVIOR_PROCESSOR_ID) {
      this.fail("B4_WRONG_PROCESSOR_PERSISTENCE_HOOK");
    }
    const parsed = InstagramContentBehaviorPersistencePayloadSchema.safeParse(
      result.persistencePayload,
    );
    if (!parsed.success) this.fail("B4_INVALID_PERSISTENCE_PAYLOAD");
    const payload = parsed.data;
    const verifiedManifest = this.contracts.getVerifiedBundle(
      INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
    ).manifest;
    if (
      execution.bundleId !== verifiedManifest.bundleId ||
      execution.bundleVersion !== verifiedManifest.bundleVersion ||
      execution.bundleHash !== verifiedManifest.bundleContentHash ||
      payload.account.integrationId !==
        parseEvidenceManifest(execution.evidenceManifest).integrationId
    ) {
      this.fail("B4_CONTRACT_OR_LINEAGE_MISMATCH");
    }

    const address: ComponentSemanticAddress = {
      brandId: execution.brandId,
      subjectId: execution.subjectId,
      objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
      pathSchemeVersion: 1,
      componentSemanticPath: "$",
    };
    const locked = await this.current.lockInCanonicalOrder(tx, [address]);
    const prior = locked.get(this.current.key(address));
    const expectedCurrent = prior
      ? {
          state: "PRESENT" as const,
          generationId: prior.currentComponentGenerationId,
          revision: prior.revision,
        }
      : { state: "ABSENT" as const };
    const valueHash = createHash("sha256")
      .update(canonicalJson(payload.value))
      .digest("hex");
    const componentId = stableUuid(`${execution.id}:component:$`);
    const proposal = {
      ...address,
      disposition: "APPLY_CURRENT" as const,
      authority: IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      expectedCurrent,
      evidenceRefs: [payload.evidence.evidenceRef],
      businessStateRefs: [],
    };
    const validation = this.validator.validate({
      registryKey: INSTAGRAM_CONTENT_BEHAVIOR_REGISTRY_KEY,
      activeScope: [address],
      currentState: prior
        ? [
            {
              ...address,
              exists: true,
              generationId: prior.currentComponentGenerationId,
              revision: prior.revision,
              authority: prior.currentAuthority,
              protected: prior.protectionState !== "UNPROTECTED",
            },
          ]
        : [{ ...address, exists: false, protected: false }],
      proposals: [proposal],
    });
    if (!validation.valid) {
      this.fail(`B4_${validation.issues[0]?.code ?? "PERSISTENCE_REJECTED"}`);
    }

    await this.generations.persistInTransaction(tx, {
      object: {
        id: stableUuid(`${execution.id}:object`),
        brandId: execution.brandId,
        objectSemanticId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
        objectContractId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
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
        valueState: IntelligenceValueState.VALUE,
        valuePayload: payload.value as unknown as Prisma.InputJsonValue,
        valueHash,
        objectMetadataPayload: {
          sourceScope: "INSTAGRAM_OWNED",
          integrationId: payload.account.integrationId,
          providerAccountId: payload.account.providerAccountId,
          authorizationGeneration: payload.account.authorizationGeneration,
          evidenceCount: 1,
        },
        readiness: IntelligenceReadiness.PARTIAL,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        activeScope: [address] as unknown as Prisma.InputJsonValue,
        activeScopeHash: execution.activeScopeHash,
        supersedesObjectGenerationId: null,
      },
      components: [
        {
          id: componentId,
          pathSchemeVersion: 1,
          componentSemanticPath: "$",
          nodeKind: IntelligenceNodeKind.OBJECT_FIELD,
          componentContractId: INSTAGRAM_CONTENT_BEHAVIOR_OBJECT_ID,
          componentContractVersion: "1.0",
          valueState: IntelligenceValueState.VALUE,
          valuePayload: payload.value as unknown as Prisma.InputJsonValue,
          valueHash,
          authority: IntelligenceAuthority.CREATOR_SHOP_DERIVED,
          sourceClass: "INSTAGRAM_OWNED",
          readiness: IntelligenceReadiness.PARTIAL,
          freshnessAtGeneration: IntelligenceFreshness.CURRENT,
          metadataPayload: {
            sourceScope: "INSTAGRAM_OWNED",
            integrationId: payload.account.integrationId,
            providerAccountId: payload.account.providerAccountId,
            authorizationGeneration: payload.account.authorizationGeneration,
          },
          supersedesComponentGenerationId:
            prior?.protectionState === "UNPROTECTED"
              ? prior.currentComponentGenerationId
              : null,
        },
      ],
      evidenceReferences: [
        {
          id: stableUuid(
            `${execution.id}:evidence:${payload.evidence.evidenceRef}`,
          ),
          componentSemanticPath: "$",
          evidenceRef: payload.evidence.evidenceRef,
          capabilityId: payload.evidence.capabilityId,
          captureId: payload.evidence.captureRef,
          captureVersion: payload.evidence.captureVersion,
          sourceClass: "INSTAGRAM_OWNED",
          capturedAt: new Date(payload.evidence.capturedAt),
          observedFreshness: payload.evidence.observedFreshness,
          evidenceManifestRef: execution.executionId,
          evidenceManifestHash: execution.evidenceManifestHash,
        },
      ],
    });

    const transition = await this.transitions.transitionInTransaction(tx, {
      action: {
        id: stableUuid(`${execution.id}:transition`),
        brandId: execution.brandId,
        subjectId: execution.subjectId,
        actionType: "PROCESSOR_GENERATION_APPLY",
        actorType: "PROCESSOR",
        actorRef: execution.processorId,
        requestIdempotencyKey: execution.processorExecutionKey,
        correlationRef: execution.executionId,
        reasonCode: "B4_VALIDATED_INSTAGRAM_CONTENT_BEHAVIOR",
        processorExecutionId: execution.id,
      },
      decisions: [
        {
          kind: "APPLY_GENERATION",
          ...address,
          expectedCurrent,
          generationId: componentId,
          discrepancyCode: "PROTECTED_VALUE_CONFLICT",
        },
      ],
    });
    if (
      transition.outcomes.some(
        (outcome) =>
          ![
            IntelligenceComponentTransitionOutcome.APPLIED_CURRENT,
            IntelligenceComponentTransitionOutcome.NOOP_EQUIVALENT,
          ].some((accepted) => accepted === outcome.outcome),
      )
    ) {
      this.fail("B4_CURRENT_TRANSITION_REJECTED");
    }
  }

  private fail(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code,
    });
  }
}

function parseEvidenceManifest(value: Prisma.JsonValue) {
  const parsed =
    InstagramContentBehaviorEvidenceManifestSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code: "B4_INVALID_EVIDENCE_MANIFEST",
    });
  }
  return parsed.data;
}
