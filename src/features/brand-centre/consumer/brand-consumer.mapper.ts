import type { CanonicalBrandStateEntry } from "../../brand-intelligence/input/canonical-state/canonical-brand-state.port";
import type {
  CurrentIntelligenceObjectProjection,
  IntelligenceCandidateSummary,
} from "../../brand-intelligence/projection/intelligence-current-projection.types";
import type {
  ConsumerAuthority,
  ConsumerField,
  ConsumerIntelligenceField,
} from "./brand-consumer.types";

export const BRAND_CONSUMER_OBJECTS = [
  "brand_description",
  "positioning",
  "value_proposition",
  "brand_values",
  "brand_personality",
  "differentiation_and_proof",
  "communication_profile",
  "audience_personas",
  "visual_style_profile",
  "serviceability_profile",
] as const;

export function authorityPresentation(
  authority: string | null,
): ConsumerAuthority {
  switch (authority) {
    case "BRAND_CONFIRMED":
      return "confirmed";
    case "SUPPORT_CONTROLLED":
      return "protected";
    case "APPLICATION_CANONICAL":
    case "SYSTEM_DERIVED":
      return "system_managed";
    case "CREATOR_SHOP_DERIVED":
      return "creator_shop";
    case "MIXED":
      return "mixed";
    default:
      return "observed";
  }
}

export function applicationField<T>(
  semanticId: string,
  value: T | null,
  authority: string | null,
): ConsumerField<T> {
  const readiness = value === null ? "NOT_READY" : "READY";
  return {
    semanticId,
    current: value === null ? { kind: "NO_CURRENT" } : { kind: "VALUE", value },
    readiness,
    resultReadiness: readiness,
    freshness: value === null ? "UNKNOWN" : "CURRENT",
    authority: authorityPresentation(authority),
    editability: "READ_ONLY",
  };
}

export function anchorField(
  entry: CanonicalBrandStateEntry,
): ConsumerField<string> {
  return applicationField(entry.semantic, entry.value, entry.authority);
}

function candidateNotice(summary: IntelligenceCandidateSummary) {
  return {
    status: summary.status,
    count: summary.pendingCount,
    currentPreserved: summary.currentPreserved,
    summaryAvailable: summary.summaryAvailable,
    rawCandidateVisible: false as const,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Current semantic values only. Traceability belongs to a separately authorized detail surface. */
function visibleValue(object: string, value: unknown): unknown {
  if (object === "audience_personas" && Array.isArray(value))
    return value.filter(
      (item) => isRecord(item) && item.lifecycle === "ACTIVE",
    );
  if (object === "serviceability_profile" && isRecord(value))
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== "serviceability_basis"),
    );
  return value;
}

export function intelligenceField(
  object: CurrentIntelligenceObjectProjection,
): ConsumerIntelligenceField {
  const value = visibleValue(
    object.objectSemanticId,
    object.assembledValue.value,
  );
  const activePersonaIds = new Set(
    Array.isArray(value)
      ? value.filter(isRecord).map((item) => item.semantic_id)
      : [],
  );
  const visibleComponents = object.components.filter((component) => {
    const path = component.componentSemanticPath;
    if (
      object.objectSemanticId === "serviceability_profile" &&
      path.startsWith("$/f/serviceability_basis")
    )
      return false;
    if (
      object.objectSemanticId === "audience_personas" &&
      path.startsWith("$/i/")
    )
      return activePersonaIds.has(decodeURIComponent(path.split("/")[2]));
    return true;
  });
  return {
    semanticId: object.objectSemanticId,
    current:
      object.assembledValue.state === "VALUE"
        ? { kind: "VALUE", value }
        : { kind: object.assembledValue.state },
    readiness: object.consumerReadiness,
    resultReadiness: object.resultReadiness,
    freshness: object.freshness,
    authority: authorityPresentation(object.authority),
    editability: "POLICY_PENDING",
    candidate: candidateNotice(object.candidateSummary),
    mixedGeneration: object.mixedGeneration,
    componentMeta: Object.fromEntries(
      visibleComponents.map((component) => [
        component.componentSemanticPath,
        {
          semanticId: component.componentSemanticPath,
          readiness: component.readiness,
          resultReadiness: component.readiness,
          freshness: component.freshness,
          authority: authorityPresentation(component.authority),
          editability: "POLICY_PENDING" as const,
          candidate: candidateNotice(component.candidateSummary),
        },
      ]),
    ),
  };
}
