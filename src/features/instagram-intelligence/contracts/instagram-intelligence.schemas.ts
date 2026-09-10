import { z } from "zod";

import {
  INSTAGRAM_DEEP_SELECTION_REASONS,
  INSTAGRAM_INTELLIGENCE_REASON_CODES,
  INSTAGRAM_INTELLIGENCE_V1_CONSTANTS,
} from "./instagram-intelligence.constants";
import {
  INSTAGRAM_INTELLIGENCE_OBJECT_IDS,
  INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY,
  INSTAGRAM_SYNC_CAPABILITY_CLASSES,
} from "./instagram-intelligence.registry";

const identifierSchema = z.string().min(1);
const timestampSchema = z.string().datetime();
const reasonCodeSchema = z.enum(INSTAGRAM_INTELLIGENCE_REASON_CODES);
const evidenceRefsSchema = z.array(identifierSchema);
const nonNullAvailableValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

export const InstagramSourceValueSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("AVAILABLE"),
      value: nonNullAvailableValueSchema,
    })
    .strict(),
  z
    .object({ state: z.literal("EXPLICIT_NULL"), reasonCode: reasonCodeSchema })
    .strict(),
  z
    .object({ state: z.literal("UNKNOWN"), reasonCode: reasonCodeSchema })
    .strict(),
  z
    .object({ state: z.literal("NOT_INSPECTED"), reasonCode: reasonCodeSchema })
    .strict(),
  z
    .object({
      state: z.literal("INTENTIONALLY_ABSENT"),
      reasonCode: reasonCodeSchema,
    })
    .strict(),
]);

export const InstagramObservedMetricSchema = z.discriminatedUnion(
  "availability",
  [
    z
      .object({
        availability: z.literal("OBSERVED"),
        metricId: identifierSchema,
        value: z.number().positive(),
        unit: z.enum(["COUNT", "PERCENT", "SECONDS", "RATIO"]),
        denominator: InstagramSourceValueSchema,
        evidenceRefs: evidenceRefsSchema.min(1),
      })
      .strict(),
    z
      .object({
        availability: z.literal("OBSERVED_ZERO"),
        metricId: identifierSchema,
        value: z.literal(0),
        unit: z.enum(["COUNT", "PERCENT", "SECONDS", "RATIO"]),
        denominator: InstagramSourceValueSchema,
        evidenceRefs: evidenceRefsSchema.min(1),
      })
      .strict(),
    z
      .object({
        availability: z.enum([
          "UNAVAILABLE",
          "PROVIDER_FAILURE",
          "UNSUPPORTED",
        ]),
        metricId: identifierSchema,
        reasonCode: reasonCodeSchema,
        evidenceRefs: evidenceRefsSchema,
      })
      .strict(),
  ],
);

const boundedSemanticValueSchema = z
  .object({
    semanticId: identifierSchema,
    label: z.string().min(1),
    confidence: z.enum(["LOW", "MEDIUM"]),
    evidenceRefs: evidenceRefsSchema.min(1),
  })
  .strict();

const offeringPresenceSchema = z
  .object({
    state: z.enum(["PRESENT", "POSSIBLE", "NOT_OBSERVED", "UNKNOWN"]),
    canonicalOfferingId: z.string().uuid().nullable(),
    canonicalOfferingMatch: z.enum(["EXACT_PREEXISTING", "NONE"]),
    reasonCodes: z.array(reasonCodeSchema),
    evidenceRefs: evidenceRefsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state !== "PRESENT" && value.canonicalOfferingId !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Only exact PRESENT Offering evidence may carry a canonical ID",
        path: ["canonicalOfferingId"],
      });
    }
    if (
      (value.canonicalOfferingMatch === "EXACT_PREEXISTING") !==
      (value.canonicalOfferingId !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Canonical Offering ID requires an exact pre-existing identity match",
        path: ["canonicalOfferingMatch"],
      });
    }
  });

