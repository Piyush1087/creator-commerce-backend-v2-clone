import { createHash } from "node:crypto";
import type { OwnedSiteObservationFragment } from "../acquisition/owned-site-observation-fragment";

import type {
  EvidenceRef,
  NormalizedContentRef,
  ResourceRef,
  SemanticObservationKey,
} from "../domain/evidence-identities";
import type {
  DataExtractionCapabilityExecutionRecord,
  DataExtractionCaptureRecord,
  DataExtractionEvidenceItemRecord,
  DataExtractionResourceRecord,
  EvidenceFreshnessSnapshot,
} from "../domain/evidence-records";
import type {
  EvidenceAcquisitionQuality,
  EvidenceCapabilityId,
  EvidencePolarity,
  EvidenceRepresentativeness,
} from "../domain/evidence-vocabulary";

export interface DataExtractionNormalizationSource {
  readonly resource: DataExtractionResourceRecord;
  readonly capture: DataExtractionCaptureRecord;
  readonly normalizedContentRef?: NormalizedContentRef;
  readonly normalizedText: string;
  readonly acquiredSourceBody?: string;
  readonly observationFragment?: OwnedSiteObservationFragment;
  readonly freshness: EvidenceFreshnessSnapshot;
}

export interface DataExtractionNormalizationInput {
  readonly execution: DataExtractionCapabilityExecutionRecord;
  readonly sources: readonly DataExtractionNormalizationSource[];
  readonly parentEvidence: readonly DataExtractionEvidenceItemRecord[];
  readonly locationReconciliations?: readonly {
    readonly captureRef: string;
    readonly sourceLocator: string;
    readonly canonicalLocationRef: string;
  }[];
  readonly exactOfferingScope?: Readonly<{
    readonly canonicalOfferingRef: string;
    readonly captureRefs: readonly string[];
  }>;
}

export function canonicalOfferingRefForSource(
  input: DataExtractionNormalizationInput,
  source: DataExtractionNormalizationSource,
): string | null {
  return input.exactOfferingScope?.captureRefs.includes(
    source.capture.captureRef,
  )
    ? input.exactOfferingScope.canonicalOfferingRef
    : null;
}

export interface NormalizedEvidenceDraft {
  readonly source: DataExtractionNormalizationSource;
  readonly semanticText: string;
  readonly semanticObservationKey: SemanticObservationKey;
  readonly itemFingerprint: string;
  readonly boundedNormalizedPayload: Readonly<Record<string, unknown>>;
  readonly representativeness: EvidenceRepresentativeness;
  readonly polarity?: EvidencePolarity;
  readonly parentEvidenceRefs?: readonly EvidenceRef[];
  readonly conflictFamily?: string;
}

export interface DataExtractionNormalizationResult {
  readonly drafts: readonly NormalizedEvidenceDraft[];
  readonly reasonCodes: readonly string[];
}

export interface DataExtractionEvidenceNormalizer {
  readonly capabilityId: EvidenceCapabilityId;
  normalize(
    input: DataExtractionNormalizationInput,
  ): DataExtractionNormalizationResult;
}

