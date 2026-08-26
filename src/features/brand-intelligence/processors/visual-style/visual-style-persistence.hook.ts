import { createHash } from "node:crypto";
import {
  visualStyleBusinessRef,
  visualStyleBusinessEntries,
  lockVisualCanonicalBasis,
} from "./visual-style-business-refs";
import { BrandVisualStateService } from "../../../brand-canonical-state/brand-visual-state.service";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { canonicalJson } from "../../contracts/bundle/canonical-json";
import { PersistenceTransitionValidator } from "../../contracts/validation/persistence-transition.validator";
import type {
  CurrentComponentSnapshot,
  ProposedComponentTransition,
} from "../../contracts/validation/validation.types";
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
import { IntelligenceTransitionService } from "../../transitions/intelligence-transition.service";
import {
  visualStyleFingerprint,
  visualStyleInvalid,
} from "./visual-style-identity";
import {
  visualStyleComponentPlan,
  visualStyleOutputReadiness,
} from "./visual-style-plan";
import { VisualStyleStateRepository } from "./visual-style-state.repository";
import {
  VISUAL_STYLE_OBJECT,
  type VisualStylePersistencePayload,
} from "./visual-style.types";

function uuid(material: string): string {
  const chars = createHash("sha256")
    .update(material)
    .digest("hex")
    .slice(0, 32)
    .split("");
  chars[12] = "5";
  chars[16] = ((parseInt(chars[16], 16) & 3) | 8).toString(16);
  const h = chars.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(canonicalJson(value)) as Prisma.InputJsonValue;

/** W1.0D owns the transaction/live lease. Only frozen visualStyle paths are mapped here. */
@Injectable()
export class VisualStylePersistenceHook implements ProcessorSuccessPersistenceHook {
  constructor(
    private readonly generations: IntelligenceGenerationRepository,
    private readonly currentState: IntelligenceCurrentStateRepository,
    private readonly transitions: IntelligenceTransitionService,
    private readonly validator: PersistenceTransitionValidator,
    private readonly catalogue: VisualStyleStateRepository,
    private readonly visuals: BrandVisualStateService,
  ) {}

  async persistBeforeCompletion(
    tx: Prisma.TransactionClient,
    claim: ClaimedProcessorWork,
    result: ProcessorExecutionResult,
  ): Promise<void> {
    const raw = result.persistencePayload;
    if (
      claim.processorExecution.processorId !== "visual_style_synthesis" ||
      !raw ||
      typeof raw !== "object" ||
      (raw as { kind?: unknown }).kind !== "VISUAL_STYLE_V1"
    )
      visualStyleInvalid("VISUAL_STYLE_INVALID_PERSISTENCE_PAYLOAD");
    const {
      output,
      prepared,
      current: before,
    } = raw as VisualStylePersistencePayload;
    const execution = claim.processorExecution;
    if (
      prepared.brandId !== execution.brandId ||
      prepared.canonicalState.brandId !== execution.brandId ||
      prepared.evidence.brandId !== execution.brandId ||
      prepared.activeScope.some(
        (a) =>
          a.brandId !== execution.brandId ||
          a.objectSemanticId !== VISUAL_STYLE_OBJECT,
      ) ||
      sha256CanonicalExecution(canonicalActiveScope(prepared.activeScope)) !==
        execution.activeScopeHash ||
      prepared.dependencyManifestHash !== execution.dependencyManifestHash ||
      prepared.evidenceManifestHash !== execution.evidenceManifestHash
    )
      visualStyleInvalid("VISUAL_STYLE_PERSISTENCE_BASIS_MISMATCH");
    const address = (path: string) => ({
      brandId: execution.brandId,
      objectSemanticId: VISUAL_STYLE_OBJECT,
      pathSchemeVersion: 1,
      componentSemanticPath: path,
    });
    await lockVisualCanonicalBasis(tx, prepared.canonicalState, this.visuals);
    const planned = visualStyleComponentPlan(
      output,
      before,
      prepared.activeScope,
    );
    const paths = [
      ...new Set([
        "$",
        ...before.map((r) => r.componentSemanticPath),
        ...planned.map((p) => p.path),
      ]),
    ];
    await this.currentState.lockInCanonicalOrder(tx, paths.map(address));
    const live = await this.catalogue.read(execution.brandId, tx);
    if (visualStyleFingerprint(live) !== visualStyleFingerprint(before))
      throw new ProcessorExecutorFailure({
        category: "RETRYABLE_TECHNICAL",
        code: "VISUAL_STYLE_CURRENT_BASIS_CHANGED",
      });
    const plans = visualStyleComponentPlan(output, live, prepared.activeScope);
    const byPath = new Map(live.map((r) => [r.componentSemanticPath, r]));
    const evidence = new Map(
      prepared.evidence.capabilityResults.flatMap((c) =>
        c.evidence.map((e) => [e.evidenceRef, e] as const),
      ),
    );
    const components: ComponentGenerationWrite[] = [];
    const evidenceReferences: EvidenceReferenceWrite[] = [];
    const businessStateReferences: BusinessStateReferenceWrite[] = [];
    const proposals: ProposedComponentTransition[] = [];
    const snapshots: CurrentComponentSnapshot[] = [];
    const generationIds = new Map<string, string>();
    for (const plan of plans) {
      const prior = byPath.get(plan.path);
      const protectedCurrent =
        prior !== undefined && prior.protectionState !== "UNPROTECTED";
      const valueState = plan.value === null ? "EXPLICIT_NULL" : "VALUE";
      const valueHash = sha256CanonicalExecution(
        plan.value === null ? { valueState } : plan.value,
      );
      const meta = plan.metadata
        ? {
            ...plan.metadata,
            evidence_refs: [...plan.metadata.evidence_refs].sort(),
          }
        : {};
      const authority = plan.metadata?.authority ?? "SYSTEM_DERIVED";
      const freshness = plan.metadata?.freshness ?? "CURRENT";
      if (
        plan.apply &&
        prior?.lifecycle === "ACTIVE" &&
        prior.currentComponentGeneration.valueHash === valueHash &&
        (protectedCurrent ||
          (prior.currentAuthority === authority &&
            prior.currentFreshness === freshness &&
            prior.currentReadiness === plan.readiness &&
            canonicalJson(prior.currentComponentGeneration.metadataPayload) ===
              canonicalJson(meta)))
      )
        continue;
      const id = uuid(`${execution.id}:${plan.path}`);
      generationIds.set(plan.path, id);
      components.push({
        id,
        componentSemanticPath: plan.path,
        pathSchemeVersion: 1,
        nodeKind: plan.nodeKind,
        componentContractId: VISUAL_STYLE_OBJECT,
        componentContractVersion: "1.0",
        valueState,
        valuePayload: plan.value === null ? Prisma.JsonNull : json(plan.value),
        valueHash,
        authority,
        sourceClass: plan.metadata?.source_class ?? "SYSTEM_DERIVATION_INPUT",
        readiness: plan.readiness,
        freshnessAtGeneration: freshness,
        metadataPayload: json(meta),
        supersedesComponentGenerationId:
          prior && !protectedCurrent && plan.apply
            ? prior.currentComponentGenerationId
            : null,
      });
      for (const ref of plan.metadata?.evidence_refs ?? []) {
        const item = evidence.get(ref);
        if (!item || item.brandId !== execution.brandId)
          visualStyleInvalid("VISUAL_STYLE_UNKNOWN_EVIDENCE_REF");
        evidenceReferences.push({
          id: uuid(`${id}:evidence:${ref}`),
          componentSemanticPath: plan.path,
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
      for (const entry of visualStyleBusinessEntries(prepared.canonicalState)) {
        if (
          entry.semantic.startsWith("visual:") &&
          !plan.metadata?.business_state_refs?.includes(
            visualStyleBusinessRef(
              entry.semantic,
              entry.businessStateReference,
            ),
          )
        )
          continue;
        const ref = entry.businessStateReference;
        businessStateReferences.push({
          id: uuid(`${id}:business:${entry.semantic}:${ref.revisionToken}`),
          componentSemanticPath: plan.path,
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
        ...address(plan.path),
        exists: !!prior,
        generationId: prior?.currentComponentGenerationId,
        revision: prior?.revision,
        authority: prior?.currentAuthority,
        protected: protectedCurrent,
      });
      proposals.push({
        ...address(plan.path),
        disposition: !plan.apply
          ? "NO_CHANGE"
          : protectedCurrent
            ? "CREATE_CANDIDATE"
            : "APPLY_CURRENT",
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
        evidenceRefs: plan.metadata?.evidence_refs ?? [],
        businessStateRefs: prepared.canonicalState.entries.map(
          (e) => e.businessStateReference.revisionToken,
        ),
      });
    }
    if (!components.length) return;
    const validation = this.validator.validate({
      registryKey: prepared.registryKey,
      activeScope: proposals,
      currentState: snapshots,
      proposals,
    });
    if (!validation.valid)
      visualStyleInvalid(
        `VISUAL_STYLE_PERSISTENCE_${validation.issues[0]?.code}`,
      );
    await this.generations.persistInTransaction(tx, {
      object: {
        id: uuid(`${execution.id}:${VISUAL_STYLE_OBJECT}`),
        brandId: execution.brandId,
        objectSemanticId: VISUAL_STYLE_OBJECT,
        objectContractId: "visual_identity_objects",
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
        valueState:
          output.visual_style_profile === null ? "EXPLICIT_NULL" : "VALUE",
        valuePayload:
          output.visual_style_profile === null
            ? Prisma.JsonNull
            : json(output.visual_style_profile),
        valueHash: sha256CanonicalExecution(output.visual_style_profile),
        objectMetadataPayload: json({
          output_metadata: output.output_metadata,
          reconciliationBasis: live.map((r) => ({
            path: r.componentSemanticPath,
            generationId: r.currentComponentGenerationId,
            revision: r.revision.toString(),
          })),
          heldPaths: proposals
            .filter((p) => p.disposition === "NO_CHANGE")
            .map((p) => p.componentSemanticPath),
        }),
        readiness: visualStyleOutputReadiness(output),
        freshnessAtGeneration: "CURRENT",
        activeScope: json(canonicalActiveScope(proposals)),
        activeScopeHash: sha256CanonicalExecution(
          canonicalActiveScope(proposals),
        ),
      },
      components,
      evidenceReferences,
      businessStateReferences,
    });
    const applicable = proposals.filter((p) => p.disposition !== "NO_CHANGE");
    if (!applicable.length) return;
    const applied = await this.transitions.transitionInTransaction(tx, {
      action: {
        id: uuid(`${execution.id}:visualStyle-transition`),
        brandId: execution.brandId,
        actionType: "PROCESSOR_GENERATION_APPLY",
        actorType: "PROCESSOR",
        actorRef: execution.processorId,
        requestIdempotencyKey: execution.processorExecutionKey,
        correlationRef: execution.executionId,
        reasonCode: "VALIDATED_VISUAL_STYLE_RECONCILIATION",
        processorExecutionId: execution.id,
      },
      decisions: applicable.map((p) => ({
        ...address(p.componentSemanticPath),
        kind: "APPLY_GENERATION",
        expectedCurrent: p.expectedCurrent,
        generationId: generationIds.get(p.componentSemanticPath)!,
        discrepancyCode: "PROTECTED_VISUAL_STYLE_CONFLICT",
      })),
    });
    if (
      applied.outcomes.some(
        (o) =>
          ![
            "APPLIED_CURRENT",
            "RECORDED_CANDIDATE",
            "NOOP_EQUIVALENT",
          ].includes(o.outcome),
      )
    )
      visualStyleInvalid("VISUAL_STYLE_TRANSITION_REJECTED");
  }
}
