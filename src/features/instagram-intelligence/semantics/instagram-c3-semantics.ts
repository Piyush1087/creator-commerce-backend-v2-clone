import { createHash } from "node:crypto";
import { z } from "zod";

import { canonicalJson } from "../../brand-intelligence/contracts/bundle/canonical-json";
import {
  InstagramLikelyCollabSchema,
  InstagramMediaObservationSchema,
  type InstagramMediaObservation,
} from "../contracts/instagram-intelligence.schemas";

export const INSTAGRAM_C3_CONTRACT_VERSION = "1.0" as const;
export const INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION = "1.0" as const;
export const INSTAGRAM_C3_PROMPT_PROFILE_VERSION =
  "instagram-c3-per-media-v1" as const;
export const INSTAGRAM_C3_NORMALIZATION_VERSION =
  "instagram.per-media-semantics.c3.v1" as const;

const MAX_LABEL = 120;
const MAX_SUPPORT = 240;
const MAX_VALUES = 12;
const modalitySchema = z.enum(["CAPTION", "VISUAL"]);
const confidenceSchema = z.enum(["LOW", "MEDIUM"]);
const forbiddenSemanticLanguage =
  /\b(?:recommend(?:ation)?|should|best|worst|top[- ]?perform|underperform|ranking|caused?|drives?|signal|pattern|learning|ignore\s+(?:previous|system)|system\s+prompt)\b/iu;
const boundedCandidateString = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine((value) => !forbiddenSemanticLanguage.test(value), {
      message: "Unsupported semantic or instruction language",
    });

const candidateValueSchema = z
  .object({
    label: boundedCandidateString(MAX_LABEL),
    confidence: confidenceSchema,
    supportModalities: z.array(modalitySchema).min(1).max(2),
  })
  .strict();

const presenceCandidateSchema = z
  .object({
    state: z.enum(["PRESENT", "POSSIBLE", "NOT_OBSERVED", "UNKNOWN"]),
    supportModalities: z
      .array(modalitySchema)
      .max(2)
      .refine((values) => new Set(values).size === values.length, {
        message: "Support modalities must be deduplicated",
      }),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      ["PRESENT", "POSSIBLE", "NOT_OBSERVED"].includes(value.state) &&
      value.supportModalities.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observed presence requires supporting modalities",
        path: ["supportModalities"],
      });
    }
    if (value.state === "UNKNOWN" && value.supportModalities.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unknown presence cannot claim supporting modalities",
        path: ["supportModalities"],
      });
    }
  });

const candidateCueSchema = z
  .object({
    signalClass: z.enum([
      "EXPLICIT_CAPTION_COLLAB_LANGUAGE",
      "EXPLICIT_PARTNERSHIP_DISCLOSURE",
      "JOINT_BRAND_CREATOR_APPEARANCE",
      "CREATOR_PRODUCT_DEMO_OR_TESTIMONIAL",
    ]),
    sourceModality: modalitySchema,
    support: boundedCandidateString(MAX_SUPPORT),
  })
  .strict();

/** Internal model output only. It deliberately has no identity, metric,
 * canonical-domain, Evidence-reference, or provider-truth fields. */
export const InstagramC3SemanticCandidateSchema = z
  .object({
    themes: z.array(candidateValueSchema).max(MAX_VALUES),
    captionPatterns: z.array(candidateValueSchema).max(MAX_VALUES),
    creativeStructures: z.array(candidateValueSchema).max(MAX_VALUES),
    visualExecutions: z.array(candidateValueSchema).max(MAX_VALUES),
    creatorRoleSignals: z.array(candidateValueSchema).max(MAX_VALUES),
    creatorPresence: presenceCandidateSchema,
    offeringPresence: presenceCandidateSchema,
    offeringName: z.string().trim().min(1).max(MAX_LABEL).nullable(),
    collaborationCues: z.array(candidateCueSchema).max(MAX_VALUES),
  })
  .strict();

export type InstagramC3SemanticCandidate = z.infer<
  typeof InstagramC3SemanticCandidateSchema
