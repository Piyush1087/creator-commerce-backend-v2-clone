import { z } from "zod";

const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const GroundingRefsSchema = z
  .array(z.string().min(1))
  .min(1)
  .refine(
    (values) => new Set(values).size === values.length,
    "Grounding references must be unique",
  );

function words(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentences(value: string): number {
  return value
    .split(/[.!?]+(?:\s|$)/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function boundedText(args: {
  maxCharacters?: number;
  maxWords: number;
  minWords?: number;
  minSentences?: number;
  maxSentences?: number;
}) {
  return z
    .string()
    .trim()
    .min(1)
    .superRefine((value, ctx) => {
      if (args.maxCharacters != null && value.length > args.maxCharacters) {
        ctx.addIssue({
          code: "custom",
          message: `Must contain at most ${args.maxCharacters} characters`,
        });
      }
      const wordCount = words(value);
      if (args.minWords != null && wordCount < args.minWords) {
        ctx.addIssue({
          code: "custom",
          message: `Must contain at least ${args.minWords} words`,
        });
      }
      if (wordCount > args.maxWords) {
        ctx.addIssue({
          code: "custom",
          message: `Must contain at most ${args.maxWords} words`,
        });
      }
      const sentenceCount = sentences(value);
      if (args.minSentences != null && sentenceCount < args.minSentences) {
        ctx.addIssue({
          code: "custom",
          message: `Must contain at least ${args.minSentences} sentences`,
        });
      }
      if (args.maxSentences != null && sentenceCount > args.maxSentences) {
        ctx.addIssue({
          code: "custom",
          message: `Must contain at most ${args.maxSentences} sentences`,
        });
      }
    });
}

const TraceSchema = z
  .object({
    internal_grounding_refs: GroundingRefsSchema,
    internal_confidence: ConfidenceSchema,
  })
  .strict();

export const BrandPreviewSynthesisSchema = z
  .object({
    brand_descriptor: boundedText({
      maxCharacters: 90,
      maxWords: 14,
    }).nullable(),
    brand_understanding_narrative: boundedText({
      minWords: 30,
      maxWords: 90,
      minSentences: 2,
      maxSentences: 3,
    }).refine(
      (value) => !/[\r\n]/.test(value),
      "Narrative must be one paragraph",
    ),
    internal_trace: z
      .object({
        brand_descriptor: TraceSchema.nullable(),
        brand_understanding_narrative: TraceSchema,
      })
      .strict(),
    audience_groups: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            label: z.string().trim().min(1).max(38),
            why_it_matters: boundedText({
              maxCharacters: 240,
              maxWords: 40,
              maxSentences: 2,
            }),
            internal_grounding_refs: GroundingRefsSchema,
            internal_confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(3),
    creator_marketing_opportunities: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(55),
            why_it_matters: boundedText({
              maxCharacters: 290,
              maxWords: 48,
              maxSentences: 2,
            }),
            internal_grounding_refs: GroundingRefsSchema,
            internal_confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(3),
    creator_archetype_recommendations: z
      .array(
        z
          .object({
            archetype_id: z.string().trim().min(1),
            rationale: boundedText({
              maxCharacters: 220,
              maxWords: 34,
              minSentences: 1,
              maxSentences: 1,
            }),
            internal_grounding_refs: GroundingRefsSchema,
            internal_confidence: ConfidenceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.brand_descriptor == null) !==
      (value.internal_trace.brand_descriptor == null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["internal_trace", "brand_descriptor"],
        message: "Descriptor trace must match descriptor presence",
      });
    }
  });

export type BrandPreviewSynthesis = z.infer<typeof BrandPreviewSynthesisSchema>;

export type CanonicalArchetype = {
  id: string;
  label: string;
  isActive: boolean;
};
export type ProjectedBrandPreviewSynthesis = Omit<
  BrandPreviewSynthesis,
  "creator_archetype_recommendations"
> & {
  creator_archetype_recommendations: Array<
    BrandPreviewSynthesis["creator_archetype_recommendations"][number] & {
      label: string;
    }
  >;
};

const HEALTHCARE_FORBIDDEN =
  /\b(cure[sd]?|guarantee[sd]?|will treat|proven efficacy|diagnos(?:e|is)|promised? (?:health|clinical) outcome)\b/i;
const CAMPAIGN_FORBIDDEN =
  /\b(budget|deliverables?|creator count|followers? tier|final channel plan|guaranteed (?:growth|sales|conversion))\b/i;

function normalized(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function refsValid(refs: string[], allowed: ReadonlySet<string>): boolean {
  return refs.length > 0 && refs.every((ref) => allowed.has(ref));
}

export function validateAndPruneBrandPreview(args: {
  output: BrandPreviewSynthesis;
  evidenceRefs: string[];
  archetypes: CanonicalArchetype[];
  confirmedIndustry: string;
}): {
  output: ProjectedBrandPreviewSynthesis;
  mandatoryNarrativeValid: boolean;
  pruned: {
    descriptor: number;
    audiences: number;
    opportunities: number;
    archetypes: number;
  };
} {
  const refs = new Set(args.evidenceRefs);
  const activeArchetypes = new Map(
    args.archetypes
      .filter((item) => item.isActive)
      .map((item) => [item.id, item]),
  );
  const healthcare = args.confirmedIndustry === "HEALTHCARE";
  const descriptorValid =
    args.output.brand_descriptor == null ||
    (args.output.internal_trace.brand_descriptor != null &&
      refsValid(
        args.output.internal_trace.brand_descriptor.internal_grounding_refs,
        refs,
      ) &&
      (!healthcare ||
        !HEALTHCARE_FORBIDDEN.test(args.output.brand_descriptor)));
  const narrativeValid =
    refsValid(
      args.output.internal_trace.brand_understanding_narrative
        .internal_grounding_refs,
      refs,
    ) &&
    (!healthcare ||
      !HEALTHCARE_FORBIDDEN.test(args.output.brand_understanding_narrative));

  const audienceKeys = new Set<string>();
  const audiences = args.output.audience_groups.filter((item) => {
    const key = normalized(item.id);
    const valid =
      refsValid(item.internal_grounding_refs, refs) &&
      !audienceKeys.has(key) &&
      (!healthcare || !HEALTHCARE_FORBIDDEN.test(item.why_it_matters));
    if (valid) audienceKeys.add(key);
    return valid;
  });
  const opportunityKeys = new Set<string>();
  const opportunities = args.output.creator_marketing_opportunities.filter(
    (item) => {
      const key = normalized(item.title);
      const valid =
        refsValid(item.internal_grounding_refs, refs) &&
        !opportunityKeys.has(key) &&
        !CAMPAIGN_FORBIDDEN.test(`${item.title} ${item.why_it_matters}`) &&
        (!healthcare || !HEALTHCARE_FORBIDDEN.test(item.why_it_matters));
      if (valid) opportunityKeys.add(key);
      return valid;
    },
  );
  const archetypeIds = new Set<string>();
  const archetypes = args.output.creator_archetype_recommendations.flatMap(
    (item) => {
      const canonical = activeArchetypes.get(item.archetype_id);
      if (
        !canonical ||
        archetypeIds.has(item.archetype_id) ||
        !refsValid(item.internal_grounding_refs, refs) ||
        (healthcare && HEALTHCARE_FORBIDDEN.test(item.rationale))
      ) {
        return [];
      }
      archetypeIds.add(item.archetype_id);
      return [{ ...item, label: canonical.label }];
    },
  );

  return {
    output: {
      ...args.output,
      brand_descriptor: descriptorValid ? args.output.brand_descriptor : null,
      internal_trace: {
        ...args.output.internal_trace,
        brand_descriptor: descriptorValid
          ? args.output.internal_trace.brand_descriptor
          : null,
      },
      audience_groups: audiences,
      creator_marketing_opportunities: opportunities,
      creator_archetype_recommendations: archetypes,
    },
    mandatoryNarrativeValid: narrativeValid,
    pruned: {
      descriptor: descriptorValid ? 0 : 1,
      audiences: args.output.audience_groups.length - audiences.length,
      opportunities:
        args.output.creator_marketing_opportunities.length -
        opportunities.length,
      archetypes:
        args.output.creator_archetype_recommendations.length -
        archetypes.length,
    },
  };
}

export function evaluateBrandPreviewReadiness(args: {
  gatekeeperAdmitted: boolean;
  confirmedSupportedIndustry: boolean;
  brandName: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  mandatoryNarrativeValid: boolean;
  output: ProjectedBrandPreviewSynthesis;
}):
  | { state: "PREVIEW_READY"; completeness: "NORMAL" | "PARTIAL" }
  | { state: "PREVIEW_NOT_READY"; completeness: null } {
  const ready =
    args.gatekeeperAdmitted &&
    args.confirmedSupportedIndustry &&
    Boolean(args.brandName?.trim()) &&
    Boolean(args.websiteUrl?.trim()) &&
    args.mandatoryNarrativeValid &&
    args.output.audience_groups.length >= 1 &&
    args.output.creator_marketing_opportunities.length >= 1 &&
    args.output.creator_archetype_recommendations.length >= 1;
  if (!ready) return { state: "PREVIEW_NOT_READY", completeness: null };
  const normal =
    Boolean(args.logoUrl && args.output.brand_descriptor) &&
    args.output.audience_groups.length >= 2 &&
    args.output.creator_marketing_opportunities.length >= 2 &&
    args.output.creator_archetype_recommendations.length >= 2;
  return {
    state: "PREVIEW_READY",
    completeness: normal ? "NORMAL" : "PARTIAL",
  };
}
