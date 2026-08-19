import { z } from "zod";

export const WorkflowStageEnum = z.enum([
  "NEGOTIATION",
  "SECUREMENT",
  "LOGISTICS",
  "PRODUCTION",
  "POSTING",
  "ARCHIVAL",
  "TERMINATED",
]);

export const PayoutModeEnum = z.enum(["ESCROW", "MANUAL", "BARTER"]);

export const IndustryTypeEnum = z.enum(["D2C", "SAAS", "HEALTHCARE"]);

export const MasterCollabSchema = z
  .object({
    id: z.string().uuid(),
    brand_id: z.string().uuid(),
    creator_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
    brief_id: z.string().uuid(),
    stage: WorkflowStageEnum,
    payout_mode: PayoutModeEnum,
    industry: IndustryTypeEnum,
    commercials: z
      .object({
        initial_quote: z.number().nonnegative().optional(),
        brand_counter_offer: z.number().nonnegative().optional(),
        final_quote: z.number().nonnegative().optional(),
        total_quote: z.number().nonnegative(),
        advance_30: z.number().nonnegative(),
        balance_70: z.number().nonnegative(),
        round_count: z.number().int().min(0).max(2),
        is_final_offer: z.boolean().default(false),
        creator_bank_details_id: z.string().uuid().optional().nullable(),
      })
      .refine(
        (data) =>
          Math.abs(data.advance_30 + data.balance_70 - data.total_quote) < 0.01,
        {
          message: "Financial Split Mismatch: 30% + 70% must equal Total Quote",
          path: ["total_quote"],
        },
      ),
    logistics: z
      .object({
        fulfillment_issue_count: z.number().int().min(0).max(2),
        is_received_confirmed: z.boolean(),
        tracking_id: z.string().trim().min(1).optional().nullable(),
        courier_name: z.string().optional().nullable(),
        digital_access_credentials: z.string().optional().nullable(),
        redemption_code: z.string().optional().nullable(),
      })
      .superRefine((data, ctx) => {
        if (data.fulfillment_issue_count >= 2 && !data.is_received_confirmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "LOGISTICS_DEADLOCK: Two delivery/access attempts failed. Terminal state.",
            path: ["fulfillment_issue_count"],
          });
        }
      }),
    production: z
      .object({
        revision_count: z.number().int().min(0).max(2),
        auto_approval_deadline: z.date(),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
        deliverable_type: z.string().optional().nullable(),
        media_url: z.string().url().optional().nullable(),
        is_aspect_ratio_verified: z.boolean().default(false),
      })
      .superRefine((data, ctx) => {
        if (data.revision_count >= 2 && data.status === "REJECTED") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "PRODUCTION_HARD_STOP: Final revision rejected. Must terminate.",
            path: ["status"],
          });
        }
        if (
          data.deliverable_type &&
          ["reel", "story"].includes(data.deliverable_type.toLowerCase()) &&
          data.media_url &&
          !data.is_aspect_ratio_verified
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Media Aspect Mismatch: Video uploads must be verified for a 9:16 aspect ratio if specified as a Reel or Story.",
            path: ["is_aspect_ratio_verified"],
          });
        }
      }),
    compliance: z
      .object({
        live_url: z.string().url().optional().nullable(),
        is_link_verified: z.boolean(),
        is_70_payout_released: z.boolean(),
      })
      .superRefine((data, ctx) => {
        if (data.live_url) {
          const permittedDomains = [
            /instagram\.com/i,
            /tiktok\.com/i,
            /youtube\.com/i,
          ];
          if (!permittedDomains.some((regex) => regex.test(data.live_url!))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "Domain Verification Failed: live_url must resolve to a valid Instagram, TikTok, or YouTube domain.",
              path: ["live_url"],
            });
          }
        }
        if (data.is_70_payout_released && !data.is_link_verified) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Final payout is locked until content compliance is verified.",
            path: ["is_70_payout_released"],
          });
        }
      }),
  })
  .superRefine((data, ctx) => {
    if (data.payout_mode === "BARTER") {
      if (
        data.commercials.total_quote !== 0 ||
        data.commercials.advance_30 !== 0 ||
        data.commercials.balance_70 !== 0
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Barter Mode Violation: If payout mode is BARTER, total quote and financial splits must equal 0.",
          path: ["commercials", "total_quote"],
        });
      }
    }
    if (
      data.payout_mode === "MANUAL" &&
      !data.commercials.creator_bank_details_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Bank Lock Violation: Creator bank account details are mandatory to accept a Manual Payout collaboration workflow.",
        path: ["commercials", "creator_bank_details_id"],
      });
    }
    if (data.industry === "D2C" && !data.logistics.tracking_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Logistics Enforcer: A tracking_id is strictly required when the collaboration runs in the D2C industry vertical.",
        path: ["logistics", "tracking_id"],
      });
    }
  });

export type MasterCollab = z.infer<typeof MasterCollabSchema>;
