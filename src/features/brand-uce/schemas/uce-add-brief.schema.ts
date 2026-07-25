import { z } from "zod";

/**
 * Add Brief wizard — from docs/brand-uce/change-doc/zod-add-brief.md
 */

export const BriefStrategyModeSchema = z.enum(["CREATOR_LED", "BRAND_LED"]);

export const DeliverableFormatSchema = z.enum([
  "REEL_VIDEO",
  "STORY",
  "PHOTOSHOOT",
  "CAROUSEL_BANNER",
]);

export const VideoAspectRatioSchema = z.enum(["9_16_VERTICAL", "4_5_PORTRAIT"]);
export const VideoDurationRangeSchema = z.enum([
  "UNDER_15S",
  "15_45S",
  "OVER_45S",
]);
export const CarouselAspectRatioSchema = z.enum([
  "4_5_PORTRAIT",
  "1_1_SQUARE",
]);

export const AudioStrategySchema = z.enum([
  "DIRECT_VOICEOVER",
  "TRENDING_MUSIC_BACKGROUND",
  "LOFI_FOCUS_BEATS",
  "ORIGINAL_AUDIO",
]);

export const LightingEnvironmentSchema = z.enum([
  "NATURAL_DAYLIGHT",
  "BRIGHT_CLINICAL",
  "WARM_MOODY",
  "STUDIO_RING_LIGHT",
]);

export const ToneOfVoiceSchema = z.enum([
  "AUTHORITATIVE_EXPERT",
  "HIGH_ENERGY",
  "CALMING_ASMR",
  "RELATABLE_CASUAL",
]);

export const StoryboardSegmentTypeSchema = z.enum([
  "HOOK_OPENER",
  "PROBLEM_PITCH",
  "ACTIVE_TECH_REVIEW",
  "CONVERSION_CTA",
]);

export const SingleDeliverableSpecSchema = z
  .object({
    format_type: DeliverableFormatSchema,
    video_aspect_ratio: VideoAspectRatioSchema.optional(),
    video_duration_range: VideoDurationRangeSchema.optional(),
    is_reel_amplification: z.boolean().default(false),
    photoshoot_quantity_allocation: z.number().int().positive().optional(),
    carousel_aspect_ratio: CarouselAspectRatioSchema.optional(),
    carousel_max_slide_count: z.number().int().min(1).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.format_type === "REEL_VIDEO") {
      if (!data.video_aspect_ratio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Aspect ratio is required for Video deliverables.",
          path: ["video_aspect_ratio"],
        });
      }
      if (!data.video_duration_range) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Duration profile parameters are required for Video deliverables.",
          path: ["video_duration_range"],
        });
      }
    }
    if (
      data.format_type === "PHOTOSHOOT" &&
      !data.photoshoot_quantity_allocation
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Quantity allocation count metrics are required for Photoshoot specifications.",
        path: ["photoshoot_quantity_allocation"],
      });
    }
    if (data.format_type === "CAROUSEL_BANNER") {
      if (!data.carousel_aspect_ratio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Carousel framework layout proportions are required.",
          path: ["carousel_aspect_ratio"],
        });
      }
      if (!data.carousel_max_slide_count) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Slide limits must be set between 1 and 10 slides.",
          path: ["carousel_max_slide_count"],
        });
      }
    }
  });

