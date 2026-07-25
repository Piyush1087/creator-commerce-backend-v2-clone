import { z } from "zod";

/**
 * Phase 7 Evidence — citations must be real page references.
 * Stricter than Stage 1A: Brand DNA requires at least one evidence item.
 */
export const EvidenceSchema = z.object({
  page_url: z.string().min(1, "Evidence citation must include a page URL"),
  page_type: z.string().min(1, "Page type taxonomy identifier is required"),
  excerpt: z.string().min(1, "Textual proof citation cannot be empty"),
});

/**
 * Phase 7 Universal Field Wrapper — every AI field must carry provenance.
 * evidence.min(1) matches the Phase 7 change-doc contract.
 */
function createBrandDnaWrapper<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    confidence: z.number().int().min(0).max(100),
    evidence: z
      .array(EvidenceSchema)
      .min(1, "At least one verified citation source is required"),
    source: z.enum(["AI", "USER", "SYSTEM"]),
    edited: z.boolean().default(false),
  });
}

export const AudiencePersonaSchema = z.object({
  name: createBrandDnaWrapper(z.string().min(1)),
  age_range: createBrandDnaWrapper(z.string().min(1)),
  gender: createBrandDnaWrapper(z.string().min(1)),
  geography: createBrandDnaWrapper(z.string().min(1)),
  affluence_score: createBrandDnaWrapper(z.string().min(1)),
  traits: createBrandDnaWrapper(z.array(z.string().min(1)).min(1)),
});

/**
 * Full 8-field Brand DNA snapshot (canonical Intelligence Engine / Prompt Package).
 * Phase 7 sample only listed 3 fields; we enforce the full Prompt A contract.
 * Personas: min 1 / max 6 (lenient Zod so thin sites don't force NEEDS_REVIEW;
 * the prompt still asks for 2–4).
 */
export const BrandDnaSnapshotSchema = z.object({
  industry_niche: createBrandDnaWrapper(z.string().min(1)),
  brand_positioning: createBrandDnaWrapper(z.string().min(1)),
  brand_narrative: createBrandDnaWrapper(z.string().min(1)),
  core_value_proposition: createBrandDnaWrapper(z.string().min(1)),
  key_differentiators: createBrandDnaWrapper(
    z.array(z.string().min(1)).min(1),
  ),
  tone_of_voice: createBrandDnaWrapper(z.array(z.string().min(1)).min(1)),
  visual_aesthetic: createBrandDnaWrapper(z.array(z.string().min(1)).min(1)),
  audience_personas: z
    .array(AudiencePersonaSchema)
    .min(1, "At least one target consumer persona must be identified")
    .max(6),
});

export type BrandDnaSnapshot = z.infer<typeof BrandDnaSnapshotSchema>;
export type AudiencePersona = z.infer<typeof AudiencePersonaSchema>;
