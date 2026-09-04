import { z } from "zod";

import {
  INTELLIGENCE_CONSUMER_SUBJECT_TYPES,
  INTELLIGENCE_ENGINE_IDS,
  type IntelligenceConsumerResult,
} from "./intelligence-consumer.contract";

export const IntelligenceConsumerSubjectSchema = z
  .object({
    type: z.enum(INTELLIGENCE_CONSUMER_SUBJECT_TYPES),
    id: z.string().min(1),
  })
  .strict();

const currentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("VALUE"),
      resultRef: z.string().min(1),
    })
    .strict(),
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

export const IntelligenceConsumerObjectMetaSchema = z
  .object({
    objectId: z.string().min(1),
    objectState: z.enum(["NO_CURRENT", "PARTIAL_CURRENT", "CURRENT"]),
    current: currentSchema,
    readiness: z.enum(["READY", "PARTIAL", "NOT_READY"]),
    resultReadiness: z.enum(["READY", "PARTIAL", "NOT_READY"]),
    freshness: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
    changedAt: z.string().datetime().nullable(),
    authority: z.enum([
      "observed",
      "creator_shop",
      "confirmed",
      "protected",
      "system_managed",
      "mixed",
    ]),
    candidate: z
      .object({
        status: z.enum(["NONE", "AVAILABLE", "CONFLICT"]),
        count: z.number().int().nonnegative(),
        currentPreserved: z.boolean(),
        summaryAvailable: z.boolean(),
      })
      .strict()
      .optional(),
    runtimeActivity: z
      .enum(["NONE", "LEARNING", "REFRESHING", "TEMPORARILY_UNAVAILABLE"])
      .optional(),
    updatedAt: z.string().datetime().nullable().optional(),
    provenanceRefs: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const IntelligenceConsumerResultSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    engineId: z.enum(INTELLIGENCE_ENGINE_IDS),
    subject: IntelligenceConsumerSubjectSchema,
    objects: z.array(IntelligenceConsumerObjectMetaSchema),
    capabilityAvailability: z
      .object({
        status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
        reasonCode: z.string().min(1).optional(),
      })
      .strict(),
    domainPayloadVersion: z.literal("1.0"),
    domainPayload: z.custom<Record<string, unknown>>(
      (value) => value !== null && typeof value === "object",
      "Domain payload must be an object",
    ),
  })
  .strict();

export function assertIntelligenceConsumerResult<TPayload>(
  result: IntelligenceConsumerResult<TPayload>,
): void {
  IntelligenceConsumerResultSchema.parse(result);
}
