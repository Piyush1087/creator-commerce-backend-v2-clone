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
  BRAND_CHARACTER_OBJECTS,
  type BrandCharacterOutput,
  type CharacterItemMetadata,
} from "./brand-character.types";

export const registryKey = {
  processorId: "brand_character",
  processorVersion: "1.0",
  outputContractId: "brand_character_output_contract",
  outputContractVersion: "1.0",
};
export const capabilities = [
  "owned_website.brand_company_context",
  "owned_website.brand_messaging",
] as const;
export const scope = (brandId: string) =>
  BRAND_CHARACTER_OBJECTS.map((objectSemanticId) => ({
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
    capabilityResults: capabilities.map((capabilityId) => ({
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
      evidence: [
        {
          brandId,
          capabilityId,
          evidenceRef: `evidence:${capabilityId}`,
          resourceRef: "resource:company",
          resourceType: "OWNED_WEB_PAGE",
          captureRef: "capture:company",
          captureVersion: "capture:company",
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
            supportingResourceRefs: ["resource:company"],
          },
          contentHash: "a".repeat(64),
          boundedNormalizedPayload:
            capabilityId === "owned_website.brand_company_context"
              ? {
                  statement_text:
                    "Our values are transparency and fair partnerships for all creators.",
                  statement_class: "STATED_PRINCIPLE",
                  assertion_nature: "BRAND_AUTHORED_PRINCIPLE_OR_VALUE",
                }
              : {
                  text_or_normalized_message:
                    "We are a curious and dependable brand committed to creators.",
                  message_role: "BRAND_POSITIONING",
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
          (["brand_name", "industry", "sub_industry"] as const).map(
            (semantic) => ({
              semantic,
              fieldPath: `$.${semantic}`,
              value: semantic === "sub_industry" ? null : semantic,
              authority:
                semantic === "sub_industry"
                  ? "PROVISIONAL"
                  : "APPLICATION_CANONICAL",
            }),
          ),
        ),
    },
    { read: async () => evidence },
    new CanonicalStateManifestBuilder(),
    new EvidenceManifestBuilder(),
    new ProcessorDependencyReadinessEvaluator(),
  );
}
export function characterOutput(
  evidence: NormalizedEvidenceSet,
  values = true,
  personality = true,
): BrandCharacterOutput {
  const company = evidence.capabilityResults.find(
    (cap) => cap.capabilityId === capabilities[0],
  )!.evidence;
  const messaging = evidence.capabilityResults.find(
    (cap) => cap.capabilityId === capabilities[1],
  )!.evidence;
  const find = (items: typeof company, word: string) =>
    items.find((item) =>
      JSON.stringify(item.boundedNormalizedPayload).includes(word),
    )?.evidenceRef ?? items[0].evidenceRef;
  const meta = (semantic_id: string, ref: string): CharacterItemMetadata => ({
    semantic_id,
    authority: "CREATOR_SHOP_DERIVED",
    source_class: "OWNED_WEBSITE",
    freshness: "CURRENT",
    evidence_refs: [ref],
  });
  return {
    brand_values: values
      ? [
          { semantic_id: "principle_transparency", value: "Transparency" },
          {
            semantic_id: "principle_fair_partnerships",
            value: "Fair partnerships",
          },
        ]
      : null,
    brand_personality: personality
      ? [
          { semantic_id: "character_curiosity", trait: "Curious" },
          { semantic_id: "character_dependability", trait: "Dependable" },
        ]
      : null,
    output_metadata: {
      brand_values: values
        ? [
            meta("principle_transparency", find(company, "transparency")),
            meta(
              "principle_fair_partnerships",
              find(company, "fair partnerships"),
            ),
          ]
        : null,
      brand_personality: personality
        ? [
            meta("character_curiosity", find(messaging, "curious")),
            meta("character_dependability", find(messaging, "dependable")),
          ]
        : null,
    },
  };
}