const MAX_SENTENCE = 280;
const MAX_ITEMS_PER_RESOURCE = 12;
const ENGLISH_COMMON = new Set([
  "the",
  "and",
  "for",
  "with",
  "your",
  "you",
  "our",
  "we",
  "is",
  "are",
  "to",
  "of",
  "in",
  "on",
  "that",
  "this",
  "from",
  "a",
  "an",
]);

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalSemanticText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”‘’]/g, "'")
    .replace(/[^\p{L}\p{N}\s'%-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function observationKey(
  capabilityId: EvidenceCapabilityId,
  semanticText: string,
): SemanticObservationKey {
  return `observation:${sha(`${capabilityId}|${canonicalSemanticText(semanticText)}`)}` as SemanticObservationKey;
}

export function itemFingerprint(
  capabilityId: EvidenceCapabilityId,
  semanticText: string,
  payload: Readonly<Record<string, unknown>>,
): string {
  return sha(
    `${capabilityId}|${canonicalSemanticText(semanticText)}|${canonicalJson(payload)}`,
  );
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function sentences(text: string): string[] {
  const lines = text
    .replace(/\r/g, "\n")
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 18 && line.length <= MAX_SENTENCE);
  return [
    ...new Map(
      lines.map((line) => [canonicalSemanticText(line), line]),
    ).values(),
  ];
}

function representativePage(resource: DataExtractionResourceRecord): boolean {
  return [
    "HOMEPAGE",
    "ABOUT_COMPANY",
    "BRAND_STORY",
    "MISSION_VALUES",
    "COMPANY_OVERVIEW",
    "PORTFOLIO_OVERVIEW",
    "CATEGORY_OVERVIEW",
    "SERVICE_OVERVIEW",
    "SOLUTIONS_OVERVIEW",
    "PRICING_PLANS",
  ].includes(resource.pageRole ?? "OTHER");
}

function sourceRepresentativeness(
  source: DataExtractionNormalizationSource,
  mode: "MESSAGING" | "COMPANY" | "OFFERING" | "LANGUAGE" | "CONSTRAINT",
): EvidenceRepresentativeness {
  const role = source.resource.pageRole ?? "OTHER";
  if (mode === "OFFERING") {
    if (["OFFERING_DETAIL"].includes(role)) return "OFFERING_SPECIFIC";
    if (
      [
        "PORTFOLIO_OVERVIEW",
        "CATEGORY_OVERVIEW",
        "SERVICE_OVERVIEW",
        "SOLUTIONS_OVERVIEW",
        "PRICING_PLANS",
      ].includes(role)
    ) {
      return "PERSISTENT_BRAND_LEVEL";
    }
  }
  if (
    mode === "COMPANY" &&
    [
      "ABOUT_COMPANY",
      "BRAND_STORY",
      "MISSION_VALUES",
      "COMPANY_OVERVIEW",
    ].includes(role)
  ) {
    return "PERSISTENT_BRAND_LEVEL";
  }
  if (mode === "LANGUAGE" && representativePage(source.resource))
    return "PERSISTENT_BRAND_LEVEL";
  if (
    mode === "MESSAGING" &&
    ["HOMEPAGE", "ABOUT_COMPANY", "BRAND_STORY", "MISSION_VALUES"].includes(
      role,
    )
  ) {
    return "PERSISTENT_BRAND_LEVEL";
  }
  if (role === "CAMPAIGN_LANDING") return "CONTEXT_SPECIFIC";
  if (role === "OFFERING_DETAIL") return "OFFERING_SPECIFIC";
  return representativePage(source.resource)
    ? "CONTEXT_SPECIFIC"
    : "INCIDENTAL";
}

function applyRepeatedRepresentativeness(
  drafts: readonly NormalizedEvidenceDraft[],
): NormalizedEvidenceDraft[] {
  const resources = new Map<string, Set<ResourceRef>>();
  for (const draft of drafts) {
    const key = draft.semanticObservationKey;
    const current = resources.get(key) ?? new Set<ResourceRef>();
    current.add(draft.source.resource.resourceRef);
    resources.set(key, current);
  }
  return drafts.map((draft) =>
    (resources.get(draft.semanticObservationKey)?.size ?? 0) > 1
      ? { ...draft, representativeness: "REPEATED_REPRESENTATIVE" }
      : draft,
  );
}

function polarityForStatement(text: string): EvidencePolarity | undefined {
  const normalized = canonicalSemanticText(text);
  if (
    /\b(never|must not|do not|don't|cannot|can't|prohibit|prohibited|avoid)\b/.test(
      normalized,
    )
  ) {
    return "RESTRICTION";
  }
  if (
    /\b(not available|not supported|no longer|does not|doesn't)\b/.test(
      normalized,
    )
  ) {
    return "EXPLICIT_NEGATIVE";
  }
  return undefined;
}

function draft(
  capabilityId: EvidenceCapabilityId,
  source: DataExtractionNormalizationSource,
  semanticText: string,
  payload: Readonly<Record<string, unknown>>,
  representativeness: EvidenceRepresentativeness,
  options?: {
    polarity?: EvidencePolarity;
    parentEvidenceRefs?: readonly EvidenceRef[];
    conflictFamily?: string;
  },
): NormalizedEvidenceDraft {
  return {
    source,
    semanticText,
    semanticObservationKey: observationKey(capabilityId, semanticText),
    itemFingerprint: itemFingerprint(capabilityId, semanticText, payload),
    boundedNormalizedPayload: payload,
    representativeness,
    ...(options?.polarity ? { polarity: options.polarity } : {}),
    ...(options?.parentEvidenceRefs
      ? { parentEvidenceRefs: options.parentEvidenceRefs }
      : {}),
    ...(options?.conflictFamily
      ? { conflictFamily: options.conflictFamily }
      : {}),
  };
}

function messagingRole(text: string): string | null {
  const value = canonicalSemanticText(text);
  if (/\b(mission|vision|purpose|we believe|our story)\b/.test(value))
    return "BRAND_STORY_OR_MISSION";
  if (
    /\b(we help|we enable|we make|we create|we build|built for|designed for|made for)\b/.test(
      value,
    )
  )
    return "BRAND_PROPOSITION";
  if (
    /\b(leading|trusted|speciali[sz]e|focused on|dedicated to|known for)\b/.test(
      value,
    )
  )
    return "BRAND_POSITIONING";
  if (
    /\b(you|your)\b/.test(value) &&
    /\b(get|discover|find|choose|start|save|grow|improve|enjoy|experience|book|shop)\b/.test(
      value,
    )
  ) {
    return "CUSTOMER_GUIDANCE";
  }
  if (
    /\b(certified|award|trusted by|years? of|customers?|clients?|patients?)\b/.test(
      value,
    )
  ) {
    return "OTHER_REPRESENTATIVE_BRAND_MESSAGE";
  }
  return null;
}

export class BrandMessagingNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.brand_messaging" as const;

  normalize(
    input: DataExtractionNormalizationInput,
  ): DataExtractionNormalizationResult {
    const drafts: NormalizedEvidenceDraft[] = [];
    for (const source of input.sources) {
      if (
        ["LEGAL", "TESTIMONIAL", "POLICY"].includes(
          source.resource.pageRole ?? "",
        )
      )
        continue;
      for (const text of sentences(source.normalizedText).slice(0, 80)) {
        const role = messagingRole(text);
        if (!role) continue;
        const payload = {
          text_or_normalized_message: text.slice(0, 280),
          verbatim_excerpt: text.slice(0, 280),
          message_role: role,
          authorship_class: "BRAND_AUTHORED",
          visibility_class: "VISIBLE_PRIMARY_COPY",
          surface_section: null,
          repetition_count: 1,
          supporting_evidence_refs: [],
        } as const;
        drafts.push(
          draft(
            this.capabilityId,
            source,
            text,
            payload,
            sourceRepresentativeness(source, "MESSAGING"),
            { polarity: polarityForStatement(text) },
          ),
        );
        if (
          drafts.filter((item) => item.source === source).length >=
          MAX_ITEMS_PER_RESOURCE
        )
          break;
      }
    }
    return {
      drafts: applyRepeatedRepresentativeness(drafts),
      reasonCodes: drafts.length ? [] : ["NO_QUALIFYING_BRAND_MESSAGING"],
    };
  }
}

