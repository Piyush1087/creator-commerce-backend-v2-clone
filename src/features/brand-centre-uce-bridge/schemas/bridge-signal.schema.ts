import { z } from "zod";

export const IndustrySectorEnum = z.enum([
  "D2C_ECOMMERCE",
  "HEALTHCARE",
  "AI_SAAS",
  "OFFLINE_EXPERIENCES",
]);

export const MacroObjectiveEnum = z.enum([
  "PRODUCTION",
  "PULSE",
  "PROOF_PUSH",
]);

export const DeliverableTypeEnum = z.enum([
  "REEL_VIDEO",
  "TIKTOK_POST",
  "YOUTUBE_SHORTS",
  "IG_STORIES",
  "UGC_RAW_ASSET",
]);

export const CompensationTypeEnum = z.enum([
  "FIXED_FEE",
  "BARTER",
  "REVENUE_SHARE",
  "HYBRID_MILESTONE",
]);

export const InboundLaunchSignalSchema = z.object({
  signal_type: z.literal("LAUNCH_NEW_FRAMEWORK"),
  brand_id: z.string().uuid("Invalid brand identifier payload string formatting."),
  campaign_name: z
    .string()
    .min(3, "Campaign naming profiles require at least 3 characters.")
    .max(255),
  industry_sector: IndustrySectorEnum,
  assigned_macro_objective: MacroObjectiveEnum,
  raw_budget_expression: z
    .string()
    .min(5, "Budget expressions require numerical anchor points."),
  timeline_expression: z
    .string()
    .min(4, "Target completion expressions cannot be empty lines."),
});

export const InboundInjectSignalSchema = z.object({
  signal_type: z.literal("INJECT_ASSET_LINE"),
  campaign_id: z
    .string()
    .uuid(
      "Target destination workspace reference must track to an operational UUID.",
    ),
  product_name: z
    .string()
    .min(1, "Injected product profiles require identifying titles."),
  estimated_base_price: z
    .number()
    .nonnegative("Pricing parameters cannot be calculated as negative assets."),
  raw_strategic_context: z
    .string()
    .min(
      10,
      "Provide sufficient strategic context parameters for AI translation compilation.",
    ),
  creative_briefs: z
    .array(
      z.object({
        brief_name: z.string().min(3).max(150),
        deliverable_type: DeliverableTypeEnum,
        compensation_type: CompensationTypeEnum,
      }),
    )
    .min(
      1,
      "Asset injection updates require at least one accompanying creative strategy configuration module.",
    ),
});

export const InboundInterruptSignalSchema = z.object({
  signal_type: z.literal("FAST_TRACK_INTERRUPT"),
  campaign_id: z.string().uuid(),
  target_entity_type: z.enum(["PRODUCT", "BRIEF"]),
  target_entity_uuid: z
    .string()
    .uuid("Target execution vector must map to a valid internal database record ID."),
});

export const UnifiedBridgeSignalProcessorSchema = z.discriminatedUnion(
  "signal_type",
  [
    InboundLaunchSignalSchema,
    InboundInjectSignalSchema,
    InboundInterruptSignalSchema,
  ],
);

export type UnifiedBridgeSignalPayload = z.infer<
  typeof UnifiedBridgeSignalProcessorSchema
>;

export type InboundLaunchSignal = z.infer<typeof InboundLaunchSignalSchema>;
export type InboundInjectSignal = z.infer<typeof InboundInjectSignalSchema>;
export type InboundInterruptSignal = z.infer<typeof InboundInterruptSignalSchema>;

