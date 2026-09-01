import { z } from "zod";

import {
  CHAT_ENTITY_TYPES,
  CHAT_GROUNDING_SOURCE_TYPES,
  CHAT_RESPONSE_STATUSES,
} from "./chat-response.contract";

export const ChatEntityRefSchema = z
  .object({
    type: z.enum(CHAT_ENTITY_TYPES),
    id: z.string().trim().min(1).max(128),
  })
  .strict();

export const ChatGroundingRefSchema = z
  .object({
    sourceType: z.enum(CHAT_GROUNDING_SOURCE_TYPES),
    capabilityId: z.string().trim().min(1).max(128),
    entityRefs: z.array(ChatEntityRefSchema),
    readiness: z.string().trim().min(1).max(64).optional(),
    freshness: z.string().trim().min(1).max(64).optional(),
    resultRefs: z.array(z.string().trim().min(1).max(128)).optional(),
  })
  .strict();

export const ChatGroundedResponseSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    status: z.enum(CHAT_RESPONSE_STATUSES),
    answer: z.string().max(20_000),
    grounding: z.array(ChatGroundingRefSchema),
    entityRefs: z.array(ChatEntityRefSchema),
    freshnessNotes: z.array(z.string().max(500)),
    limitations: z.array(z.string().max(500)),
    recommendation: z
      .object({
        text: z.string().trim().min(1).max(4_000),
        basisRefs: z.array(z.string().trim().min(1).max(128)),
        nonMutating: z.literal(true),
      })
      .strict()
      .optional(),
    navigation: z
      .object({
        destinationId: z.string().trim().min(1).max(128),
        entityRef: ChatEntityRefSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((response, context) => {
    if (response.status === "NAVIGATION" && !response.navigation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NAVIGATION status requires a navigation destination",
        path: ["navigation"],
      });
    }
    if (response.status !== "NAVIGATION" && response.navigation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Navigation metadata requires NAVIGATION status",
        path: ["navigation"],
      });
    }
  });