export const InstagramLikelyCollabSchema = z
  .object({
    state: z.enum([
      "LIKELY_COLLAB",
      "POSSIBLE_COLLAB",
      "NO_COLLAB_SIGNAL",
      "UNKNOWN",
    ]),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
    signalClasses: z.array(
      z.enum([
        "PROVIDER_COLLABORATOR_RELATION",
        "EXPLICIT_CAPTION_COLLAB_LANGUAGE",
        "EXPLICIT_PARTNERSHIP_DISCLOSURE",
        "JOINT_BRAND_CREATOR_APPEARANCE",
        "CREATOR_PRODUCT_DEMO_OR_TESTIMONIAL",
        "MENTION_ONLY",
      ]),
    ),
    canonicalCreatorId: z.string().uuid().nullable(),
    canonicalCreatorMatch: z.enum(["EXACT_PREEXISTING", "NONE"]),
    canonicalCollaborationId: z.string().uuid().nullable(),
    canonicalCollaborationMatch: z.enum(["EXACT_PREEXISTING", "NONE"]),
    reasonCodes: z.array(reasonCodeSchema),
    evidenceRefs: evidenceRefsSchema,
    negativeEvidence: z
      .object({
        captionInspected: z.boolean(),
        requiredSelectedMediaInspected: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state === "UNKNOWN" && value.confidence !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unknown likely-collab state cannot carry confidence",
        path: ["confidence"],
      });
    }
    if (value.state !== "UNKNOWN" && value.confidence === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An observed likely-collab state requires confidence",
        path: ["confidence"],
      });
    }
    if (value.state === "UNKNOWN" && value.reasonCodes.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unknown likely-collab state requires an evidence limitation",
        path: ["reasonCodes"],
      });
    }
    if (value.state === "UNKNOWN" && value.signalClasses.length !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unknown likely-collab state cannot carry a positive signal",
        path: ["signalClasses"],
      });
    }
    if (value.state === "POSSIBLE_COLLAB" && value.signalClasses.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Possible collaboration requires at least one positive signal",
        path: ["signalClasses"],
      });
    }
    if (
      value.state === "NO_COLLAB_SIGNAL" &&
      (value.evidenceRefs.length === 0 ||
        value.signalClasses.length !== 0 ||
        !value.negativeEvidence.captionInspected ||
        !value.negativeEvidence.requiredSelectedMediaInspected)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "No-signal requires successful caption and selected-media inspection with no positive class",
        path: ["negativeEvidence"],
      });
    }
    const uniqueSignals = new Set(value.signalClasses);
    const providerSignal = uniqueSignals.has("PROVIDER_COLLABORATOR_RELATION");
    const explicitSignalClasses: ReadonlySet<string> = new Set([
      "PROVIDER_COLLABORATOR_RELATION",
      "EXPLICIT_CAPTION_COLLAB_LANGUAGE",
      "EXPLICIT_PARTNERSHIP_DISCLOSURE",
      "CREATOR_PRODUCT_DEMO_OR_TESTIMONIAL",
    ]);
    const explicitSignal = value.signalClasses.some((signal) =>
      explicitSignalClasses.has(signal),
    );
    if (
      value.state === "LIKELY_COLLAB" &&
      !providerSignal &&
      (uniqueSignals.size < 2 || !explicitSignal)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Likely collaboration requires provider metadata or two independent classes including an explicit cue",
        path: ["signalClasses"],
      });
    }
    if (
      value.confidence === "HIGH" &&
      (value.state !== "LIKELY_COLLAB" || !providerSignal)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "High confidence requires verified provider collaborator metadata",
        path: ["confidence"],
      });
    }
    if (
      value.state === "LIKELY_COLLAB" &&
      ((providerSignal && value.confidence !== "HIGH") ||
        (!providerSignal && value.confidence !== "MEDIUM"))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Likely collaboration confidence is HIGH for provider relation and MEDIUM for multi-signal inference",
        path: ["confidence"],
      });
    }
    if (
      ["POSSIBLE_COLLAB", "NO_COLLAB_SIGNAL"].includes(value.state) &&
      value.confidence !== "LOW"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Possible/no-signal collaboration confidence is LOW",
        path: ["confidence"],
      });
    }
    for (const [id, match, path] of [
      [
        value.canonicalCreatorId,
        value.canonicalCreatorMatch,
        "canonicalCreatorMatch",
      ],
      [
        value.canonicalCollaborationId,
        value.canonicalCollaborationMatch,
        "canonicalCollaborationMatch",
      ],
    ] as const) {
      if ((match === "EXACT_PREEXISTING") !== (id !== null)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Canonical identity requires an exact pre-existing link",
          path: [path],
        });
      }
    }
  });

