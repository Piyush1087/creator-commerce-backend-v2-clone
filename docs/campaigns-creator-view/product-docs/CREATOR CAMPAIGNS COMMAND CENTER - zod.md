import { z } from "zod";

// \==========================================  
// CONTROL STRIP QUERY PARAMETERS VALIDATION  
// \==========================================  
export const commandCenterQuerySchema \= z.object({  
  currentView: z.enum(\["ACTIVE\_PRODUCTION", "PENDING\_APPLICATIONS"\]).default("ACTIVE\_PRODUCTION"),  
  searchQuery: z.string().trim().max(100).optional(),  
  platformFilter: z.enum(\["INSTAGRAM\_REEL", "INSTAGRAM\_STORY", "TIKTOK\_VIDEO", "YOUTUBE\_SHORTS"\]).optional(),  
  dependencyFilter: z.enum(\["AWAITING\_CREATOR", "AWAITING\_BRAND", "ALL"\]).default("ALL"),  
});

export type CommandCenterQueryInput \= z.infer\<typeof commandCenterQuerySchema\>;

// \==========================================  
// CONTEXTUAL CTA WORKFLOW MUTATIONS  
// \==========================================

// Action 1: Creator claims/configures an outbound brand invitation brief  
export const claimBrandInvitationSchema \= z.object({  
  collaborationId: z.string().uuid("Invalid contract pipeline identifier tracking token"),  
  selectedProductId: z.string().uuid("Invalid asset selection path mapping specification"),  
  selectedBriefTrackId: z.string().uuid("Invalid creative layout outline identifier mapping"),  
  creatorAction: z.enum(\["ACCEPT", "DECLINE"\]),  
});

export type ClaimBrandInvitationInput \= z.infer\<typeof claimBrandInvitationSchema\>;

// Action 2: Creator acknowledges package arrival to shift phase to CONTENT\_DRAFTING  
export const confirmLogisticsReceiptSchema \= z.object({  
  collaborationId: z.string().uuid("Invalid logistics pipeline identifier token"),  
  isPackageDamaged: z.boolean().default(false),  
  receivedConfirmation: z.literal(true, {  
    errorMap: () \=\> ({ message: "You must explicitly confirm physical physical item alignment receipt" }),  
  }),  
});

export type ConfirmLogisticsReceiptInput \= z.infer\<typeof confirmLogisticsReceiptSchema\>;

// Action 3: Creator uploads content creative draft link for brand safety verification  
export const submitContentDraftSchema \= z.object({  
  collaborationId: z.string().uuid("Invalid creative campaign validation path token"),  
  draftAssetUrl: z  
    .string()  
    .url("Please provide a valid asset url structure (e.g., Frame.io, Drive link, or storage bucket pointer)")  
    .includes(".", { message: "Invalid domain layout format string for cloud content asset" }),  
  submissionNotes: z.string().trim().max(500, "Production notes cannot exceed 500 characters").optional(),  
});

export type SubmitContentDraftInput \= z.infer\<typeof submitContentDraftSchema\>;

// \==========================================  
// READ-ONLY HISTORY QUERY SCHEMAS  
// \==========================================  
export const historyArchiveQuerySchema \= z.object({  
  page: z.number({ coerce: true }).int().positive().default(1),  
  limit: z.number({ coerce: true }).int().positive().max(50).default(15),  
  archiveStatus: z.enum(\["ARCHIVED\_COMPLETED", "ARCHIVED\_CLOSED", "ALL"\]).default("ALL"),  
});

export type HistoryArchiveQueryInput \= z.infer\<typeof historyArchiveQuerySchema\>;  
