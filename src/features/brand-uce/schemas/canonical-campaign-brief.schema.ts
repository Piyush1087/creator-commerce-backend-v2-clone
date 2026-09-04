import { z } from "zod";

const entityIdSchema = z.string().trim().min(1);
const jsonValueSchema: z.ZodType<
  string | number | boolean | null | unknown[] | Record<string, unknown>
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);
const structuredJsonSchema = z.union([
  z.record(jsonValueSchema),
  z.array(jsonValueSchema),
]);

const canonicalDeliverableSchema = z.object({
  deliverable_id: entityIdSchema.optional(),
  format: z.enum(["REEL_VIDEO", "STORY", "PHOTOSHOOT", "BANNER_CAROUSEL"]),
  display_order: z.number().int().min(0),
  configuration: structuredJsonSchema.optional().nullable(),
  creative_guidance: structuredJsonSchema.optional().nullable(),
  amplify_target_deliverable_id: entityIdSchema.optional().nullable(),
});

const legacyDeliverableSchema = z.object({
  deliverable_id: entityIdSchema.optional(),
  format: z.string().trim().min(2).max(80),
  quantity: z.number().int().min(1),
  creative_requirements: z.string().trim().min(5).max(4000),
  publishing_required: z.boolean(),
});

const draftFields = z.object({
  brief_name: z.string().trim().min(1).optional().nullable(),
  creative_intent: z.string().trim().min(1).optional().nullable(),
  creator_brief: z.string().trim().min(1).optional().nullable(),
  brief_type: z.enum(["CREATOR_LED", "BRAND_LED"]).optional().nullable(),
  platform: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"]).optional().nullable(),
  brief_level_guidance: structuredJsonSchema.optional().nullable(),
  reference_content: structuredJsonSchema.optional().nullable(),
  usage_rights: structuredJsonSchema.optional().nullable(),
  creator_requirements: z.string().trim().min(1).optional().nullable(),
  title: z.string().trim().min(5).max(255).optional(),
  creative_requirements: z.string().trim().min(10).max(8000).optional(),
  deliverables: z
    .array(z.union([canonicalDeliverableSchema, legacyDeliverableSchema]))
    .optional(),
});

export const createCanonicalBriefDraftSchema = draftFields.extend({
  campaign_asset_id: entityIdSchema,
  creation_source: z.enum(["MANUAL", "AI_RECOMMENDED"]).default("MANUAL"),
});

export const updateCanonicalBriefDraftSchema = draftFields.refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one Brief field must be supplied." },
);

export const updatePublishedCanonicalBriefSchema = z
  .object({
    brief_name: z.string().trim().min(1).optional(),
    creative_intent: z.string().trim().min(1).optional(),
    creator_brief: z.string().trim().min(1).optional(),
    creator_requirements: z.string().trim().min(1).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one published Brief field must be supplied.",
  });

export const storedCanonicalBriefPublishSchema = z.object({
  briefName: z.string().trim().min(1),
  creativeIntent: z.string().trim().min(1),
  creatorBrief: z.string().trim().min(1),
  briefType: z.enum(["CREATOR_LED", "BRAND_LED"]),
  platform: z.literal("INSTAGRAM"),
  briefLevelGuidance: structuredJsonSchema.optional().nullable(),
  referenceContent: structuredJsonSchema.optional().nullable(),
  usageRights: structuredJsonSchema.optional().nullable(),
  creatorRequirements: z.string().trim().min(1).optional().nullable(),
  deliverables: z
    .array(
      z.object({
        id: entityIdSchema,
        format: z.enum([
          "REEL_VIDEO",
          "STORY",
          "PHOTOSHOOT",
          "BANNER_CAROUSEL",
        ]),
        displayOrder: z.number().int().min(0),
        configuration: structuredJsonSchema.optional().nullable(),
        creativeGuidance: structuredJsonSchema.optional().nullable(),
        amplifyTargetDeliverableId: entityIdSchema.optional().nullable(),
      }),
    )
    .min(1),
});

export type CanonicalBriefDraftInput = z.infer<
  typeof createCanonicalBriefDraftSchema
>;
export type CanonicalBriefDeliverableInput = NonNullable<
  CanonicalBriefDraftInput["deliverables"]
>[number];

export function isCanonicalDeliverable(
  input: CanonicalBriefDeliverableInput,
): input is z.infer<typeof canonicalDeliverableSchema> {
  return "display_order" in input;
}

export function validateCanonicalDeliverableGraph(
  deliverables: Array<z.infer<typeof canonicalDeliverableSchema>>,
) {
  const identified = deliverables.filter(
    (item): item is typeof item & { deliverable_id: string } =>
      Boolean(item.deliverable_id),
  );
  const byId = new Map(identified.map((item) => [item.deliverable_id, item]));
  if (byId.size !== identified.length) {
    throw new Error("DUPLICATE_DELIVERABLE_ID");
  }

  for (const item of deliverables) {
    if (!item.amplify_target_deliverable_id) continue;
    if (item.format !== "STORY") {
      throw new Error("AMPLIFY_TARGET_REQUIRES_STORY");
    }
    const target = byId.get(item.amplify_target_deliverable_id);
    if (!target || target.format !== "REEL_VIDEO") {
      throw new Error("AMPLIFY_TARGET_REQUIRES_SAME_BRIEF_REEL");
    }
    if (item.deliverable_id === item.amplify_target_deliverable_id) {
      throw new Error("AMPLIFY_TARGET_CANNOT_BE_SELF");
    }
  }
}