export const InstagramMediaObservationSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    observationProfileVersion: z.literal("1.0"),
    sourceScope: z.literal("INSTAGRAM_OWNED"),
    brandProfileId: z.string().uuid(),
    providerAccountId: identifierSchema,
    mediaId: identifierSchema,
    resourceRef: identifierSchema,
    captureRef: identifierSchema,
    authorizationGeneration: z.number().int().positive(),
    capturedAt: timestampSchema,
    publishedAt: InstagramSourceValueSchema,
    mediaType: z.enum(["IMAGE", "CAROUSEL_ALBUM", "REELS", "VIDEO"]),
    permalink: InstagramSourceValueSchema,
    caption: InstagramSourceValueSchema,
    captionContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .nullable(),
    hashtags: z.array(z.string().min(1)),
    mentions: z.array(z.string().min(1)),
    themes: z.array(boundedSemanticValueSchema),
    captionPatterns: z.array(boundedSemanticValueSchema),
    creativeStructures: z.array(boundedSemanticValueSchema),
    visualExecutions: z.array(boundedSemanticValueSchema),
    creatorRoleSignals: z.array(boundedSemanticValueSchema),
    creatorPresence: z
      .object({
        state: z.enum(["PRESENT", "POSSIBLE", "NOT_OBSERVED", "UNKNOWN"]),
        reasonCodes: z.array(reasonCodeSchema),
        evidenceRefs: evidenceRefsSchema,
      })
      .strict(),
    offeringPresence: offeringPresenceSchema,
    likelyCollab: InstagramLikelyCollabSchema,
    metrics: z.array(InstagramObservedMetricSchema),
    inspection: z
      .object({
        depth: z.enum([
          "LIGHT_ONLY",
          "DEEP_SELECTED",
          "COVER_ONLY",
          "PARTIAL_DEEP",
          "NOT_INSPECTED",
        ]),
        selectedForDeepAnalysis: z.boolean(),
        selectionReasons: z.array(z.enum(INSTAGRAM_DEEP_SELECTION_REASONS)),
        inspectedChildCount: z.number().int().nonnegative(),
        availableChildCount: z.number().int().nonnegative(),
        inspectedFrameCount: z.number().int().nonnegative(),
        reasonCodes: z.array(reasonCodeSchema),
      })
      .strict(),
    evidenceRefs: evidenceRefsSchema.min(1),
    derivationVersions: z
      .object({
        contract: z.literal("1.0"),
        artifact: z.string().min(1),
        model: z.string().min(1).nullable(),
        promptOrProfile: z.string().min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      !value.inspection.selectedForDeepAnalysis &&
      !["LIGHT_ONLY", "NOT_INSPECTED"].includes(value.inspection.depth)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unselected media must remain light-only",
        path: ["inspection", "depth"],
      });
    }
    if (
      value.caption.state === "AVAILABLE" &&
      value.captionContentHash === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Available caption text requires its content hash",
        path: ["captionContentHash"],
      });
    }
    if (
      value.caption.state !== "AVAILABLE" &&
      value.captionContentHash !== null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unavailable caption state cannot carry a content hash",
        path: ["captionContentHash"],
      });
    }
    if (
      value.creatorPresence.state === "NOT_OBSERVED" &&
      ["LIGHT_ONLY", "NOT_INSPECTED", "COVER_ONLY"].includes(
        value.inspection.depth,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Visual creator absence requires successful selected-media inspection",
        path: ["creatorPresence", "state"],
      });
    }
    if (
      value.inspection.inspectedChildCount >
      value.inspection.availableChildCount
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inspected carousel children cannot exceed available children",
        path: ["inspection", "inspectedChildCount"],
      });
    }
  });

const coverageSchema = z
  .object({
    state: z.enum(["COMPLETE", "PARTIAL", "UNAVAILABLE"]),
    eligibleCount: z.number().int().nonnegative(),
    observedCount: z.number().int().nonnegative(),
    coveragePercent: z.number().min(0).max(100).nullable(),
    reasonCodes: z.array(reasonCodeSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.eligibleCount === 0 && value.coveragePercent !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Coverage percentage is unknown when no denominator exists",
        path: ["coveragePercent"],
      });
    }
    if (value.observedCount > value.eligibleCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Observed count cannot exceed eligible count",
        path: ["observedCount"],
      });
    }
  });

