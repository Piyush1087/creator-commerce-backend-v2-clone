import { z } from "zod";
import { CreatorBrandArchetypeIdSchema } from "./creator-brand-archetype.adapter";
import {
  CreatorBrandLanguageSchema,
  CreatorBrandNicheIdSchema,
  CreatorBrandPaletteColorSchema,
  CreatorBrandServerSubjectSchema,
  CreatorBrandVisualDescriptorSchema,
  CreatorBrandVoiceIdSchema,
} from "./creator-brand-profile.contract";

export const CREATOR_BRAND_SUGGESTION_FAMILIES = [
  "positioning",
  "voice_personality",
  "creator_style",
  "visual_identity",
  "languages",
] as const;
export const CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY = Object.freeze({
  positioning: ["$/f/content_snapshot", "$/f/what_you_create"],
  voice_personality: ["$/f/content_snapshot"],
  creator_style: ["$/f/content_snapshot"],
  visual_identity: ["$/f/content_snapshot"],
  languages: ["$/f/content_snapshot"],
});
export const CREATOR_BRAND_SUFFICIENCY_PROFILE = Object.freeze({
  version: "creator-brand-support-v0.1",
  LOW: Object.freeze({
    distinctPosts: 3,
    completeProviderInventory: true,
    semanticCoverage: 0.5,
  }),
  MEDIUM: Object.freeze({
    distinctPosts: 5,
    completeProviderInventory: true,
    semanticCoverage: 0.7,
    publicationDates: 2,
  }),
  HIGH: "NOT_AUTHORIZED",
});
const reference = z.string().min(1).max(255);
const refs = z
  .array(reference)
  .min(1)
  .max(24)
  .refine((items) => new Set(items).size === items.length);
const ids = z
  .array(z.string().uuid())
  .min(1)
  .max(8)
  .refine((items) => new Set(items).size === items.length);
const derivation = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("MODEL"),
      provider: z.string().min(1).max(100),
      model: z.string().min(1).max(100),
      profileVersion: z.string().min(1).max(100),
      contractVersion: z.literal("1.0"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("DETERMINISTIC"),
      algorithmVersion: z.string().min(1).max(100),
      contractVersion: z.literal("1.0"),
    })
    .strict(),
]);
const support = z
  .object({
    confidence: z.enum(["LOW", "MEDIUM"]),
    eligiblePostIds: refs,
    evidenceRefs: refs,
    sourceComponentGenerationIds: ids,
    derivation,
  })
  .strict();
const field = <T extends z.ZodTypeAny>(value: T) =>
  z.discriminatedUnion("availability", [
    z.object({ availability: z.literal("AVAILABLE"), value, support }).strict(),
    z
      .object({
        availability: z.enum([
          "UNKNOWN",
          "UNAVAILABLE",
          "INSUFFICIENT_EVIDENCE",
          "INTENTIONALLY_ABSENT",
        ]),
        reason: z.string().min(1).max(300),
      })
      .strict(),
  ]);
const selection = <T extends z.ZodTypeAny>(value: T, max: number) =>
  z
    .array(value)
    .min(1)
    .max(max)
    .refine((items) => new Set(items).size === items.length);
const paletteCue = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("EXACT_HEX"),
      colors: selection(CreatorBrandPaletteColorSchema, 5),
    })
    .strict(),
  z
    .object({
      kind: z.literal("COLOR_WORDS"),
      words: selection(z.string().trim().min(1).max(100), 5),
    })
    .strict(),
]);
const families = z
  .object({
    positioning: z
      .object({
        primaryNicheIds: field(selection(CreatorBrandNicheIdSchema, 3)),
        headline: field(z.string().trim().min(1).max(160)),
      })
      .strict(),
    voice_personality: z
      .object({
        voiceDescriptorIds: field(selection(CreatorBrandVoiceIdSchema, 3)),
        voiceDescription: field(z.string().trim().min(1).max(300)),
      })
      .strict(),
    creator_style: z
      .object({
        creatorArchetypeIds: field(selection(CreatorBrandArchetypeIdSchema, 3)),
      })
      .strict(),
    visual_identity: z
      .object({
        visualStyleDescriptors: field(
          selection(CreatorBrandVisualDescriptorSchema, 5),
        ),
        paletteCue: field(paletteCue),
      })
      .strict(),
    languages: z
      .object({
        languageTags: field(selection(CreatorBrandLanguageSchema, 10)),
      })
      .strict(),
  })
  .strict();
