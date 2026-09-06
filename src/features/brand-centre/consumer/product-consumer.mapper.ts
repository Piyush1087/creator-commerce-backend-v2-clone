import type { CanonicalOfferingStateService } from "../services/canonical-offering-state.service";
import type { CurrentIntelligenceObjectProjection } from "../../brand-intelligence/projection/intelligence-current-projection.types";
import { authorityPresentation } from "./brand-consumer.mapper";
import type { ProcessorRuntimeProjection } from "./processor-runtime-projection.types";
import type {
  ProductConsumerResponse,
  ProductIntelligenceObject,
  ProductProcessorRuntime,
} from "./product-consumer.schema";
import type {
  ProductObjectSemanticId,
  ProductProcessorId,
} from "./product-consumer.types";

type CanonicalOffering = NonNullable<
  Awaited<ReturnType<CanonicalOfferingStateService["read"]>>
>;

const noCandidate = {
  status: "NONE" as const,
  count: 0,
  currentPreserved: false,
  summaryAvailable: false,
  rawCandidateVisible: false as const,
};

export function mapCanonicalOffering(
  offering: CanonicalOffering,
): ProductConsumerResponse["offering"] {
  const price = offering.priceState?.currentRevision;
  const primary = offering.mediaState?.primaryMediaAsset;
  return {
    id: offering.id,
    kind: offering.canonicalKind,
    subtype: offering.canonicalSubtype,
    lifecycle: offering.canonicalLifecycle
      ? { state: "RESOLVED", value: offering.canonicalLifecycle }
      : { state: "UNRESOLVED" },
    name: offering.name,
    description: offering.description,
    customerDestination: offering.url,
    primaryMedia:
      primary && primary.lifecycle === "ACTIVE"
        ? {
            id: primary.id,
            url: primary.url,
            label: primary.label,
            altText: primary.altText,
          }
        : null,
    canonicalPrice: price
      ? {
          state: "CURRENT",
          revisionId: price.id,
          mode: price.mode,
          currentMinAmount: price.currentMinAmount?.toString() ?? null,
          currentMaxAmount: price.currentMaxAmount?.toString() ?? null,
          regularMinAmount: price.regularMinAmount?.toString() ?? null,
          regularMaxAmount: price.regularMaxAmount?.toString() ?? null,
          currency: price.currency,
          freshness: price.freshness,
          authority: price.authority,
          evaluatedAt: price.freshnessEvaluatedAt.toISOString(),
        }
      : { state: "UNAVAILABLE" },
    offerRefs: offering.offerApplicability
      .map((edge) => ({ offerId: edge.brandOfferId }))
      .sort((left, right) => left.offerId.localeCompare(right.offerId)),
    locationRefs: offering.locationAvailability
      .map((edge) => ({ locationId: edge.locationId }))
      .sort((left, right) => left.locationId.localeCompare(right.locationId)),
  };
}

export function emptyProductObject(
  semanticId: ProductObjectSemanticId,
): ProductIntelligenceObject {
  return {
    semanticId,
    current: { kind: "NO_CURRENT" },
    objectState: "NO_CURRENT",
    readiness: "NOT_READY",
    resultReadiness: "NOT_READY",
    freshness: "UNKNOWN",
    changedAt: null,
    authority: "observed",
    candidate: noCandidate,
    lineage: {
      objectContract: null,
      outputContract: null,
      mixedGeneration: false,
      mixedContractVersion: false,
      components: [],
    },
  };
}

export function mapProductObject(
  projection: CurrentIntelligenceObjectProjection,
): ProductIntelligenceObject {
  const semanticId = projection.objectSemanticId as ProductObjectSemanticId;
  return {
    semanticId,
    objectState: projection.objectState,
    current:
      projection.assembledValue.state === "VALUE"
        ? { kind: "VALUE", value: projection.assembledValue.value }
        : { kind: projection.assembledValue.state },
    readiness: projection.consumerReadiness,
    resultReadiness: projection.resultReadiness,
    freshness: projection.freshness,
    changedAt: projection.changedAt,
    authority: authorityPresentation(projection.authority),
    candidate: {
      status: projection.candidateSummary.status,
      count: projection.candidateSummary.pendingCount,
      currentPreserved: projection.candidateSummary.currentPreserved,
      summaryAvailable: projection.candidateSummary.summaryAvailable,
      rawCandidateVisible: false,
    },
    lineage: {
      objectContract: projection.objectContract,
      outputContract: projection.outputContract,
      mixedGeneration: projection.mixedGeneration,
      mixedContractVersion: projection.mixedContractVersion,
      components: projection.components.map((component) => ({
        semanticPath: component.componentSemanticPath,
        currentContract: {
          id: component.currentContractId,
          version: component.currentContractVersion,
        },
        revision: component.revision,
        generatedAt: component.generationCreatedAt,
      })),
    },
  };
}

export function mapProductRuntime(
  processorId: ProductProcessorId,
  object: ProductIntelligenceObject,
  runtime: ProcessorRuntimeProjection,
): ProductProcessorRuntime {
  return {
    processorId,
    objectSemanticId: object.semanticId,
    readiness: object.readiness,
    freshness: object.freshness,
    activity: runtime.activity,
    dependencyReadiness: runtime.readiness,
    latestExecutionStatus: runtime.latestExecutionStatus,
    reasonCode: runtime.reasonCode,
    hasCurrent: runtime.hasCurrent,
    refreshing: runtime.refreshing,
    failure: runtime.failure,
    candidate: object.candidate,
    currentLineage: runtime.hasCurrent
      ? {
          generatedAt: object.lineage.components.map(
            (component) => component.generatedAt,
          ),
          revisions: object.lineage.components.map(
            (component) => component.revision,
          ),
          mixedGeneration: object.lineage.mixedGeneration,
          objectContract: object.lineage.objectContract,
          outputContract: object.lineage.outputContract,
        }
      : null,
  };
}

export function emptyProductRuntime(
  processorId: ProductProcessorId,
  object: ProductIntelligenceObject,
): ProductProcessorRuntime {
  return mapProductRuntime(processorId, object, {
    processorId,
    activity: "IDLE",
    readiness: "UNKNOWN",
    latestExecutionStatus: null,
    reasonCode: null,
    hasCurrent: false,
    refreshing: false,
    failure: null,
  });
}
