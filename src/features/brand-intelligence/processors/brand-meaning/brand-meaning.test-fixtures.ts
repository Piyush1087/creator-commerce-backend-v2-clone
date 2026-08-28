import { resolve } from "node:path";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { assembleCanonicalBrandStateSnapshot } from "../../input/canonical-state/m1-canonical-brand-state.adapter";
import { CanonicalStateManifestBuilder } from "../../input/canonical-state/canonical-state-manifest";
import { EvidenceManifestBuilder } from "../../input/evidence/evidence-manifest";
import type {
  NormalizedEvidenceReference,
  NormalizedEvidenceSet,
} from "../../input/evidence/intelligence-evidence.port";
import { ProcessorDependencyProfileRegistry } from "../../input/dependency/processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "../../input/dependency/processor-dependency-readiness.evaluator";
import { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import {
  BRAND_MEANING_OBJECTS,
  type BrandMeaningOutput,
} from "./brand-meaning-processor.executor";

export const registryKey = {
  processorId: "brand_meaning",
  processorVersion: "1.0",
  outputContractId: "brand_meaning_output_contract",
  outputContractVersion: "1.0",
};
export const capabilities = [
  "owned_website.brand_messaging",
  "owned_website.brand_company_context",
  "owned_website.offering_context",
] as const;
export const scope = (brandId: string) =>
  BRAND_MEANING_OBJECTS.map((objectSemanticId) => ({
    brandId,
    objectSemanticId,
    componentSemanticPath: "$",
    pathSchemeVersion: 1 as const,
  }));
export function contracts() {
  const registry = new ContractRuntimeRegistry(
    new ContractBundleIntegrityVerifier(),
    new SemanticValidator(),
  );
  registry.verifyAtRoot(
    resolve(
      process.cwd(),
      "src/features/brand-intelligence/generated/contract-bundles",
    ),
  );
  return registry;
}
export function evidenceFixture(brandId: string): NormalizedEvidenceSet {
  return {
    brandId,
    capabilityResults: capabilities.map((capabilityId) => {
      const item: NormalizedEvidenceReference = {
        brandId,
        capabilityId,
        evidenceRef: `evidence:${capabilityId}`,
        resourceRef: "resource:home",
        resourceType: "OWNED_WEB_PAGE",
        captureRef: "capture:home",
        captureVersion: "capture:home",
        sourceClass: "OWNED_WEBSITE",
        capturedAt: "2026-08-26T00:00:00.000Z",
        freshness: {
          state: "CURRENT",
          evaluatedAt: "2026-08-26T00:00:00.000Z",
          basis: "LATEST_CAPTURE",
        },
        representativeness: "PERSISTENT_BRAND_LEVEL",
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "COMPLETE",
          failureCategories: [],
          detailCodes: [],
        },
        provenance: {
          acquisitionOrNormalizationRunRef: `capability:${capabilityId}`,
          captureMethodClass: "DIRECT_FETCH",
          normalizationContractVersion: "1.0",
          parentEvidenceRefs: [],
          parentCaptureRefs: [],
        },
        deduplication: {
          itemFingerprint: capabilityId,
          repetitionCount: 1,
          supportingResourceRefs: ["resource:home"],
        },
        contentHash: "a".repeat(64),
        boundedNormalizedPayload: {
          text: "We serve independent creators with transparent brand partnerships.",
          generalization_scope: "BRAND_LEVEL_PORTFOLIO",
        },
      };
      return {
        capabilityId,
        capabilityExecutionRef: `capability:${capabilityId}`,
        normalizationContractVersion: "1.0",
        status: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: [],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: {
          state: "COMPLETE",
          failureCategories: [],
          detailCodes: [],
        },
        evidence: [item],
      };
    }),
  };
}
export function preparation(
  brandId: string,
  evidence = evidenceFixture(brandId),
) {
  return new ProcessorDependencyPreparationService(
    contracts(),
    new ProcessorDependencyProfileRegistry(),
    {
      read: async () =>
        assembleCanonicalBrandStateSnapshot(
          brandId,
          new Date("2026-08-26T00:00:00.000Z"),
          (
            ["brand_name", "website_url", "industry", "sub_industry"] as const
          ).map((semantic) => ({
            semantic,
            fieldPath: `$.${semantic}`,
            value: semantic === "sub_industry" ? null : semantic,
            authority:
              semantic === "sub_industry"
                ? "PROVISIONAL"
                : "APPLICATION_CANONICAL",
          })),
        ),
    },
    { read: async () => evidence },
    new CanonicalStateManifestBuilder(),
    new EvidenceManifestBuilder(),
    new ProcessorDependencyReadinessEvaluator(),
  );
}
export function meaningOutput(
  evidence: NormalizedEvidenceSet,
  suffix = "",
  partial = false,
): BrandMeaningOutput {
  const company = evidence.capabilityResults.find(
    (cap) => cap.capabilityId === "owned_website.brand_company_context",
  )!.evidence[0].evidenceRef;
  const message = evidence.capabilityResults.find(
    (cap) => cap.capabilityId === "owned_website.brand_messaging",
  )!.evidence[0].evidenceRef;
  const meta = (ref: string) => ({
    authority: "CREATOR_SHOP_DERIVED",
    source_class: "OWNED_WEBSITE",
    freshness: "CURRENT" as const,
    evidence_refs: [ref],
  });
  return {
    brand_description: `A creator-commerce platform serving independent brands${suffix}.`,
    positioning: partial
      ? null
      : `A partnership platform focused on independent creators${suffix}.`,
    value_proposition: `Tools for coordinating transparent brand partnerships${suffix}.`,
    output_metadata: {
      brand_description: meta(company),
      positioning: partial ? null : meta(message),
      value_proposition: meta(message),
    },
  };
}
