import {
  retainOwnedSiteObservations,
  type ObservedStatement,
} from "../../acquisition/owned-site-observation-fragment";
import type {
  EvidenceCapabilityId,
  EvidencePolarity,
} from "../../domain/evidence-vocabulary";
import {
  itemFingerprint,
  observationKey,
  type DataExtractionNormalizationSource,
  type NormalizedEvidenceDraft,
} from "../owned-website-wave1-normalizers";

export function fragmentFor(source: DataExtractionNormalizationSource) {
  return (
    source.observationFragment ??
    retainOwnedSiteObservations(source.acquiredSourceBody ?? "")
  );
}
export function statementsFor(
  source: DataExtractionNormalizationSource,
): readonly ObservedStatement[] {
  const fragment = fragmentFor(source);
  if (fragment.statements.length) return fragment.statements;
  // Text-only captures cannot establish Brand authorship; still preserve bounded claim/context.
  return source.normalizedText
    .split(/\n+|(?<=[.!?])\s+/)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 10 && text.length <= 600)
    .slice(0, 80)
    .map((text, index) => ({
      text,
      locator: `text-only:${index}`,
      authorship: "UNKNOWN" as const,
      offeringContext: false,
    }));
}
export function subjectScope(
  source: DataExtractionNormalizationSource,
  unit?: ObservedStatement,
) {
  const role = source.resource.pageRole;
  const path = new URL(source.resource.canonicalUrl).pathname;
  if (
    unit?.offeringContext ||
    role === "OFFERING_DETAIL" ||
    /\/(?:products?|services?|plans?)\/[^/]+/.test(path) ||
    /\b(?:this|our) (?:product|treatment|plan|package)\b|\b(?:starter|pro|premium|enterprise) plan\b/i.test(
      unit?.text ?? "",
    )
  )
    return "OFFERING_SPECIFIC" as const;
  if (
    [
      "HOMEPAGE",
      "ABOUT_COMPANY",
      "COMPANY_OVERVIEW",
      "BRAND_STORY",
      "MISSION_VALUES",
      "POLICY",
    ].includes(role ?? "")
  )
    return "BRAND_LEVEL" as const;
  return "CONTEXT_SPECIFIC" as const;
}
export function commonPayload(
  source: DataExtractionNormalizationSource,
  unit: ObservedStatement,
) {
  return {
    source_url: source.resource.canonicalUrl,
    source_locator: unit.locator,
    page_role: source.resource.pageRole ?? "OTHER",
    subject_scope: subjectScope(source, unit),
    authorship: unit.authorship,
  };
}
export function polarity(text: string): EvidencePolarity {
  if (
    /\b(?:not|never|no|doesn't|don't|isn't|aren't|cannot|can't|unsupported)\b/i.test(
      text,
    )
  )
    return "EXPLICIT_NEGATIVE";
  if (
    /\b(?:only|except|excluding|excludes?|restricted|restrictions?|selected)\b/i.test(
      text,
    )
  )
    return "RESTRICTION";
  return "AFFIRMATIVE";
}
export function draftFor(
  source: DataExtractionNormalizationSource,
  capabilityId: EvidenceCapabilityId,
  semanticText: string,
  payload: Readonly<Record<string, unknown>>,
  options: {
    polarity?: EvidencePolarity;
    semanticIdentity?: string;
    conflictFamily?: string;
  } = {},
): NormalizedEvidenceDraft {
  const scope = payload.subject_scope;
  return {
    source,
    semanticText,
    boundedNormalizedPayload: payload,
    semanticObservationKey: observationKey(
      capabilityId,
      options.semanticIdentity ?? `${scope}|${semanticText}`,
    ),
    itemFingerprint: itemFingerprint(capabilityId, semanticText, payload),
    representativeness:
      scope === "OFFERING_SPECIFIC"
        ? "OFFERING_SPECIFIC"
        : scope === "BRAND_LEVEL"
          ? "PERSISTENT_BRAND_LEVEL"
          : "CONTEXT_SPECIFIC",
    polarity: options.polarity ?? "NEUTRAL",
    ...(options.conflictFamily
      ? { conflictFamily: options.conflictFamily }
      : {}),
  };
}
export function repeated(
  drafts: readonly NormalizedEvidenceDraft[],
): NormalizedEvidenceDraft[] {
  return drafts.map((draft) => ({
    ...draft,
    representativeness:
      draft.representativeness !== "OFFERING_SPECIFIC" &&
      new Set(
        drafts
          .filter(
            (other) =>
              other.semanticObservationKey === draft.semanticObservationKey,
          )
          .map((other) => other.source.resource.resourceRef),
      ).size > 1
        ? "REPEATED_REPRESENTATIVE"
        : draft.representativeness,
  }));
}