function companyStatementClass(text: string): string | null {
  const value = canonicalSemanticText(text);
  if (
    /\b(founded|established|since \d{4}|started in|began in|our journey)\b/.test(
      value,
    )
  )
    return "HISTORY_OR_FOUNDING";
  if (/\b(mission|purpose|we believe|we exist to)\b/.test(value))
    return "MISSION_OR_PURPOSE";
  if (
    /\b(headquartered|based in|operate in|operates in|offices? in|locations? in)\b/.test(
      value,
    )
  )
    return "OPERATING_MODEL";
  if (
    /\b(we serve|serves|serving|our customers|our clients|our patients)\b/.test(
      value,
    )
  )
    return "CAPABILITY_OR_SCOPE_STATEMENT";
  if (
    /\b(we are|is a company|is an? (?:platform|company|brand|business|provider|service)|speciali[sz]es? in)\b/.test(
      value,
    )
  )
    return "COMPANY_DESCRIPTION";
  if (/\b(category|industry|market|sector)\b/.test(value))
    return "CATEGORY_OR_BUSINESS_CONTEXT";
  if (/\b(our values|principles|we value)\b/.test(value))
    return "STATED_PRINCIPLE";
  return null;
}

export class BrandCompanyContextNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.brand_company_context" as const;

  normalize(
    input: DataExtractionNormalizationInput,
  ): DataExtractionNormalizationResult {
    const drafts: NormalizedEvidenceDraft[] = [];
    for (const source of input.sources) {
      if (["LEGAL", "TESTIMONIAL"].includes(source.resource.pageRole ?? ""))
        continue;
      for (const text of sentences(source.normalizedText).slice(0, 100)) {
        const statementClass = companyStatementClass(text);
        if (!statementClass) continue;
        const assertionNature =
          statementClass === "STATED_PRINCIPLE" ||
          statementClass === "MISSION_OR_PURPOSE"
            ? "BRAND_AUTHORED_PRINCIPLE_OR_VALUE"
            : /\b(best|leading|number one|#1|guarantee|proven)\b/i.test(text)
              ? "BRAND_AUTHORED_MARKETING_ASSERTION"
              : "DIRECT_FIRST_PARTY_FACTUAL_STATEMENT";
        const subjectScope =
          /\b(headquartered|based in|operate in|locations? in)\b/i.test(text)
            ? "LOCATION_OR_MARKET_CONTEXT"
            : "COMPANY_LEVEL";
        const payload = {
          statement_text: text.slice(0, 280),
          verbatim_excerpt: text.slice(0, 280),
          statement_class: statementClass,
          assertion_nature: assertionNature,
          authorship_class: "BRAND_AUTHORED",
          subject_scope: subjectScope,
        } as const;
        drafts.push(
          draft(
            this.capabilityId,
            source,
            text,
            payload,
            sourceRepresentativeness(source, "COMPANY"),
            { polarity: polarityForStatement(text) },
          ),
        );
        if (
          drafts.filter((item) => item.source === source).length >=
          MAX_ITEMS_PER_RESOURCE
        )
          break;
      }
    }
    return {
      drafts: applyRepeatedRepresentativeness(drafts),
      reasonCodes: drafts.length ? [] : ["NO_QUALIFYING_COMPANY_CONTEXT"],
    };
  }
}