export const InstagramResultSchema = z
  .object({
    kind: z.literal("RESULT"),
    semanticId: identifierSchema,
    value: z.number(),
    unit: z.enum(["COUNT", "PERCENT", "SECONDS", "RATIO"]),
    sampleSize: z.number().int().nonnegative(),
    evidenceRefs: evidenceRefsSchema.min(1),
  })
  .strict();

export const InstagramSignalSchema = z
  .object({
    kind: z.literal("SIGNAL"),
    semanticId: identifierSchema,
    statement: z.string().min(1),
    confidence: z.enum(["LOW", "MEDIUM"]),
    sampleSize: z
      .number()
      .int()
      .min(INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.minimumSignalSample),
    comparisonCohortSizes: z
      .array(
        z
          .number()
          .int()
          .min(
            INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.minimumComparableCohortSample,
          ),
      )
      .max(2),
    metricCoveragePercent: z
      .number()
      .min(INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.minimumMetricCoveragePercent)
      .max(100),
    publicationDateCount: z.number().int().positive(),
    evidenceRefs: evidenceRefsSchema.min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.confidence === "MEDIUM" &&
      (value.sampleSize <
        INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.mediumConfidenceMinimumSample ||
        value.metricCoveragePercent <
          INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.mediumConfidenceMinimumCoveragePercent ||
        value.publicationDateCount <
          INSTAGRAM_INTELLIGENCE_V1_CONSTANTS.mediumConfidenceMinimumPublicationDates)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Medium confidence requires n>=5, coverage>=70%, and two publication dates",
        path: ["confidence"],
      });
    }
  });

export const InstagramLearningSchema = z
  .object({
    kind: z.literal("LEARNING"),
    semanticId: identifierSchema,
    statement: z.string().min(1),
    confidence: z.enum(["LOW", "MEDIUM"]),
    supportingSignalIds: z.array(identifierSchema).min(1),
    evidenceRefs: evidenceRefsSchema.min(1),
  })
  .strict();

export const InstagramIntelligenceObjectSchema = z
  .object({
    semanticId: z.enum(INSTAGRAM_INTELLIGENCE_OBJECT_IDS),
    objectContractVersion: z.literal("1.0"),
    outputContractVersion: z.literal("1.0"),
    sourceScope: z.literal("INSTAGRAM_OWNED"),
    state: z.enum(["NO_CURRENT", "PARTIAL_CURRENT", "CURRENT"]),
    readiness: z.enum(["NOT_READY", "PARTIAL", "READY"]),
    freshness: z.enum(["UNKNOWN", "CURRENT", "STALE"]),
    currentPreserved: z.boolean(),
    generatedAt: timestampSchema.nullable(),
    window: z
      .object({
        start: timestampSchema,
        end: timestampSchema,
        days: z.literal(30),
      })
      .strict(),
    results: z.array(InstagramResultSchema),
    signals: z.array(InstagramSignalSchema),
    learnings: z.array(InstagramLearningSchema),
    components: z.record(InstagramSourceValueSchema),
    coverage: coverageSchema,
    evidenceRefs: evidenceRefsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const definition = INSTAGRAM_INTELLIGENCE_OBJECT_REGISTRY.find(
      (entry) => entry.semanticId === value.semanticId,
    );
    const allowed: ReadonlySet<string> = new Set(definition?.components ?? []);
    for (const component of Object.keys(value.components)) {
      if (!allowed.has(component)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${component} is not registered for ${value.semanticId}`,
          path: ["components", component],
        });
      }
    }
    for (const component of allowed) {
      if (!(component in value.components)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${component} must have an explicit value or absence state`,
          path: ["components", component],
        });
      }
    }
  });

export const InstagramSyncStateContractSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    brandProfileId: z.string().uuid(),
    integrationId: z.string().uuid(),
    providerAccountId: identifierSchema,
    authorizationGeneration: z.number().int().positive(),
    capabilityClass: z.enum(INSTAGRAM_SYNC_CAPABILITY_CLASSES),
    status: z.enum([
      "PENDING",
      "DUE",
      "RUNNING",
      "BACKOFF",
      "BLOCKED_AUTHORIZATION",
      "COMPLETED",
    ]),
    trigger: z.enum(["INITIAL_CONNECT", "SCHEDULED", "MANUAL", "RECONNECT"]),
    lastAttemptAt: timestampSchema.nullable(),
    lastSuccessAt: timestampSchema.nullable(),
    nextDueAt: timestampSchema.nullable(),
    backoffUntil: timestampSchema.nullable(),
    cursor: z.string().min(1).nullable(),
    leaseToken: z.string().min(1).nullable(),
    leaseExpiresAt: timestampSchema.nullable(),
    attemptCount: z.number().int().nonnegative(),
    consecutiveFailures: z.number().int().nonnegative(),
    lastCompletedGenerationIds: z.array(identifierSchema),
    reasonCodes: z.array(reasonCodeSchema),
  })
  .strict();