const source = z
  .object({
    objectSemanticId: z.literal("creator_content"),
    objectGenerationId: z.string().uuid(),
    ownerScopeId: z.string().uuid(),
    subject: CreatorBrandServerSubjectSchema,
    componentGenerations: z
      .array(
        z
          .object({
            path: z.enum([
              "$/f/source_status",
              "$/f/content_snapshot",
              "$/f/content_highlights",
              "$/f/what_you_create",
              "$/f/content_performance",
              "$/f/representative_content",
              "$/f/freshness",
              "$/f/limitations",
            ]),
            generationId: z.string().uuid(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    evidenceRefs: refs,
    providerInventoryComplete: z.boolean(),
    semanticCoverage: z.number().min(0).max(1),
    posts: z
      .array(
        z
          .object({
            providerMediaId: reference,
            publicationDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/u)
              .refine(
                (date) =>
                  !Number.isNaN(Date.parse(date)) &&
                  new Date(date).toISOString().slice(0, 10) === date,
              ),
            evidenceRefs: refs,
          })
          .strict(),
      )
      .min(1)
      .max(24),
    windowDays: z.literal(90),
    windowEnd: z.string().datetime(),
  })
  .strict();

/** Contract only; P2 must obtain this exact source from accepted current. */
export const CreatorBrandSuggestionsSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    objectSemanticId: z.literal("creator_brand_suggestions"),
    subject: CreatorBrandServerSubjectSchema,
    authority: z.literal("CREATOR_SHOP_DERIVED"),
    protection: z.literal("UNPROTECTED"),
    autoApply: z.literal(false),
    processorVersion: z.literal("1.0"),
    sourceContent: source,
    families,
  })
  .strict()
  .superRefine((output, context) => {
    const source = output.sourceContent;
    const palette = output.families.visual_identity.paletteCue;
    if (
      palette.availability === "AVAILABLE" &&
      palette.value.kind === "EXACT_HEX" &&
      palette.support.derivation.kind !== "DETERMINISTIC"
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Exact hex cue requires deterministic source support; model color words are not hex",
      });
    if (
      source.subject.creatorWorkspaceId !== output.subject.creatorWorkspaceId ||
      source.subject.ownerCreatorProfileId !==
        output.subject.ownerCreatorProfileId ||
      source.subject.ownerUserId !== output.subject.ownerUserId
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exact same Creator source subject required",
      });
    const posts = new Map(
      source.posts.map((post) => [post.providerMediaId, post]),
    );
    const componentIds = new Set(
      source.componentGenerations.map((item) => item.generationId),
    );
    if (
      posts.size !== source.posts.length ||
      componentIds.size !== source.componentGenerations.length ||
      new Set(source.componentGenerations.map((item) => item.path)).size !==
        source.componentGenerations.length ||
      source.posts.some((post) =>
        post.evidenceRefs.some((ref) => !source.evidenceRefs.includes(ref)),
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unique exact Content source lineage required",
      });
    const fields = [
      ["positioning", output.families.positioning.primaryNicheIds],
      ["positioning", output.families.positioning.headline],
      [
        "voice_personality",
        output.families.voice_personality.voiceDescriptorIds,
      ],
      ["voice_personality", output.families.voice_personality.voiceDescription],
      ["creator_style", output.families.creator_style.creatorArchetypeIds],
      [
        "visual_identity",
        output.families.visual_identity.visualStyleDescriptors,
      ],
      ["visual_identity", output.families.visual_identity.paletteCue],
      ["languages", output.families.languages.languageTags],
    ] as const;
    for (const [family, field] of fields) {
      if (field.availability !== "AVAILABLE") continue;
      const support = field.support;
      const supportedPosts = support.eligiblePostIds.map((id) => posts.get(id));
      const admitted = new Set(
        supportedPosts.flatMap((post) => post?.evidenceRefs ?? []),
      );
      const dates = new Set(
        supportedPosts.map((post) => post?.publicationDate),
      );
      const threshold = CREATOR_BRAND_SUFFICIENCY_PROFILE[support.confidence];
      if (
        !source.providerInventoryComplete ||
        supportedPosts.some((post) => !post) ||
        supportedPosts.length < threshold.distinctPosts ||
        source.semanticCoverage < threshold.semanticCoverage ||
        (support.confidence === "MEDIUM" && dates.size < 2) ||
        support.evidenceRefs.some((ref) => !admitted.has(ref)) ||
        support.sourceComponentGenerationIds.some(
          (id) => !componentIds.has(id),
        ) ||
        support.sourceComponentGenerationIds.some(
          (id) =>
            !source.componentGenerations.some(
              (component) =>
                component.generationId === id &&
                CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY[family].some(
                  (path) => path === component.path,
                ),
            ),
        )
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Suggestion sufficiency or exact field support rejected",
        });
    }
  });
export type CreatorBrandSuggestions = z.infer<
  typeof CreatorBrandSuggestionsSchema
>;