>;

export type InstagramC3FieldState = Readonly<{
  state: "AVAILABLE" | "UNKNOWN";
  reasonCodes: readonly string[];
  evidenceRefs: readonly string[];
  values: readonly Readonly<{
    semanticId: string;
    label: string;
    confidence: "LOW" | "MEDIUM";
    evidenceRefs: readonly string[];
  }>[];
}>;

export type InstagramC3AdmittedContext = Readonly<{
  caption: Readonly<{
    state: "AVAILABLE" | "EXPLICIT_EMPTY" | "UNKNOWN";
    text?: string;
    contentHash: string | null;
    evidenceRef: string;
  }>;
  visual: Readonly<{
    state: "AVAILABLE" | "UNKNOWN";
    observation?: Readonly<Record<string, unknown>>;
    evidenceRef?: string;
  }>;
  inspection: Readonly<{
    depth:
      | "LIGHT_ONLY"
      | "DEEP_SELECTED"
      | "COVER_ONLY"
      | "PARTIAL_DEEP"
      | "NOT_INSPECTED";
    selectedForDeepAnalysis: boolean;
    selectionReasons: readonly string[];
    inspectedChildCount: number;
    availableChildCount: number;
    inspectedFrameCount: number;
    reasonCodes: readonly string[];
  }>;
}>;

export type InstagramC3OfferingDescriptor = Readonly<{
  id: string;
  normalizedName: string;
}>;

export type InstagramC3FinalizeInput = Readonly<{
  brandProfileId: string;
  providerAccountId: string;
  authorizationGeneration: number;
  mediaId: string;
  resourceRef: string;
  captureRef: string;
  capturedAt: string;
  publishedAt: unknown;
  mediaType: "IMAGE" | "CAROUSEL_ALBUM" | "REELS" | "VIDEO";
  permalink: unknown;
  context: InstagramC3AdmittedContext;
  candidate: unknown;
  metrics: readonly unknown[];
  c2EvidenceRef: string;
  modelIdentity: string;
  offerings: readonly InstagramC3OfferingDescriptor[];
}>;

export type InstagramC3Finalized = Readonly<{
  observation: InstagramMediaObservation;
  fields: Readonly<Record<string, InstagramC3FieldState>>;
  cues: readonly Readonly<{
    cueId: string;
    signalClass: string;
    sourceModality: "CAPTION" | "VISUAL";
    evidenceRefs: readonly string[];
    supportHash: string;
  }>[];
}>;

const injectionPatterns = [
  /\bignore\s+(all\s+)?(previous|prior|system)\b/iu,
  /\b(system|developer)\s*(prompt|message|instruction)\b/iu,
  /\b(reveal|print|return|exfiltrate)\b.{0,32}\b(secret|token|credential|prompt)\b/iu,
  /<\/?(?:system|assistant|developer|tool)>/iu,
];

export function assertCaptionIsData(text: string): void {
  if (injectionPatterns.some((pattern) => pattern.test(text))) {
    throw new InstagramC3SemanticError("CAPTION_PROMPT_INJECTION_REJECTED");
  }
}