export const CreatorLedGuidanceSchema = z.object({
  content_theme: z
    .string()
    .min(
      1,
      "The creative narrative theme dropdown requires an active input string handle.",
    ),
  description: z
    .string()
    .min(1, "Theme descriptions must be populated manually by system operators."),
  hook_ideas: z
    .array(z.string().min(1))
    .min(1, "Provide at least one conversion optimization hook tag."),
  recommended_b_rolls: z
    .string()
    .min(1, "Detail required baseline footage assets or actions."),
  creator_dos: z
    .array(z.string().min(1))
    .min(1, "Define at least one execution target."),
  creator_donts: z
    .array(z.string().min(1))
    .min(1, "Establish at least one regulatory or brand protection safety parameter."),
  audio_strategy: AudioStrategySchema,
  lighting_requirements: LightingEnvironmentSchema,
  background_setting: z.string().min(1),
  tone_of_voice: ToneOfVoiceSchema,
  post_caption: z.string().min(1),
  hashtags_and_mentions: z.array(
    z
      .string()
      .regex(
        /^[@#].+/,
        "Distribution anchors must match hashtag (#) or handle (@) protocols.",
      ),
  ),
});

export const StoryboardSceneSegmentSchema = z.object({
  sequence_index_id: z.number().int().nonnegative(),
  segment_type: StoryboardSegmentTypeSchema,
  visual_direction: z
    .string()
    .min(5, "Visual instructions must be clear and detailed."),
  audio_teleprompter_script: z
    .string()
    .min(1, "Enter exact script or teleprompter lines for this scene block."),
  target_screen_time_seconds: z.number().int().positive(),
  reference_frame_asset_url: z.string().url().nullable().optional(),
});

export const DeliverableStep2GuidancePayloadSchema = z.object({
  deliverable_id: z.string().uuid(),
  format_type: DeliverableFormatSchema,
  is_reel_amplification: z.boolean().default(false),
  creator_led_details: CreatorLedGuidanceSchema.optional(),
  brand_led_storyboard: z.array(StoryboardSceneSegmentSchema).optional(),
});

export const Step3LogisticsPlannerSnapshotSchema = z.object({
  campaign_fulfillment_deadline_descriptor: z.string(),
  fixed_calendar_target_date: z.string().datetime(),
  is_physical_product_gifting_required: z.boolean(),
  base_escrow_compensation_payout_float: z.number().nonnegative(),
  commission_incentive_percentage_float: z.number().min(0).max(100),
  link_in_bio_duration_days: z.number().int().nonnegative(),
  paid_ads_boosting_whitelist_duration_days: z.number().int().nonnegative(),
  organic_reposting_license_duration_days: z.number().int().nonnegative(),
});

export const MasterAddBriefWizardSchema = z
  .object({
    campaign_id: z.string().uuid(),
    product_id: z.string().uuid(),
    brief_name: z
      .string()
      .min(2, "Brief labels require identification attributes."),
    purpose: z
      .string()
      .min(5, "A brief operational purpose context must be stated."),
    objective: z
      .string()
      .min(5, "KPI objective scopes require target declarations."),
    target_influencer_archetype: z
      .string()
      .min(
        1,
        "Brief tracking requires binding selection to a Parent Archetype matrix node.",
      ),
    brief_type: BriefStrategyModeSchema,
    mandatory_creator_requirements: z
      .string()
      .min(1, "Define foundational functional criteria parameters."),
    deliverables_inventory: z
      .array(SingleDeliverableSpecSchema)
      .min(
        1,
        "A campaign production framework requires at least one content deliverable blueprint.",
      ),
    content_guidance_matrix: z.array(DeliverableStep2GuidancePayloadSchema),
    parent_planner_logistics_snapshot: Step3LogisticsPlannerSnapshotSchema,
  })
  .superRefine((master, ctx) => {
    if (
      master.deliverables_inventory.length !==
      master.content_guidance_matrix.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Deliverables misalignment: Content guidance metrics count does not match inventory requests.",
        path: ["content_guidance_matrix"],
      });
    }

    master.content_guidance_matrix.forEach((guidance, idx) => {
      if (master.brief_type === "CREATOR_LED" && !guidance.is_reel_amplification) {
        if (!guidance.creator_led_details) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Content guidance fields are required for Creator-Led deliverable asset #${idx + 1}.`,
            path: ["content_guidance_matrix", idx, "creator_led_details"],
          });
        }
      }

      if (master.brief_type === "BRAND_LED") {
        if (
          !guidance.brand_led_storyboard ||
          guidance.brand_led_storyboard.length === 0
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A granular storyboard scene timeline repeater array is required for Brand-Led brief deliverable asset #${idx + 1}.`,
            path: ["content_guidance_matrix", idx, "brand_led_storyboard"],
          });
        }
      }

      if (guidance.format_type === "STORY" && guidance.is_reel_amplification) {
        if (
          guidance.creator_led_details &&
          guidance.creator_led_details.description.length > 500
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Reel-amplification stories use a simplified configuration layout; reduce extended textual guidance notes.",
            path: [
              "content_guidance_matrix",
              idx,
              "creator_led_details",
              "description",
            ],
          });
        }
      }
    });
  });

export type MasterAddBriefWizardRequest = z.infer<
  typeof MasterAddBriefWizardSchema
>;
export type SingleDeliverableSpec = z.infer<typeof SingleDeliverableSpecSchema>;
export type DeliverableStep2GuidancePayload = z.infer<
  typeof DeliverableStep2GuidancePayloadSchema
>;
export type StoryboardSceneSegment = z.infer<
  typeof StoryboardSceneSegmentSchema
>;
export type Step3LogisticsPlannerSnapshot = z.infer<
  typeof Step3LogisticsPlannerSnapshotSchema
>;
