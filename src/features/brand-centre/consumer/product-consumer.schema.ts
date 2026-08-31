import { z } from "zod";

const readinessSchema = z.enum(["READY", "PARTIAL", "NOT_READY"]);
const freshnessSchema = z.enum(["CURRENT", "STALE", "UNKNOWN"]);
const authoritySchema = z.enum([
  "observed",
  "creator_shop",
  "confirmed",
  "protected",
  "system_managed",
  "mixed",
]);
const contractSchema = z
  .object({ id: z.string().min(1), version: z.string().min(1) })
  .strict();
const candidateSchema = z
  .object({
    status: z.enum(["NONE", "AVAILABLE", "CONFLICT"]),
    count: z.number().int().nonnegative(),
    currentPreserved: z.boolean(),
    summaryAvailable: z.boolean(),
    rawCandidateVisible: z.literal(false),
  })
  .strict();
const currentSchema = z.union([
  z.object({ kind: z.literal("VALUE"), value: z.unknown() }).strict(),
  z
    .object({
      kind: z.enum([
        "EXPLICIT_NULL",
        "INTENTIONALLY_ABSENT",
        "NO_CURRENT",
        "NOT_EVALUATED",
        "NOT_OWNED",
      ]),
    })
    .strict(),
]);
const lineageComponentSchema = z
  .object({
    semanticPath: z.string().min(1),
    currentContract: contractSchema,
    revision: z.string().regex(/^\d+$/u),
    generatedAt: z.string().datetime(),
  })
  .strict();

export const ProductIntelligenceObjectSchema = z
  .object({
    semanticId: z.enum([
      "offering_factual_profile",
      "offering_creator_communication_profile",
      "offering_actionability_profile",
    ]),
    current: currentSchema,
    readiness: readinessSchema,
    freshness: freshnessSchema,
    authority: authoritySchema,
    candidate: candidateSchema,
    lineage: z
      .object({
        objectContract: contractSchema.nullable(),
        outputContract: contractSchema.nullable(),
        mixedGeneration: z.boolean(),
        mixedContractVersion: z.boolean(),
        components: z.array(lineageComponentSchema),
      })
      .strict(),
  })
  .strict();

const runtimeSchema = z
  .object({
    processorId: z.enum([
      "offering_factual_synthesis",
      "offering_creator_communication",
      "offering_actionability_synthesis",
    ]),
    objectSemanticId: z.enum([
      "offering_factual_profile",
      "offering_creator_communication_profile",
      "offering_actionability_profile",
    ]),
    readiness: readinessSchema,
    freshness: freshnessSchema,
    activity: z.enum([
      "IDLE",
      "WAITING_FOR_EVIDENCE",
      "WAITING_FOR_DEPENDENCY",
      "READY_TO_RUN",
      "RETRY_SCHEDULED",
      "LEARNING",
      "REFRESHING",
      "TEMPORARILY_UNAVAILABLE",
    ]),
    dependencyReadiness: z.enum([
      "UNKNOWN",
      "WAITING_FOR_EVIDENCE",
      "WAITING_FOR_DEPENDENCY",
      "READY_TO_RUN",
    ]),
    latestExecutionStatus: z
      .enum([
        "WAITING_FOR_DEPENDENCY",
        "QUEUED",
        "RUNNING",
        "COMPLETED",
        "FAILED_TERMINAL",
        "CANCELLED",
      ])
      .nullable(),
    reasonCode: z.string().nullable(),
    hasCurrent: z.boolean(),
    refreshing: z.boolean(),
    failure: z
      .object({
        category: z.string().nullable(),
        code: z.string(),
        currentPreserved: z.boolean(),
        retryEligible: z.boolean(),
      })
      .strict()
      .nullable(),
    candidate: candidateSchema,
    currentLineage: z
      .object({
        generatedAt: z.array(z.string().datetime()),
        revisions: z.array(z.string().regex(/^\d+$/u)),
        mixedGeneration: z.boolean(),
        objectContract: contractSchema.nullable(),
        outputContract: contractSchema.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

const canonicalPriceSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("UNAVAILABLE") }).strict(),
  z
    .object({
      state: z.literal("CURRENT"),
      revisionId: z.string().uuid(),
      mode: z.enum(["EXACT", "STARTING_AT", "RANGE", "NOT_PUBLICLY_LISTED"]),
      currentMinAmount: z.string().nullable(),
      currentMaxAmount: z.string().nullable(),
      regularMinAmount: z.string().nullable(),
      regularMaxAmount: z.string().nullable(),
      currency: z.string().regex(/^[A-Z]{3}$/u),
      freshness: freshnessSchema,
      authority: z.string().min(1),
      evaluatedAt: z.string().datetime(),
    })
    .strict(),
]);

export const ProductConsumerResponseSchema = z
  .object({
    offering: z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["PRODUCT", "SERVICE", "EXPERIENCE", "BUNDLE"]).nullable(),
        subtype: z.string().nullable(),
        lifecycle: z.discriminatedUnion("state", [
          z.object({ state: z.literal("UNRESOLVED") }).strict(),
          z
            .object({
              state: z.literal("RESOLVED"),
              value: z.enum(["DRAFT_INCOMPLETE", "ACTIVE", "PAUSED_INACTIVE"]),
            })
            .strict(),
        ]),
        name: z.string(),
        description: z.string().nullable(),
        customerDestination: z.string().url(),
        primaryMedia: z
          .object({
            id: z.string().uuid(),
            url: z.string().url(),
            label: z.string().nullable(),
            altText: z.string().nullable(),
          })
          .strict()
          .nullable(),
        canonicalPrice: canonicalPriceSchema,
        offerRefs: z.array(z.object({ offerId: z.string().uuid() }).strict()),
        locationRefs: z.array(
          z.object({ locationId: z.string().uuid() }).strict(),
        ),
      })
      .strict(),
    intelligence: z
      .object({
        factualProfile: ProductIntelligenceObjectSchema,
        creatorCommunicationProfile: ProductIntelligenceObjectSchema,
        actionabilityProfile: ProductIntelligenceObjectSchema,
      })
      .strict(),
    processorRuntime: z
      .object({
        offering_factual_synthesis: runtimeSchema,
        offering_creator_communication: runtimeSchema,
        offering_actionability_synthesis: runtimeSchema,
      })
      .strict(),
  })
  .strict();

export type ProductConsumerResponse = z.infer<
  typeof ProductConsumerResponseSchema
>;
export type ProductIntelligenceObject = z.infer<
  typeof ProductIntelligenceObjectSchema
>;
export type ProductProcessorRuntime = z.infer<typeof runtimeSchema>;
