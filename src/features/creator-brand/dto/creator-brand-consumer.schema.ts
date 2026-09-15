import { z } from "zod";
import {
  CreatorBrandProfileInputSchema,
  CreatorBrandMutationRequestSchema,
  CreatorBrandActionSchema,
} from "../contracts/creator-brand-profile.contract";

export const CreatorBrandManualRequestSchema =
  CreatorBrandMutationRequestSchema.options[0];
export const CreatorBrandConsumerSchema = z
  .object({
    contractVersion: z.literal("creator-brand-v0.1"),
    identity: z
      .object({
        creatorName: z.string().nullable(),
        avatarImageReference: z.string().nullable(),
        primaryInstagramHandle: z.string().nullable(),
      })
      .strict(),
    state: z.enum(["UNCONFIGURED", "CONFIGURED"]),
    profile: CreatorBrandProfileInputSchema.nullable(),
    currentRevision: z.number().int().nonnegative(),
    context: z
      .object({
        role: z.enum(["OWNER", "MANAGER", "ASSISTANT"]),
        allowedActions: z.array(CreatorBrandActionSchema),
        manualFirst: z.literal(true),
        sourceIndependent: z.literal(true),
      })
      .strict(),
    suggestions: z.object({ state: z.literal("NOT_IMPLEMENTED") }).strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.currentRevision === 0) !== (value.profile === null) ||
      (value.profile === null) !== (value.state === "UNCONFIGURED")
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Canonical configuration/revision mismatch",
      });
  });
export type CreatorBrandConsumer = z.infer<typeof CreatorBrandConsumerSchema>;
