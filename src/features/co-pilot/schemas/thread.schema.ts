import { CoPilotScopeContext } from "@prisma/client";
import { z } from "zod";

export const CoPilotScopeContextSchema = z.nativeEnum(CoPilotScopeContext);

export const CreateCoPilotThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  scopeContext: CoPilotScopeContextSchema.optional(),
});

export const PatchCoPilotThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export const PostCoPilotMessageSchema = z
  .object({
    text: z.string().max(8000).default(""),
    scopeContext: CoPilotScopeContextSchema.optional(),
    slotValues: z.record(z.string()).optional(),
  })
  .superRefine((body, ctx) => {
    const hasText = body.text.trim().length > 0;
    const hasSlots =
      !!body.slotValues && Object.keys(body.slotValues).length > 0;
    if (!hasText && !hasSlots) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Message text or slotValues is required",
        path: ["text"],
      });
    }
  });

export const ConfirmHitlSchema = z.object({
  threadId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const DiscardHitlSchema = ConfirmHitlSchema;

export const ListCoPilotThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const SubmitCoPilotFeedbackSchema = z.object({
  threadId: z.string().uuid(),
  rating: z.enum(["THUMBS_UP", "THUMBS_DOWN"]),
  reason: z.string().trim().max(500).optional(),
});

export type PostCoPilotMessageInput = z.infer<typeof PostCoPilotMessageSchema>;
