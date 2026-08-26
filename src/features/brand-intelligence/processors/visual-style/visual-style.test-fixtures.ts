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
import { visualEvidenceSupport } from "../../input/evidence/visual-evidence-admission";
import { VISUAL_STYLE_OBJECT } from "./visual-style.types";
import type { CanonicalBrandStateSnapshot } from "../../input/canonical-state/canonical-brand-state.port";
export const registryKey = {
  processorId: "visual_style_synthesis",
  processorVersion: "1.0",
  outputContractId: "visual_style_synthesis_output_contract",
  outputContractVersion: "1.0",
};
export const capabilities = ["owned_website.visual_evidence"] as const;
export const scope = (brandId: string) => [
  {
    brandId,
    objectSemanticId: VISUAL_STYLE_OBJECT,
    componentSemanticPath: "$",
    pathSchemeVersion: 1,
  },
];
let verified: ContractRuntimeRegistry | undefined;
export function contracts() {
  if (!verified) {
    verified = new ContractRuntimeRegistry(
      new ContractBundleIntegrityVerifier(),
      new SemanticValidator(),
    );
    verified.verifyAtRoot(
      resolve(
        process.cwd(),
        "src/features/brand-intelligence/generated/contract-bundles",
      ),
    );
  }
  return verified;
}
export function visualPayload(graphic = false) {
  return {
    source_url: "https://visual.example/",
    source_locator: "body",
    page_role: "HOMEPAGE",
    subject_scope: "BRAND_LEVEL",
    authorship: "BRAND_AUTHORED",
    evidence_semantic: graphic
      ? "LAYOUT_OR_COMPOSITION_OBSERVATION"
      : "COLOUR_USAGE_OBSERVATION",
    observed_property: graphic ? "border-radius" : "color",
    observed_value: graphic ? "12px" : "#336699",
    matched_element_count: 1,
    observation_basis: "RETAINED_DOM_DECLARATION",
    computed_or_rendered: false,
    canonical_asset_ref: null,
    limitations: [
      "NO_COMPUTED_OR_RENDERED_STYLE",
      "EXTERNAL_STYLESHEETS_NOT_CAPTURED",
    ],
  };
}
export function evidenceFixture(brandId: string): NormalizedEvidenceSet {
  const quality = {
    state: "COMPLETE" as const,
    failureCategories: [],
    detailCodes: [],
  };
  return {
    brandId,
    capabilityResults: [
      {
        capabilityId: capabilities[0],
        capabilityExecutionRef: "capability:visual",
        normalizationContractVersion: "1.0",
        status: "AVAILABLE",
        retryability: "NOT_APPLICABLE",
        reasonCodes: [],
        coverage: "SINGLE_RESOURCE",
        acquisitionQuality: quality,
        evidence: [false, true].map((graphic, index) => ({
          brandId,
          capabilityId: capabilities[0],
          evidenceRef: "visual:" + index,
          resourceRef: "resource:visual",
          resourceType: "OWNED_WEB_PAGE",
          captureRef: "capture:visual",
          captureVersion: "capture:visual",
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
            acquisitionOrNormalizationRunRef: "capability:visual",
            captureMethodClass: "DIRECT_FETCH",
            normalizationContractVersion: "1.0",
            parentEvidenceRefs: [],
            parentCaptureRefs: [],
          },
          deduplication: {
            itemFingerprint: "visual:" + index,
            repetitionCount: 1,
            supportingResourceRefs: ["resource:visual"],
          },
          contentHash: "a".repeat(64),
          polarity: "AFFIRMATIVE",
          boundedNormalizedPayload: visualPayload(graphic),
        })),
      },
    ],
  };
}
export function canonicalFixture(brandId: string): CanonicalBrandStateSnapshot {
  return {
    ...assembleCanonicalBrandStateSnapshot(
      brandId,
      new Date("2026-08-26T00:00:00.000Z"),
      [
        {
          semantic: "brand_name",
          fieldPath: "$.name",
          value: "Visual Brand",
          authority: "APPLICATION_CANONICAL",
        },
      ],
    ),
    visualState: { brandId, stateReference: null, items: [] },
  };
}
export function preparation(
  brandId: string,
  evidence = evidenceFixture(brandId),
  canonical = canonicalFixture(brandId),
) {
  return new ProcessorDependencyPreparationService(
    contracts(),
    new ProcessorDependencyProfileRegistry(),
    { read: async () => canonical },
    { read: async () => evidence },
    new CanonicalStateManifestBuilder(),
    new EvidenceManifestBuilder(),
    new ProcessorDependencyReadinessEvaluator(),
  );
}
export function visualStyleOutput(
  evidence: NormalizedEvidenceSet,
  mode: "ready" | "partial" | "null" = "ready",
) {
  const items = evidence.capabilityResults.flatMap((c) => c.evidence);
  const supported = items.filter((e) =>
    visualEvidenceSupport({
      capabilityId: e.capabilityId,
      normalizedPayload: e.boundedNormalizedPayload,
      representativeness: e.representativeness,
      freshness: e.freshness.state,
      sourceClass: e.sourceClass,
      polarity: e.polarity,
    }),
  );
  const graphic = supported.find(
    (e) =>
      (e.boundedNormalizedPayload as { evidence_semantic: string })
        .evidence_semantic === "LAYOUT_OR_COMPOSITION_OBSERVATION",
  );
  const meta = (ref: string) => ({
    authority: "CREATOR_SHOP_DERIVED" as const,
    source_class: "OWNED_WEBSITE" as const,
    freshness: "CURRENT" as const,
    evidence_refs: [ref],
    confidence: "LOW" as const,
  });
  const ref = supported[0]?.evidenceRef ?? "missing";
  return {
    visual_style_profile:
      mode === "null"
        ? null
        : {
            summary:
              "Retained DOM declarations suggest recurring source-level visual patterns.",
            style_traits: [
              {
                semantic_id: "declared_colour",
                trait: "Source-declared colour recurrence",
              },
            ],
            imagery_style: null,
            graphic_treatment:
              mode === "ready"
                ? {
                    traits: [
                      {
                        semantic_id: "declared_framing",
                        value: "Source-declared framing repetition",
                      },
                    ],
                  }
                : null,
            visual_constraints: null,
          },
    output_metadata: {
      summary: mode === "null" ? null : meta(ref),
      style_traits:
        mode === "null"
          ? null
          : [{ semantic_id: "declared_colour", ...meta(ref) }],
      imagery_style: null,
      graphic_treatment:
        mode === "ready"
          ? {
              traits: [
                {
                  semantic_id: "declared_framing",
                  ...meta(graphic?.evidenceRef ?? "missing"),
                },
              ],
            }
          : null,
      visual_constraints: null,
    },
  };
}
