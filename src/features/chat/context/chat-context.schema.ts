import { z } from "zod";

export const ChatContextRequestSchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    surface: z.enum(["HOME", "WORKSPACE", "MODULE"]).default("HOME"),
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

export type ChatContextRequest = z.infer<typeof ChatContextRequestSchema>;