const accountFactSchema = z
  .object({
    semanticId: identifierSchema,
    value: InstagramSourceValueSchema,
    observedAt: timestampSchema.nullable(),
    evidenceRefs: evidenceRefsSchema,
  })
  .strict();

const refreshActionSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("ALLOWED"),
      cooldownEndsAt: timestampSchema.nullable(),
    })
    .strict(),
  z
    .object({ state: z.literal("DENIED"), reasonCode: reasonCodeSchema })
    .strict(),
]);

export const InstagramWorkspaceConsumerSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    connection: z
      .object({
        state: z.enum([
          "NOT_CONNECTED",
          "CONNECTING",
          "CONNECTED",
          "PARTIAL_CAPABILITY",
          "UNKNOWN_CAPABILITY",
          "REAUTH_REQUIRED",
          "AUTHORIZATION_DEGRADED",
          "SAME_ACCOUNT_RECONNECTING",
          "DIFFERENT_ACCOUNT_CONFLICT",
          "TRANSIENT_PROVIDER_FAILURE",
          "DISCONNECTED",
          "DELETE_IN_PROGRESS",
        ]),
        providerAccountId: identifierSchema.nullable(),
        handle: z.string().min(1).nullable(),
        reasonCodes: z.array(reasonCodeSchema),
      })
      .strict(),
    window: z
      .object({
        start: timestampSchema,
        end: timestampSchema,
        days: z.literal(30),
      })
      .strict(),
    accountFacts: z.array(accountFactSchema),
    accountPerformance: z.array(InstagramResultSchema),
    objects: z.array(InstagramIntelligenceObjectSchema).length(3),
    representativeMedia: z.array(
      z
        .object({
          mediaId: identifierSchema,
          mediaType: z.enum(["IMAGE", "CAROUSEL_ALBUM", "REELS", "VIDEO"]),
          publishedAt: InstagramSourceValueSchema,
          permalink: InstagramSourceValueSchema,
          likelyCollab: InstagramLikelyCollabSchema,
          metricHighlights: z.array(InstagramObservedMetricSchema),
          evidenceRefs: evidenceRefsSchema,
        })
        .strict(),
    ),
    coverage: z
      .object({
        inventory: coverageSchema,
        metrics: coverageSchema,
        lightSemantic: coverageSchema,
        deepMultimodal: coverageSchema,
        audience: coverageSchema,
      })
      .strict(),
    sync: z
      .object({
        state: z.enum([
          "IDLE",
          "INITIALIZING",
          "REFRESHING",
          "BACKOFF",
          "BLOCKED",
        ]),
        lastAttemptAt: timestampSchema.nullable(),
        lastSuccessAt: timestampSchema.nullable(),
        nextDueAt: timestampSchema.nullable(),
        currentPreserved: z.boolean(),
        reasonCodes: z.array(reasonCodeSchema),
      })
      .strict(),
    actions: z
      .object({
        manualRefresh: refreshActionSchema,
        settingsRecoveryPath: z.literal(
          "/brand/settings/integrations?tab=instagram",
        ),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = value.objects.map((object) => object.semanticId);
    if (
      new Set(ids).size !== INSTAGRAM_INTELLIGENCE_OBJECT_IDS.length ||
      !INSTAGRAM_INTELLIGENCE_OBJECT_IDS.every((id) => ids.includes(id))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Consumer must expose exactly one of each Instagram V1 Object",
        path: ["objects"],
      });
    }
  });

export type InstagramMediaObservation = z.infer<
  typeof InstagramMediaObservationSchema
>;
export type InstagramIntelligenceObject = z.infer<
  typeof InstagramIntelligenceObjectSchema
>;
export type InstagramSyncStateContract = z.infer<
  typeof InstagramSyncStateContractSchema
>;
export type InstagramWorkspaceConsumer = z.infer<
  typeof InstagramWorkspaceConsumerSchema
>;
