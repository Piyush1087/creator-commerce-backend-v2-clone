import { z } from "zod";

export const ChatCreateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const ChatListConversationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    includeArchived: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export const ChatPatchConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.archived !== undefined,
    {
      message: "At least one conversation metadata field is required",
    },
  );

export const ChatTurnRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(8_000),
    surface: z.enum(["HOME", "WORKSPACE", "MODULE"]).optional(),
    routePath: z.string().trim().min(1).max(2_048).optional(),
    selectedEntity: z
      .object({
        type: z.string().trim().min(1).max(64),
        id: z.string().trim().min(1).max(128),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ChatCreateConversationInput = z.infer<
  typeof ChatCreateConversationSchema
>;
export type ChatListConversationsQuery = z.infer<
  typeof ChatListConversationsQuerySchema
>;
export type ChatPatchConversationInput = z.infer<
  typeof ChatPatchConversationSchema
>;
export type ChatTurnRequest = z.infer<typeof ChatTurnRequestSchema>;
