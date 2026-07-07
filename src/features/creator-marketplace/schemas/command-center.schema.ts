import { z } from "zod";

export const CommandCenterQuerySchema = z.object({
  currentView: z
    .enum(["ACTIVE_PRODUCTION", "PENDING_APPLICATIONS"])
    .default("ACTIVE_PRODUCTION"),
  searchQuery: z.string().trim().max(100).optional(),
  platformFilter: z
    .enum([
      "INSTAGRAM_REEL",
      "INSTAGRAM_STORY",
      "TIKTOK_VIDEO",
      "YOUTUBE_SHORTS",
    ])
    .optional(),
  dependencyFilter: z
    .enum(["AWAITING_CREATOR", "AWAITING_BRAND", "ALL"])
    .default("ALL"),
});

export const ClaimBrandInvitationSchema = z.object({
  collaborationId: z.string().uuid(),
  selectedProductId: z.string().uuid().optional(),
  selectedBriefTrackId: z.string().uuid().optional(),
  creatorAction: z.enum(["ACCEPT", "DECLINE"]),
});

export const ConfirmLogisticsReceiptSchema = z.object({
  collaborationId: z.string().uuid(),
  isPackageDamaged: z.boolean().default(false),
  receivedConfirmation: z.literal(true, {
    errorMap: () => ({
      message: "You must explicitly confirm physical item receipt",
    }),
  }),
});

export const SubmitContentDraftSchema = z.object({
  collaborationId: z.string().uuid(),
  draftAssetUrl: z
    .string()
    .url()
    .refine((value) => value.includes("."), {
      message: "Invalid asset URL format",
    }),
  submissionNotes: z.string().trim().max(500).optional(),
});

export const HistoryArchiveQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(15),
  archiveStatus: z
    .enum(["ARCHIVED_COMPLETED", "ARCHIVED_CLOSED", "ALL"])
    .default("ALL"),
});

export type CommandCenterQueryInput = z.infer<typeof CommandCenterQuerySchema>;
export type ClaimBrandInvitationInput = z.infer<
  typeof ClaimBrandInvitationSchema
>;
export type ConfirmLogisticsReceiptInput = z.infer<
  typeof ConfirmLogisticsReceiptSchema
>;
export type SubmitContentDraftInput = z.infer<typeof SubmitContentDraftSchema>;
export type HistoryArchiveQueryInput = z.infer<
  typeof HistoryArchiveQuerySchema
>;