function offeringCandidate(
  text: string,
  source: DataExtractionNormalizationSource,
): boolean {
  const role = source.resource.pageRole ?? "OTHER";
  if (
    [
      "PORTFOLIO_OVERVIEW",
      "CATEGORY_OVERVIEW",
      "SERVICE_OVERVIEW",
      "SOLUTIONS_OVERVIEW",
      "PRICING_PLANS",
      "OFFERING_DETAIL",
    ].includes(role)
  ) {
    return text.length <= 220;
  }
  return /\b(product|service|solution|plan|pricing|subscription|collection|package|membership|book|shop)\b/i.test(
    text,
  );
}

export class OfferingContextNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "owned_website.offering_context" as const;

  normalize(
    input: DataExtractionNormalizationInput,
  ): DataExtractionNormalizationResult {
    const drafts: NormalizedEvidenceDraft[] = [];
    for (const source of input.sources) {
      const role = source.resource.pageRole ?? "OTHER";
      const canonicalOfferingRef = canonicalOfferingRefForSource(input, source);
      if (["LEGAL", "TESTIMONIAL", "POLICY"].includes(role)) continue;
      for (const text of sentences(source.normalizedText).slice(0, 80)) {
        if (!offeringCandidate(text, source)) continue;
        const generalizationScope =
          role === "OFFERING_DETAIL"
            ? "SINGLE_OFFERING"
            : [
                  "PORTFOLIO_OVERVIEW",
                  "CATEGORY_OVERVIEW",
                  "SERVICE_OVERVIEW",
                  "SOLUTIONS_OVERVIEW",
                  "PRICING_PLANS",
                ].includes(role)
              ? "MULTIPLE_OFFERINGS"
              : "SINGLE_OFFERING";
        const price = text.match(/(?:₹|\$|€|£)\s?\d[\d,.]*/)?.[0] ?? null;
        const title = text.length <= 90 ? text : null;
        const payload = {
          generalization_scope: generalizationScope,
          observed_context: text.slice(0, 280),
          observed_offering_title: title,
          observed_category: null,
          observed_description: text.slice(0, 280),
          feature_or_value_language: price ? [price] : [],
          portfolio_breadth_observation: null,
          repeated_offering_themes: [],
          canonical_offering_ref: canonicalOfferingRef,
        } as const;
        drafts.push(
          draft(
            this.capabilityId,
            source,
            text,
            payload,
            sourceRepresentativeness(source, "OFFERING"),
            { polarity: polarityForStatement(text) },
          ),
        );
        if (
          drafts.filter((item) => item.source === source).length >=
          MAX_ITEMS_PER_RESOURCE
        )
          break;
      }
    }
    return {
      drafts: applyRepeatedRepresentativeness(drafts),
      reasonCodes: drafts.length ? [] : ["NO_QUALIFYING_OFFERING_CONTEXT"],
    };
  }
}

