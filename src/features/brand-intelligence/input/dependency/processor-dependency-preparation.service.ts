import { Inject, Injectable } from "@nestjs/common";

import type { ContractRegistryKey } from "../../contracts/bundle/contract-bundle.types";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import type { ComponentSemanticAddress } from "../../semantic-path/component-path.types";
import {
  CANONICAL_BRAND_STATE_READER,
  type CanonicalBrandStateReader,
} from "../canonical-state/canonical-brand-state.port";
import {
  CanonicalStateManifestBuilder,
  type CanonicalDependencyManifest,
} from "../canonical-state/canonical-state-manifest";
import {
  EvidenceManifestBuilder,
  type EvidenceDependencyManifest,
} from "../evidence/evidence-manifest";
import {
  INTELLIGENCE_EVIDENCE_READER,
  type IntelligenceEvidenceReader,
  type NormalizedEvidenceSet,
} from "../evidence/intelligence-evidence.port";
import { ProcessorDependencyProfileRegistry } from "./processor-dependency-profile.registry";
import {
  ProcessorDependencyReadinessEvaluator,
  type ProcessorDependencyReadinessAssessment,
} from "./processor-dependency-readiness.evaluator";
import type { CanonicalBrandStateSnapshot } from "../canonical-state/canonical-brand-state.port";
import type { IntelligenceSubjectSelector } from "../../subject/intelligence-subject";

export interface ProcessorDependencyPreparationRequest {
  readonly brandId: string;
  readonly registryKey: ContractRegistryKey;
  readonly activeScope: readonly ComponentSemanticAddress[];
  readonly subject?: IntelligenceSubjectSelector;
}

export interface PreparedProcessorDependencies {
  readonly brandId: string;
  readonly registryKey: ContractRegistryKey;
  readonly activeScope: readonly ComponentSemanticAddress[];
  /** Transient canonical values for a later executor boundary. */
  readonly canonicalState: CanonicalBrandStateSnapshot;
  readonly canonicalStateManifest: CanonicalDependencyManifest;
  /** The exact manifest handed to W1.0D as dependencyManifest. */
  readonly dependencyManifest: CanonicalDependencyManifest;
  readonly dependencyManifestHash: string;
  /** Transient bounded normalized Evidence for a later executor boundary. */
  readonly evidence: NormalizedEvidenceSet;
  readonly evidenceManifest: EvidenceDependencyManifest;
  readonly evidenceManifestHash: string;
  readonly readiness: ProcessorDependencyReadinessAssessment;
  readonly dependencyEligible: boolean;
  readonly wakeUpSignals: readonly (
    | "CANONICAL_STATE_CHANGED"
    | "NEW_EVIDENCE_CAPTURE_AVAILABLE"
    | "CANONICAL_CONFLICT_RESOLVED"
  )[];
}

@Injectable()
export class ProcessorDependencyPreparationService {
  constructor(
    private readonly contracts: ContractRuntimeRegistry,
    private readonly profiles: ProcessorDependencyProfileRegistry,
    @Inject(CANONICAL_BRAND_STATE_READER)
    private readonly canonicalReader: CanonicalBrandStateReader,
    @Inject(INTELLIGENCE_EVIDENCE_READER)
    private readonly evidenceReader: IntelligenceEvidenceReader,
    private readonly canonicalManifests: CanonicalStateManifestBuilder,
    private readonly evidenceManifests: EvidenceManifestBuilder,
    private readonly readinessEvaluator: ProcessorDependencyReadinessEvaluator,
  ) {}

  async prepare(
    request: ProcessorDependencyPreparationRequest,
  ): Promise<PreparedProcessorDependencies> {
    const bundle = this.contracts.getVerifiedBundle(request.registryKey);
    const profile = this.profiles.resolve(bundle);
    const offeringRef =
      request.subject?.type === "OFFERING" ? request.subject.ref : undefined;
    if (profile.processorId === "offering_factual_synthesis" && !offeringRef) {
      throw new Error("PRODUCT_PROCESSOR_REQUIRES_EXACT_OFFERING_SUBJECT");
    }
    const canonicalState = await this.canonicalReader.read({
      brandId: request.brandId,
      requiredSemantics: profile.requiredCanonicalSemantics,
      ...(profile.includeOfferingFacts ? { includeOfferingFacts: true } : {}),
      ...(profile.includeVisualState ? { includeVisualState: true } : {}),
      ...(profile.includeServiceabilityState
        ? { includeServiceabilityState: true }
        : {}),
      ...(offeringRef
        ? { exactOfferingScope: { canonicalOfferingRef: offeringRef } }
        : {}),
    });
    const evidence = await this.evidenceReader.read({
      brandId: request.brandId,
      processorId: profile.processorId,
      processorVersion: profile.processorVersion,
      capabilityIds: profile.capabilityIds,
      ...(offeringRef
        ? { exactOfferingScope: { canonicalOfferingRef: offeringRef } }
        : {}),
    });
    const canonicalManifest = this.canonicalManifests.build(canonicalState);
    const evidenceManifest = this.evidenceManifests.build(
      evidence,
      profile.capabilityIds,
    );
    const readiness = this.readinessEvaluator.evaluate(
      profile,
      canonicalState,
      evidence,
    );
    return {
      brandId: request.brandId,
      registryKey: request.registryKey,
      activeScope: request.activeScope,
      canonicalState,
      canonicalStateManifest: canonicalManifest.manifest,
      dependencyManifest: canonicalManifest.manifest,
      dependencyManifestHash: canonicalManifest.hash,
      evidence,
      evidenceManifest: evidenceManifest.manifest,
      evidenceManifestHash: evidenceManifest.hash,
      readiness,
      dependencyEligible: readiness.readiness === "READY_TO_RUN",
      wakeUpSignals: [
        "CANONICAL_STATE_CHANGED",
        "NEW_EVIDENCE_CAPTURE_AVAILABLE",
        "CANONICAL_CONFLICT_RESOLVED",
      ],
    };
  }
}
