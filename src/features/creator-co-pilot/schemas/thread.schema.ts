import { z } from "zod";
import { CreatorCoPilotScopeContext } from "@prisma/client";

export const CreatorCoPilotScopeContextSchema = z.nativeEnum(
  CreatorCoPilotScopeContext,
);

export const CreateCreatorCoPilotThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  scopeContext: CreatorCoPilotScopeContextSchema.optional(),
});

export const PatchCreatorCoPilotThreadSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional(),
});

export const PostCreatorCoPilotMessageSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  scopeContext: CreatorCoPilotScopeContextSchema.optional(),
  slotValues: z.record(z.string()).optional(),
});

export const ConfirmCreatorCoPilotHitlSchema = z.object({
  threadId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const DiscardCreatorCoPilotHitlSchema = ConfirmCreatorCoPilotHitlSchema;

export const ListCreatorCoPilotThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const SubmitCreatorCoPilotFeedbackSchema = z.object({
  threadId: z.string().uuid(),
  rating: z.enum(["THUMBS_UP", "THUMBS_DOWN"]),
  reason: z.string().trim().max(500).optional(),
});

export {
  CoPilotChatPayloadSchema,
  GeminiCoPilotOutputSchema,
  type CoPilotChatPayload,
} from "../../co-pilot/schemas/copilot-payload.schema";