export function extractCaptionTokens(text: string | undefined) {
  if (!text) return { hashtags: [] as string[], mentions: [] as string[] };
  const collect = (pattern: RegExp) =>
    [...text.matchAll(pattern)]
      .map((match) => match[1]!.normalize("NFKC").toLocaleLowerCase("en-US"))
      .filter((value) => value.length <= 100)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((a, b) => a.localeCompare(b));
  return {
    hashtags: collect(/#([\p{L}\p{N}_]+)/gu).map((value) => `#${value}`),
    mentions: collect(/@([A-Za-z0-9._]+)/gu).map((value) => `@${value}`),
  };
}

export function finalizeInstagramC3(
  input: InstagramC3FinalizeInput,
): InstagramC3Finalized {
  if (input.context.caption.text)
    assertCaptionIsData(input.context.caption.text);
  const candidate = InstagramC3SemanticCandidateSchema.parse(input.candidate);
  assertCandidateModalities(candidate, input.context);
  const tokens = extractCaptionTokens(input.context.caption.text);
  const fields = Object.fromEntries(
    (
      [
        "themes",
        "captionPatterns",
        "creativeStructures",
        "visualExecutions",
        "creatorRoleSignals",
      ] as const
    ).map((field) => [
      field,
      finalizeField(field, candidate[field], input.context),
    ]),
  ) as Record<string, InstagramC3FieldState>;
  const deterministicMentionCues = tokens.mentions.map((mention) => ({
    signalClass: "MENTION_ONLY" as const,
    sourceModality: "CAPTION" as const,
    support: mention,
  }));
  const cues = finalizeCues(
    [...candidate.collaborationCues, ...deterministicMentionCues],
    input.context,
  );
  const likelyCollab = finalizeLikelyCollab(cues, input.context);
  const offeringPresence = finalizeOffering(
    candidate,
    input.offerings,
    input.context,
  );
  const creatorEvidence = supportingRefsForPresence(
    candidate.creatorPresence,
    input.context,
  );
  const observation = InstagramMediaObservationSchema.parse({
    contractVersion: INSTAGRAM_C3_CONTRACT_VERSION,
    observationProfileVersion: INSTAGRAM_C3_OBSERVATION_PROFILE_VERSION,
    sourceScope: "INSTAGRAM_OWNED",
    brandProfileId: input.brandProfileId,
    providerAccountId: input.providerAccountId,
    mediaId: input.mediaId,
    resourceRef: input.resourceRef,
    captureRef: input.captureRef,
    authorizationGeneration: input.authorizationGeneration,
    capturedAt: input.capturedAt,
    publishedAt: input.publishedAt,
    mediaType: input.mediaType,
    permalink: input.permalink,
    caption:
      input.context.caption.state === "AVAILABLE"
        ? { state: "AVAILABLE", value: input.context.caption.text ?? "" }
        : input.context.caption.state === "EXPLICIT_EMPTY"
          ? { state: "EXPLICIT_NULL", reasonCode: "INTENTIONAL_ABSENCE" }
          : { state: "UNKNOWN", reasonCode: "INSUFFICIENT_EVIDENCE" },
    captionContentHash: input.context.caption.contentHash,
    hashtags: tokens.hashtags,
    mentions: tokens.mentions,
    themes: fields.themes!.values,
    captionPatterns: fields.captionPatterns!.values,
    creativeStructures: fields.creativeStructures!.values,
    visualExecutions: fields.visualExecutions!.values,
    creatorRoleSignals: fields.creatorRoleSignals!.values,
    creatorPresence: {
      state: safeNegativePresence(candidate.creatorPresence, input.context),
      reasonCodes:
        candidate.creatorPresence.state === "UNKNOWN"
          ? ["INSUFFICIENT_EVIDENCE"]
          : [],
      evidenceRefs: creatorEvidence,
    },
    offeringPresence,
    likelyCollab,
    metrics: input.metrics,
    inspection: input.context.inspection,
    evidenceRefs: sortedUnique([
      input.context.caption.evidenceRef,
      ...(input.context.visual.evidenceRef
        ? [input.context.visual.evidenceRef]
        : []),
      input.c2EvidenceRef,
    ]),
    derivationVersions: {
      contract: INSTAGRAM_C3_CONTRACT_VERSION,
      artifact: INSTAGRAM_C3_NORMALIZATION_VERSION,
      model: input.modelIdentity,
      promptOrProfile: INSTAGRAM_C3_PROMPT_PROFILE_VERSION,
    },
  });
  return { observation, fields, cues };
}

function finalizeField(
  field: string,
  values: readonly z.infer<typeof candidateValueSchema>[],
  context: InstagramC3AdmittedContext,
): InstagramC3FieldState {
  const normalized = new Map<string, z.infer<typeof candidateValueSchema>>();
  for (const value of values) {
    const label = normalizeLabel(value.label);
    const key = label.toLocaleLowerCase("en-US");
    const prior = normalized.get(key);
    const modalities = sortedUnique(value.supportModalities);
    if (!prior || modalities.length > prior.supportModalities.length) {
      normalized.set(key, { ...value, label, supportModalities: modalities });
    }
  }
  const mapped = [...normalized.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((value) => {
      const refs = modalityRefs(value.supportModalities, context);
      return {
        semanticId: `${field}.${slug(value.label)}`,
        label: value.label,
        confidence: refs.length >= 2 ? ("MEDIUM" as const) : ("LOW" as const),
        evidenceRefs: refs,
      };
    });
  return mapped.length
    ? {
        state: "AVAILABLE",
        reasonCodes: [],
        evidenceRefs: sortedUnique(mapped.flatMap((v) => v.evidenceRefs)),
        values: mapped,
      }
    : {
        state: "UNKNOWN",
        reasonCodes: ["INSUFFICIENT_EVIDENCE"],
        evidenceRefs: [],
        values: [],
      };
}

function finalizeCues(
  values: readonly Readonly<{
    signalClass:
      | InstagramC3SemanticCandidate["collaborationCues"][number]["signalClass"]
      | "MENTION_ONLY";
    sourceModality: "CAPTION" | "VISUAL";
    support: string;
  }>[],
  context: InstagramC3AdmittedContext,
) {
  const unique = new Map<string, ReturnType<typeof cueRecord>>();
  for (const cue of values) {
    const record = cueRecord(cue, context);
    // One source cue/span is one vote even if repeated or relabelled.
    const spanKey = `${cue.sourceModality}:${record.supportHash}`;
    if (!unique.has(spanKey)) unique.set(spanKey, record);
  }
  return [...unique.values()].sort((a, b) => a.cueId.localeCompare(b.cueId));
}

function cueRecord(
  cue: Readonly<{
    signalClass:
      | InstagramC3SemanticCandidate["collaborationCues"][number]["signalClass"]
      | "MENTION_ONLY";
    sourceModality: "CAPTION" | "VISUAL";
    support: string;
  }>,
  context: InstagramC3AdmittedContext,
) {
  const support = normalizeLabel(cue.support);
  assertCueGrounding(cue.signalClass, cue.sourceModality, support, context);
  const supportHash = digest(support.toLocaleLowerCase("en-US"));
  const evidenceRefs = modalityRefs([cue.sourceModality], context);
  if (evidenceRefs.length === 0)
    throw new InstagramC3SemanticError("UNGROUNDED_CUE_SUPPORT");
  return {
    cueId: `instagram-c3-cue:${digest(`${cue.sourceModality}:${cue.signalClass}:${supportHash}`)}`,
    signalClass: cue.signalClass,
    sourceModality: cue.sourceModality,
    evidenceRefs,
    supportHash,
  } as const;
}

export function finalizeLikelyCollab(
  cues: readonly Readonly<{
    cueId: string;
    signalClass: string;
    evidenceRefs: readonly string[];
  }>[],
  context: InstagramC3AdmittedContext,
) {
  const classes = sortedUnique(cues.map((cue) => cue.signalClass));
  const refs = sortedUnique(cues.flatMap((cue) => cue.evidenceRefs));
  const provider = classes.includes("PROVIDER_COLLABORATOR_RELATION");
  const explicit = classes.some((value) =>
    [
      "PROVIDER_COLLABORATOR_RELATION",
      "EXPLICIT_CAPTION_COLLAB_LANGUAGE",
      "EXPLICIT_PARTNERSHIP_DISCLOSURE",
      "CREATOR_PRODUCT_DEMO_OR_TESTIMONIAL",
    ].includes(value),
  );
  const completeNegative =
    context.caption.state !== "UNKNOWN" &&
    context.inspection.selectedForDeepAnalysis &&
    context.visual.state === "AVAILABLE" &&
    context.inspection.depth === "DEEP_SELECTED";
  const common = {
    canonicalCreatorId: null,
    canonicalCreatorMatch: "NONE" as const,
    canonicalCollaborationId: null,
    canonicalCollaborationMatch: "NONE" as const,
    negativeEvidence: {
      captionInspected: context.caption.state !== "UNKNOWN",
      requiredSelectedMediaInspected: completeNegative,
    },
  };
  const result = provider
    ? {
        ...common,
        state: "LIKELY_COLLAB",
        confidence: "HIGH",
        signalClasses: classes,
        reasonCodes: [],
        evidenceRefs: refs,
      }
    : classes.length >= 2 && explicit
      ? {
          ...common,
          state: "LIKELY_COLLAB",
          confidence: "MEDIUM",
          signalClasses: classes,
          reasonCodes: [],
          evidenceRefs: refs,
        }
      : classes.length > 0
        ? {
            ...common,
            state: "POSSIBLE_COLLAB",
            confidence: "LOW",
            signalClasses: classes,
            reasonCodes: [],
            evidenceRefs: refs,
          }
        : completeNegative
          ? {
              ...common,
              state: "NO_COLLAB_SIGNAL",
              confidence: "LOW",
              signalClasses: [],
              reasonCodes: [],
              evidenceRefs: sortedUnique([
                context.caption.evidenceRef,
                context.visual.evidenceRef!,
              ]),
            }
          : {
              ...common,
              state: "UNKNOWN",
              confidence: null,
              signalClasses: [],
              reasonCodes: ["INSUFFICIENT_EVIDENCE"],
              evidenceRefs: [],
            };
  return InstagramLikelyCollabSchema.parse(result);
}

function finalizeOffering(
  candidate: InstagramC3SemanticCandidate,
  offerings: readonly InstagramC3OfferingDescriptor[],
  context: InstagramC3AdmittedContext,
) {
  const state = safeNegativePresence(candidate.offeringPresence, context);
  const normalized = candidate.offeringName
    ? normalizeName(candidate.offeringName)
    : null;
  const matches = normalized
    ? offerings.filter((item) => item.normalizedName === normalized)
    : [];
  const sourceGrounded =
    normalized !== null &&
    candidate.offeringPresence.supportModalities.some((modality) =>
      modalityContains(modality, normalized, context),
    );
  const exact =
    state === "PRESENT" && matches.length === 1 && sourceGrounded
      ? matches[0]
      : null;
  return {
    state,
    canonicalOfferingId: exact?.id ?? null,
    canonicalOfferingMatch: exact
      ? ("EXACT_PREEXISTING" as const)
      : ("NONE" as const),
    reasonCodes:
      state === "UNKNOWN"
        ? ["INSUFFICIENT_EVIDENCE" as const]
        : candidate.offeringName && !exact
          ? ["OFFERING_MATCH_UNVERIFIED" as const]
          : [],
    evidenceRefs: supportingRefsForPresence(
      candidate.offeringPresence,
      context,
    ),
  };
}

function assertCandidateModalities(
  candidate: InstagramC3SemanticCandidate,
  context: InstagramC3AdmittedContext,
) {
  const values = [
    ...candidate.themes,
    ...candidate.captionPatterns,
    ...candidate.creativeStructures,
    ...candidate.visualExecutions,
    ...candidate.creatorRoleSignals,
  ];
  const modalities = [
    ...values.flatMap((value) => value.supportModalities),
    ...candidate.collaborationCues.map((cue) => cue.sourceModality),
  ];
  if (
    (modalities.includes("CAPTION") && context.caption.state !== "AVAILABLE") ||
    (modalities.includes("VISUAL") && context.visual.state !== "AVAILABLE")
  ) {
    throw new InstagramC3SemanticError("UNSUPPORTED_MODALITY_CLAIM");
  }
  for (const presence of [
    candidate.creatorPresence,
    candidate.offeringPresence,
  ]) {
    if (
      presence.supportModalities.includes("CAPTION") &&
      (presence.state === "PRESENT" || presence.state === "POSSIBLE") &&
      context.caption.state !== "AVAILABLE"
    )
      throw new InstagramC3SemanticError("UNSUPPORTED_MODALITY_CLAIM");
    if (
      presence.supportModalities.includes("VISUAL") &&
      context.visual.state !== "AVAILABLE"
    )
      throw new InstagramC3SemanticError("UNSUPPORTED_MODALITY_CLAIM");
    if (
      presence.state === "NOT_OBSERVED" &&
      (!context.inspection.selectedForDeepAnalysis ||
        context.visual.state !== "AVAILABLE" ||
        context.caption.state === "UNKNOWN" ||
        context.inspection.depth !== "DEEP_SELECTED" ||
        presence.supportModalities.length !== 2 ||
        !presence.supportModalities.includes("CAPTION") ||
        !presence.supportModalities.includes("VISUAL"))
    )
      throw new InstagramC3SemanticError("INCOMPLETE_NEGATIVE_EVIDENCE");
  }
}

function modalityRefs(
  modalities: readonly ("CAPTION" | "VISUAL")[],
  context: InstagramC3AdmittedContext,
) {
  return sortedUnique(
    modalities.flatMap((modality) =>
      modality === "CAPTION"
        ? [context.caption.evidenceRef]
        : context.visual.evidenceRef
          ? [context.visual.evidenceRef]
          : [],
    ),
  );
}

function supportingRefsForPresence(
  candidate: z.infer<typeof presenceCandidateSchema>,
  context: InstagramC3AdmittedContext,
) {
  if (candidate.state === "UNKNOWN") return [];
  const refs = modalityRefs(candidate.supportModalities, context);
  if (refs.length === 0)
    throw new InstagramC3SemanticError("UNSUPPORTED_MODALITY_CLAIM");
  return refs;
}

function safeNegativePresence(
  candidate: z.infer<typeof presenceCandidateSchema>,
  context: InstagramC3AdmittedContext,
) {
  return candidate.state === "NOT_OBSERVED" &&
    (!context.inspection.selectedForDeepAnalysis ||
      context.visual.state !== "AVAILABLE" ||
      context.caption.state === "UNKNOWN" ||
      context.inspection.depth !== "DEEP_SELECTED")
    ? ("UNKNOWN" as const)
    : candidate.state;
}

function assertCueGrounding(
  signalClass: string,
  modality: "CAPTION" | "VISUAL",
  support: string,
  context: InstagramC3AdmittedContext,
) {
  if (
    (signalClass === "EXPLICIT_CAPTION_COLLAB_LANGUAGE" &&
      modality !== "CAPTION") ||
    (signalClass === "JOINT_BRAND_CREATOR_APPEARANCE" &&
      modality !== "VISUAL") ||
    (signalClass === "MENTION_ONLY" && modality !== "CAPTION")
  )
    throw new InstagramC3SemanticError("CUE_MODALITY_MISMATCH");
  if (!modalityContains(modality, normalizeName(support), context))
    throw new InstagramC3SemanticError("UNGROUNDED_CUE_SUPPORT");
}

function modalityContains(
  modality: "CAPTION" | "VISUAL",
  normalizedNeedle: string,
  context: InstagramC3AdmittedContext,
) {
  if (modality === "CAPTION")
    return (
      context.caption.state === "AVAILABLE" &&
      normalizeName(context.caption.text ?? "").includes(normalizedNeedle)
    );
  return (
    context.visual.state === "AVAILABLE" &&
    visualStrings(context.visual.observation).some((value) =>
      normalizeName(value).includes(normalizedNeedle),
    )
  );
}

function visualStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(visualStrings);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(visualStrings);
  return [];
}

export function normalizeName(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
}
function normalizeLabel(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ");
}
function slug(value: string) {
  return (
    normalizeName(value)
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "")
      .slice(0, 80) || digest(value).slice(0, 16)
  );
}
export function digestCanonical(value: unknown) {
  return digest(canonicalJson(value));
}
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export class InstagramC3SemanticError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "InstagramC3SemanticError";
  }
}
