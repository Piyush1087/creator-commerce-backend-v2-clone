import { z } from "zod";

export const ChatCapabilityPlanSchema = z
  .object({
    requests: z
      .array(
        z
          .object({
            capabilityId: z.string().trim().min(1).max(128),
            input: z.record(z.unknown()),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const ChatModelContextHintsSchema = z
  .object({
    surface: z.enum(["HOME", "WORKSPACE", "MODULE"]).optional(),
    routePath: z.string().trim().min(1).max(2048).optional(),
    selectedEntity: z
      .object({
        type: z.string().trim().min(1).max(64),
        id: z.string().trim().min(1).max(128),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ChatAuthorizedEntityCandidateSchema = z
  .object({
    type: z.enum(["BRAND", "OFFERING", "CAMPAIGN", "COLLABORATION"]),
    id: z.string().trim().min(1).max(128),
    label: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const ChatConversationExcerptSchema = z
  .array(
    z
      .object({
        role: z.enum(["USER", "ASSISTANT"]),
        text: z.string().max(2_000),
      })
      .strict(),
  )
  .max(12);

export const ChatPlanningServerContextSchema = z
  .object({
    planningPass: z.union([z.literal(1), z.literal(2)]),
    authorizedEntityCandidates: z
      .array(ChatAuthorizedEntityCandidateSchema)
      .max(500),
    alreadyInvokedCapabilities: z
      .array(
        z
          .object({
            capabilityId: z.string().trim().min(1).max(128),
            input: z.record(z.unknown()),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

export const ChatSynthesisDraftSchema = z
  .object({
    answer: z.string().max(20_000),
    freshnessNotes: z.array(z.string().max(500)).default([]),
    limitations: z.array(z.string().max(500)).default([]),
  })
  .strict();

export type ChatCapabilityPlan = z.infer<typeof ChatCapabilityPlanSchema>;
export type ChatSynthesisDraft = z.infer<typeof ChatSynthesisDraftSchema>;
