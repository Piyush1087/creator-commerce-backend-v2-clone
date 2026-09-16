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
import type {
  ClaimedProcessorWork,
  ProcessorExecutionResult,
} from "../../brand-intelligence/execution/domain/intelligence-execution.types";
import { ProcessorExecutorFailure } from "../../brand-intelligence/execution/executor/processor-executor";
import type { ProcessorSuccessPersistenceHook } from "../../brand-intelligence/execution/processor-persistence.hook";
import { IntelligenceCurrentStateRepository } from "../../brand-intelligence/persistence/intelligence-current-state.repository";
import { IntelligenceGenerationRepository } from "../../brand-intelligence/persistence/intelligence-generation.repository";
import type { ComponentSemanticAddress } from "../../brand-intelligence/semantic-path/component-path.types";
import { IntelligenceTransitionService } from "../../brand-intelligence/transitions/intelligence-transition.service";
import {
  InstagramC4EvidenceManifestSchema,
  InstagramC4PersistencePayloadSchema,
  instagramC4Definition,
  instagramC4Paths,
  instagramC4RegistryKey,
} from "./instagram-c4.contract";

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
export class InstagramC4PersistenceHook implements ProcessorSuccessPersistenceHook {
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
    const parsed = InstagramC4PersistencePayloadSchema.safeParse(
      result.persistencePayload,
    );
    if (!parsed.success || parsed.data.processorId !== execution.processorId)
      this.fail("C4_INVALID_PERSISTENCE_PAYLOAD");
    const payload = parsed.data;
    const definition = instagramC4Definition(payload.processorId);
    const registryKey = instagramC4RegistryKey(payload.processorId);
    const verified = this.contracts.getVerifiedBundle(registryKey).manifest;
    const input = InstagramC4EvidenceManifestSchema.safeParse(
      execution.evidenceManifest,
    );
    if (
      !input.success ||
      execution.bundleId !== verified.bundleId ||
      execution.bundleVersion !== verified.bundleVersion ||
      execution.bundleHash !== verified.bundleContentHash ||
      payload.account.integrationId !== input.data.integrationId ||
      payload.account.providerAccountId !== input.data.providerAccountId ||
      payload.account.authorizationGeneration !==
        input.data.authorizationGeneration
    )
      this.fail("C4_CONTRACT_OR_LINEAGE_MISMATCH");

    const addresses: ComponentSemanticAddress[] = instagramC4Paths(
      definition.objectId,
    ).map((componentSemanticPath) => ({
      brandId: execution.brandId,
      subjectId: execution.subjectId,
      objectSemanticId: definition.objectId,
      pathSchemeVersion: 1,
      componentSemanticPath,
    }));
    const locked = await this.current.lockInCanonicalOrder(tx, addresses);
    const expected = new Map(
      addresses.map((address) => {
        const prior = locked.get(this.current.key(address));
        return [
          address.componentSemanticPath,
          prior
            ? {
                state: "PRESENT" as const,
                generationId: prior.currentComponentGenerationId,
                revision: prior.revision,
              }
            : { state: "ABSENT" as const },
        ];
      }),
    );
    const proposals = addresses.map((address) => ({
      ...address,
      disposition: "APPLY_CURRENT" as const,
      authority: IntelligenceAuthority.CREATOR_SHOP_DERIVED,
      expectedCurrent: expected.get(address.componentSemanticPath)!,
      evidenceRefs: payload.evidence.map((item) => item.evidenceRef),
      businessStateRefs: [],
    }));
    const validation = this.validator.validate({
      registryKey,
      activeScope: addresses,
      currentState: addresses.map((address) => {
        const prior = locked.get(this.current.key(address));
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
      proposals,
    });
    if (!validation.valid)
      this.fail(`C4_${validation.issues[0]?.code ?? "PERSISTENCE_REJECTED"}`);

    const objectId = stableUuid(`${execution.id}:object`);
    const componentIds = new Map(
      addresses.map((address) => [
        address.componentSemanticPath,
        stableUuid(
          `${execution.id}:component:${address.componentSemanticPath}`,
        ),
      ]),
    );
    const valueHash = createHash("sha256")
      .update(canonicalJson(payload.value))
      .digest("hex");
    const valueFor = (componentPath: string): unknown =>
      componentPath === "$"
        ? payload.value
        : payload.value.components[
            componentPath.slice("$/f/components/f/".length)
          ];
    await this.generations.persistInTransaction(tx, {
      object: {
        id: objectId,
        brandId: execution.brandId,
        objectSemanticId: definition.objectId,
        objectContractId: definition.objectId,
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
          ...payload.account,
          evidenceCount: payload.evidence.length,
        },
        readiness: IntelligenceReadiness.PARTIAL,
        freshnessAtGeneration: IntelligenceFreshness.CURRENT,
        activeScope: addresses as unknown as Prisma.InputJsonValue,
        activeScopeHash: execution.activeScopeHash,
        supersedesObjectGenerationId: null,
      },
      components: addresses.map((address) => {
        const componentValue = valueFor(address.componentSemanticPath);
        const prior = locked.get(this.current.key(address));
        return {
          id: componentIds.get(address.componentSemanticPath)!,
          pathSchemeVersion: 1,
          componentSemanticPath: address.componentSemanticPath,
          nodeKind: IntelligenceNodeKind.OBJECT_FIELD,
          componentContractId: definition.objectId,
          componentContractVersion: "1.0",
          valueState: IntelligenceValueState.VALUE,
          valuePayload: componentValue as Prisma.InputJsonValue,
          valueHash: createHash("sha256")
            .update(canonicalJson(componentValue))
            .digest("hex"),
          authority: IntelligenceAuthority.CREATOR_SHOP_DERIVED,
          sourceClass: "INSTAGRAM_OWNED",
          readiness: IntelligenceReadiness.PARTIAL,
          freshnessAtGeneration: IntelligenceFreshness.CURRENT,
          metadataPayload: {
            sourceScope: "INSTAGRAM_OWNED",
            ...payload.account,
          },
          supersedesComponentGenerationId:
            prior?.protectionState === "UNPROTECTED"
              ? prior.currentComponentGenerationId
              : null,
        };
      }),
      evidenceReferences: addresses.flatMap((address) =>
        payload.evidence.map((item) => ({
          id: stableUuid(
            `${execution.id}:evidence:${address.componentSemanticPath}:${item.evidenceRef}`,
          ),
          componentSemanticPath: address.componentSemanticPath,
          evidenceRef: item.evidenceRef,
          capabilityId: item.capabilityId,
          captureId: item.captureRef,
          captureVersion: item.captureVersion,
          sourceClass: "INSTAGRAM_OWNED",
          capturedAt: new Date(item.capturedAt),
          observedFreshness: item.observedFreshness,
          evidenceManifestRef: execution.executionId,
          evidenceManifestHash: execution.evidenceManifestHash,
        })),
      ),
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
        reasonCode: "C4_VALIDATED_INSTAGRAM_OBJECT",
        processorExecutionId: execution.id,
      },
      decisions: addresses.map((address) => ({
        kind: "APPLY_GENERATION" as const,
        ...address,
        expectedCurrent: expected.get(address.componentSemanticPath)!,
        generationId: componentIds.get(address.componentSemanticPath)!,
        discrepancyCode: "PROTECTED_VALUE_CONFLICT",
      })),
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
      this.fail("C4_CURRENT_TRANSITION_REJECTED");
    }
  }

  private fail(code: string): never {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code,
    });
  }
}
