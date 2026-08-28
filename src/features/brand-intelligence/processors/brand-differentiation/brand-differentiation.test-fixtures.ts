import { resolve } from "node:path";
import { ContractRuntimeRegistry } from "../../contracts/registry/contract-runtime.registry";
import { ContractBundleIntegrityVerifier } from "../../contracts/bundle/contract-bundle.integrity";
import { SemanticValidator } from "../../contracts/validation/semantic.validator";
import { assembleCanonicalBrandStateSnapshot } from "../../input/canonical-state/m1-canonical-brand-state.adapter";
import { CanonicalStateManifestBuilder } from "../../input/canonical-state/canonical-state-manifest";
import { EvidenceManifestBuilder } from "../../input/evidence/evidence-manifest";
import type { NormalizedEvidenceSet } from "../../input/evidence/intelligence-evidence.port";
import { ProcessorDependencyProfileRegistry } from "../../input/dependency/processor-dependency-profile.registry";
import { ProcessorDependencyReadinessEvaluator } from "../../input/dependency/processor-dependency-readiness.evaluator";
import { ProcessorDependencyPreparationService } from "../../input/dependency/processor-dependency-preparation.service";
import {
  DIFFERENTIATION_OBJECT,
  type DifferentiationOutput,
} from "./brand-differentiation.types";

export const registryKey = {
  processorId: "brand_differentiation",
  processorVersion: "1.0",
  outputContractId: "brand_differentiation_output_contract",
  outputContractVersion: "1.0",
};
export const capabilities = [
  "owned_website.brand_company_context",
  "owned_website.brand_messaging",
  "owned_website.offering_context",
  "explicit_factual_proof_or_claim_evidence",
] as const;
export const scope = (brandId: string) => [
  {
    brandId,
    objectSemanticId: DIFFERENTIATION_OBJECT,
    componentSemanticPath: "$",
    pathSchemeVersion: 1,
  },
];
let verifiedRegistry: ContractRuntimeRegistry | undefined;
export function contracts() {
  if (verifiedRegistry) return verifiedRegistry;
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
  verifiedRegistry = registry;
  return registry;
}
export const proofPayload = (
  statement = "We manufacture tools in our own factory.",
) => ({
  evidence_semantic: "proof_or_claim_observation",
  statement,
  proof_strength: "DIRECT_FIRST_PARTY_FACT",
  proof_class: "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT",
  scope: "BRAND_LEVEL",
  subject_scope: "BRAND_LEVEL",
  authorship: "BRAND_AUTHORED",
  source_url: "https://brand.example/about",
  source_locator: "statement:1",
  page_role: "ABOUT",
  factual_referent_ref: null,
  offering_refs: [],
  claim_sensitivity: [],
  verification_status: "NOT_EXTERNALLY_VERIFIED",
});
export function evidenceFixture(brandId: string): NormalizedEvidenceSet {
  const quality = {
    state: "COMPLETE" as const,
    failureCategories: [],
    detailCodes: [],
  };
  return {
    brandId,
    capabilityResults: capabilities.map((capabilityId, index) => ({
      capabilityId,
      capabilityExecutionRef: `capability:${index}`,
      normalizationContractVersion: "1.0",
      status: "AVAILABLE",
      retryability: "NOT_APPLICABLE",
      reasonCodes: [],
      coverage: "SINGLE_RESOURCE",
      acquisitionQuality: quality,
      evidence: [
        {
          brandId,
          capabilityId,
          evidenceRef: `evidence:${index}`,
          resourceRef: "resource:company",
          resourceType: "OWNED_WEB_PAGE",
          captureRef: `capture:${index}`,
          captureVersion: `capture:${index}`,
          sourceClass: "OWNED_WEBSITE",
          capturedAt: "2026-08-26T00:00:00.000Z",
          freshness: {
            state: "CURRENT",
            evaluatedAt: "2026-08-26T00:00:00.000Z",
            basis: "LATEST_CAPTURE",
          },
          representativeness: "PERSISTENT_BRAND_LEVEL",
          coverage: "SINGLE_RESOURCE",
          acquisitionQuality: quality,
          provenance: {
            acquisitionOrNormalizationRunRef: `capability:${index}`,
            captureMethodClass: "DIRECT_FETCH",
            normalizationContractVersion: "1.0",
            parentEvidenceRefs: [],
            parentCaptureRefs: [],
          },
          deduplication: {
            itemFingerprint: capabilityId,
            repetitionCount: 1,
            supportingResourceRefs: ["resource:company"],
          },
          contentHash: "a".repeat(64),
          polarity: "AFFIRMATIVE",
          boundedNormalizedPayload:
            index === 3
              ? proofPayload()
              : {
                  statement_text: "We manufacture tools in our own factory.",
                  subject_scope: "BRAND_LEVEL",
                  authorship: "BRAND_AUTHORED",
                },
        },
      ],
    })),
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
            authority: "APPLICATION_CANONICAL",
          })),
        ),
    },
    { read: async () => evidence },
    new CanonicalStateManifestBuilder(),
    new EvidenceManifestBuilder(),
    new ProcessorDependencyReadinessEvaluator(),
  );
}
export function differentiationOutput(
  evidence: NormalizedEvidenceSet,
  withProof = true,
  id = "in_house_manufacturing",
): DifferentiationOutput {
  const company = evidence.capabilityResults.find(
    (c) => c.capabilityId === capabilities[0],
  )?.evidence[0];
  const proof = evidence.capabilityResults
    .find((c) => c.capabilityId === capabilities[3])
    ?.evidence.find(
      (e) =>
        (e.boundedNormalizedPayload as { proof_class?: string })
          ?.proof_class === "DIRECT_FIRST_PARTY_FACTUAL_SUPPORT" &&
        (e.boundedNormalizedPayload as { scope?: string })?.scope ===
          "BRAND_LEVEL",
    );
  const ref = company?.evidenceRef ?? "missing";
  return {
    differentiation_and_proof: [
      {
        semantic_id: id,
        differentiator:
          "In-house manufacturing anchors the Brand's operating model.",
        proof_points: withProof
          ? [
              {
                semantic_id: "owned_factory",
                statement: String(
                  (proof?.boundedNormalizedPayload as { statement?: string })
                    ?.statement,
                ),
              },
            ]
          : null,
      },
    ],
    output_metadata: [
      {
        semantic_id: id,
        differentiator_metadata: {
          authority: "CREATOR_SHOP_DERIVED",
          source_class: "OWNED_WEBSITE",
          freshness: "CURRENT",
          evidence_refs: [ref],
        },
        proof_point_metadata: withProof
          ? [
              {
                semantic_id: "owned_factory",
                authority: "OBSERVED",
                source_class: "OWNED_WEBSITE",
                freshness: "CURRENT",
                evidence_refs: [proof?.evidenceRef ?? "missing"],
                proof_strength: "DIRECT_FIRST_PARTY_FACT",
              },
            ]
          : null,
      },
    ],
  };
}