function deterministicLanguageCode(text: string): string | null {
  const tokens = canonicalSemanticText(text).split(/\s+/).filter(Boolean);
  if (tokens.length < 20) return null;
  const latin =
    tokens.filter((token) => /^[a-z0-9'%-]+$/i.test(token)).length /
    tokens.length;
  const common = tokens.filter((token) => ENGLISH_COMMON.has(token)).length;
  return latin >= 0.9 && common >= Math.max(3, Math.floor(tokens.length * 0.02))
    ? "en"
    : null;
}

function parentMessagingRefsForSource(
  source: DataExtractionNormalizationSource,
  parentEvidence: readonly DataExtractionEvidenceItemRecord[],
): EvidenceRef[] {
  return parentEvidence
    .filter(
      (item) =>
        item.capabilityId === "owned_website.brand_messaging" &&
        item.resourceRef === source.resource.resourceRef &&
        item.captureRef === source.capture.captureRef,
    )
    .map((item) => item.evidenceRef);
}

export class CommunicationLanguageSignalsNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId =
    "observed_brand_communication_language_signals" as const;

  normalize(
    input: DataExtractionNormalizationInput,
  ): DataExtractionNormalizationResult {
    const drafts: NormalizedEvidenceDraft[] = [];
    for (const source of input.sources) {
      const messageRefs = parentMessagingRefsForSource(
        source,
        input.parentEvidence,
      );
      if (messageRefs.length === 0) continue;
      const htmlLang = source.acquiredSourceBody
        ?.match(/<html[^>]+lang=["']([a-zA-Z]{2})(?:-[a-zA-Z]{2})?["']/i)?.[1]
        ?.toLowerCase();
      const languageCode =
        htmlLang ?? deterministicLanguageCode(source.normalizedText);
      if (!languageCode) continue;
      const principal = representativePage(source.resource);
      const payload = {
        language_code: languageCode,
        signal_type: "PRINCIPAL_MESSAGING_LANGUAGE",
        surface_importance: principal ? "PRINCIPAL" : "SUPPORTING",
        repetition_count: 1,
        message_evidence_refs: [...new Set(messageRefs)].sort(),
        explicit_declaration_text: null,
        localization_variant_ref: null,
      } as const;
      const semantic = `${payload.signal_type}:${languageCode}:${payload.surface_importance}`;
      drafts.push(
        draft(
          this.capabilityId,
          source,
          semantic,
          payload,
          sourceRepresentativeness(source, "LANGUAGE"),
          { parentEvidenceRefs: messageRefs },
        ),
      );
    }
    return {
      drafts: applyRepeatedRepresentativeness(drafts),
      reasonCodes: drafts.length ? [] : ["NO_CONTRACT_VALID_LANGUAGE_SIGNAL"],
    };
  }
}

interface ConstraintMatch {
  readonly type:
    | "EXPLICIT_BRAND_AUTHORED_PROHIBITION"
    | "EXPLICIT_REQUIRED_TERMINOLOGY"
    | "EXPLICIT_CLAIM_OR_DISCLAIMER_RULE"
    | "PERSISTENT_OWNED_SOURCE_INSTRUCTION";
  readonly polarity: EvidencePolarity;
}

function constraintMatch(text: string): ConstraintMatch | null {
  const value = canonicalSemanticText(text);
  if (/\b(never|must not|do not|don't|prohibited|avoid)\b/.test(value)) {
    return {
      type: "EXPLICIT_BRAND_AUTHORED_PROHIBITION",
      polarity: "RESTRICTION",
    };
  }
  if (
    /\b(must|always|required to|use the term|refer to .* as|call .* a)\b/.test(
      value,
    )
  ) {
    return { type: "EXPLICIT_REQUIRED_TERMINOLOGY", polarity: "AFFIRMATIVE" };
  }
  if (
    /\b(disclaimer|claim|compliance|must include|must display)\b/.test(value) &&
    /\b(must|required|do not|never|always)\b/.test(value)
  ) {
    return {
      type: "EXPLICIT_CLAIM_OR_DISCLAIMER_RULE",
      polarity: "RESTRICTION",
    };
  }
  if (
    /\b(please use|we use only|we always say|our standard is)\b/.test(value)
  ) {
    return {
      type: "PERSISTENT_OWNED_SOURCE_INSTRUCTION",
      polarity: "AFFIRMATIVE",
    };
  }
  return null;
}

export class CommunicationConstraintEvidenceNormalizer implements DataExtractionEvidenceNormalizer {
  readonly capabilityId = "derived_communication_constraint_evidence" as const;

  normalize(
    input: DataExtractionNormalizationInput,
  ): DataExtractionNormalizationResult {
    const drafts: NormalizedEvidenceDraft[] = [];
    const parentsBySource = new Map<
      string,
      DataExtractionEvidenceItemRecord[]
    >();
    for (const item of input.parentEvidence) {
      if (
        ![
          "owned_website.brand_messaging",
          "owned_website.brand_company_context",
        ].includes(item.capabilityId)
      )
        continue;
      const key = `${item.resourceRef}|${item.captureRef}`;
      const values = parentsBySource.get(key) ?? [];
      values.push(item);
      parentsBySource.set(key, values);
    }

    for (const source of input.sources) {
      const canonicalOfferingRef = canonicalOfferingRefForSource(input, source);
      const parents =
        parentsBySource.get(
          `${source.resource.resourceRef}|${source.capture.captureRef}`,
        ) ?? [];
      if (parents.length === 0) continue;
      for (const parent of parents) {
        const payloadValue = parent.boundedNormalizedPayload ?? {};
        const text = String(
          payloadValue.text_or_normalized_message ??
            payloadValue.statement_text ??
            "",
        ).slice(0, 280);
        if (!text) continue;
        const match = constraintMatch(text);
        if (!match) continue;
        const parentRefs = [parent.evidenceRef];
        const normalizedConstraint = canonicalSemanticText(text).slice(0, 280);
        const payload = {
          constraint_signal_type: match.type,
          normalized_constraint_text: normalizedConstraint,
          verbatim_excerpt: text,
          explicitness: "EXPLICIT_SOURCE_STATEMENT",
          supporting_evidence_refs: parentRefs,
          supporting_resource_refs: [source.resource.resourceRef],
          repetition_count: 1,
          source_instruction_scope:
            source.resource.pageRole === "OFFERING_DETAIL"
              ? "OFFERING_SPECIFIC"
              : representativePage(source.resource)
                ? "BRAND_LEVEL"
                : "CONTEXT_SPECIFIC",
          canonical_offering_ref:
            source.resource.pageRole === "OFFERING_DETAIL"
              ? canonicalOfferingRef
              : null,
        } as const;
        drafts.push(
          draft(
            this.capabilityId,
            source,
            normalizedConstraint,
            payload,
            sourceRepresentativeness(source, "CONSTRAINT"),
            {
              polarity: match.polarity,
              parentEvidenceRefs: parentRefs,
              conflictFamily: match.type,
            },
          ),
        );
      }
    }
    return { drafts: applyRepeatedRepresentativeness(drafts), reasonCodes: [] };
  }
}

export const WAVE1_NORMALIZERS: readonly DataExtractionEvidenceNormalizer[] = [
  new BrandMessagingNormalizer(),
  new BrandCompanyContextNormalizer(),
  new OfferingContextNormalizer(),
  new CommunicationLanguageSignalsNormalizer(),
  new CommunicationConstraintEvidenceNormalizer(),
];

export function normalizerFor(
  capabilityId: EvidenceCapabilityId,
): DataExtractionEvidenceNormalizer {
  const normalizer = WAVE1_NORMALIZERS.find(
    (candidate) => candidate.capabilityId === capabilityId,
  );
  if (!normalizer) throw new Error(`UNSUPPORTED_NORMALIZER:${capabilityId}`);
  return normalizer;
}

export function conservativeQuality(
  sources: readonly DataExtractionNormalizationSource[],
): EvidenceAcquisitionQuality {
  if (sources.length === 0) {
    return {
      state: "UNAVAILABLE",
      failureCategories: ["INSUFFICIENT_RELEVANT_CONTENT"],
      detailCodes: ["NO_DURABLE_NORMALIZATION_SOURCE"],
    };
  }
  const states = sources.map(
    (source) => source.capture.acquisitionQuality.state,
  );
  const state = states.includes("UNAVAILABLE")
    ? "PARTIAL"
    : states.includes("DEGRADED")
      ? "DEGRADED"
      : states.includes("PARTIAL")
        ? "PARTIAL"
        : "COMPLETE";
  return {
    state,
    failureCategories: [
      ...new Set(
        sources.flatMap(
          (source) => source.capture.acquisitionQuality.failureCategories,
        ),
      ),
    ],
    detailCodes: [
      ...new Set(
        sources.flatMap(
          (source) => source.capture.acquisitionQuality.detailCodes,
        ),
      ),
    ],
  };
}
