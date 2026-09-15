import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { IntelligenceReadiness } from "@prisma/client";
import { sha256Canonical } from "../brand-intelligence/contracts/bundle/canonical-json";
import type {
  ProcessorExecutor,
  ProcessorExecutorContext,
} from "../brand-intelligence/execution/executor/processor-executor";
import { ProcessorExecutorFailure } from "../brand-intelligence/execution/executor/processor-executor";
import {
  CreatorBrandSuggestionsSchema,
  CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY,
} from "./contracts/creator-brand-suggestions.contract";
import type { CreatorBrandAdmittedSource } from "./creator-brand-content-source.adapter";
import { CreatorBrandAdmittedSourceSchema } from "./creator-brand-content-source.adapter";

export const CREATOR_BRAND_SEMANTIC_PORT = Symbol(
  "CREATOR_BRAND_SEMANTIC_PORT",
);
export const CREATOR_BRAND_SEMANTIC_PROFILE = "creator-brand-semantic-v0.1";
export interface CreatorBrandSemanticPort {
  identity(): { provider: string; model: string; profileVersion: string };
  /** Source text is untrusted data, never instructions. No tools or media access are supplied. */
  observe(
    input: Readonly<{
      profile: typeof CREATOR_BRAND_SEMANTIC_PROFILE;
      posts: CreatorBrandAdmittedSource["posts"];
    }>,
  ): Promise<unknown>;
}
@Injectable()
export class MissingCreatorBrandSemanticPort implements CreatorBrandSemanticPort {
  identity() {
    return {
      provider: "UNCONFIGURED",
      model: "UNCONFIGURED",
      profileVersion: CREATOR_BRAND_SEMANTIC_PROFILE,
    };
  }
  async observe(): Promise<never> {
    throw new ProcessorExecutorFailure({
      category: "VALIDATION_FAILURE",
      code: "CREATOR_BRAND_SEMANTIC_UNAVAILABLE",
    });
  }
}
const fields = [
  "primaryNicheIds",
  "headline",
  "voiceDescriptorIds",
  "voiceDescription",
  "creatorArchetypeIds",
  "visualStyleDescriptors",
  "paletteCue",
  "languageTags",
] as const;
export const CreatorBrandSemanticCandidatesSchema = z
  .object({
    contractVersion: z.literal("1.0"),
    candidates: z
      .array(
        z
          .object({
            field: z.enum(fields),
            value: z.union([
              z.string().min(1).max(300),
              z.array(z.string().min(1).max(100)).min(1).max(10),
              z
                .object({
                  kind: z.literal("COLOR_WORDS"),
                  words: z.array(z.string().min(1).max(100)).min(1).max(5),
                })
                .strict(),
              z
                .object({
                  kind: z.literal("EXACT_HEX"),
                  colors: z.array(z.string().max(7)).min(1).max(5),
                })
                .strict(),
            ]),
            support: z
              .array(
                z
                  .object({
                    providerMediaId: z.string().min(1).max(100),
                    modality: z.enum([
                      "themes",
                      "captionPatterns",
                      "creativeStructures",
                      "visualExecution",
                      "caption",
                    ]),
                    excerpt: z.string().min(1).max(240),
                  })
                  .strict(),
              )
              .min(1)
              .max(24),
          })
          .strict(),
      )
      .max(8),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.candidates.map((item) => item.field)).size ===
      value.candidates.length,
  );
export const CreatorBrandProcessorInputSchema = z
  .object({
    kind: z.literal("CREATOR_BRAND_INPUT_V1"),
    source: CreatorBrandAdmittedSourceSchema,
    semanticIdentity: z
      .object({
        provider: z.string().min(1).max(100),
        model: z.string().min(1).max(100),
        profileVersion: z.string().min(1).max(100),
      })
      .strict(),
  })
  .strict();
export const CreatorBrandPersistencePayloadSchema = z
  .object({
    kind: z.literal("CREATOR_BRAND_PERSISTENCE_V1"),
    source: CreatorBrandAdmittedSourceSchema,
    value: CreatorBrandSuggestionsSchema,
  })
  .strict();
type Family = keyof typeof CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY;
export const creatorBrandFieldFamily: Record<(typeof fields)[number], Family> =
  {
    primaryNicheIds: "positioning",
    headline: "positioning",
    voiceDescriptorIds: "voice_personality",
    voiceDescription: "voice_personality",
    creatorArchetypeIds: "creator_style",
    visualStyleDescriptors: "visual_identity",
    paletteCue: "visual_identity",
    languageTags: "languages",
  };
const modalities: Record<Family, string[]> = {
  positioning: ["themes", "caption"],
  voice_personality: ["captionPatterns", "caption"],
  creator_style: ["creativeStructures", "themes", "caption"],
  visual_identity: ["visualExecution"],
  languages: ["caption"],
};
export function finalizeCreatorBrandCandidates(
  source: CreatorBrandAdmittedSource,
  raw: unknown,
  identity: CreatorBrandSemanticPort["identity"] extends () => infer T
    ? T
    : never,
) {
  const observed = CreatorBrandSemanticCandidatesSchema.parse(raw);
  const families: Record<string, Record<string, unknown>> = {
    positioning: {},
    voice_personality: {},
    creator_style: {},
    visual_identity: {},
    languages: {},
  };
  for (const field of fields)
    families[creatorBrandFieldFamily[field]][field] = {
      availability: "INSUFFICIENT_EVIDENCE",
      reason: "No sufficiently supported candidate in admitted Content",
    };
  for (const candidate of observed.candidates) {
    const family = creatorBrandFieldFamily[candidate.field];
    const supportIds = candidate.support.map((item) => item.providerMediaId);
    if (new Set(supportIds).size !== supportIds.length)
      throw new Error("CREATOR_BRAND_DUPLICATE_SUPPORT");
    const posts = candidate.support.map((support) => {
      const post = source.posts.find(
        (item) => item.providerMediaId === support.providerMediaId,
      );
      if (
        !post ||
        post.semantic.state !== "AVAILABLE" ||
        !modalities[family].includes(support.modality)
      )
        throw new Error("CREATOR_BRAND_SUPPORT_NOT_ADMITTED");
      const data =
        support.modality === "caption"
          ? post.caption
            ? [post.caption]
            : []
          : post.semantic[support.modality];
      if (
        !data.some((text) =>
          text.normalize("NFKC").includes(support.excerpt.normalize("NFKC")),
        )
      )
        throw new Error("CREATOR_BRAND_SUPPORT_NOT_GROUNDED");
      return post;
    });
    if (
      !source.providerInventoryComplete ||
      source.semanticCoverage < 0.5 ||
      posts.length < 3
    )
      continue;
    // The accepted Content source has no deterministic pixel/palette proof. Never invent hex.
    if (
      candidate.field === "paletteCue" &&
      (candidate.value as { kind?: string })?.kind === "EXACT_HEX"
    )
      throw new Error("CREATOR_BRAND_EXACT_HEX_UNSUPPORTED");
    const candidateText =
      typeof candidate.value === "string"
        ? candidate.value
        : Array.isArray(candidate.value)
          ? candidate.value.join(" ")
          : "";
    if (
      /\b(?:best[- ]performing|top[- ]performing|high[- ]performing|outperform(?:s|ed|ing)?|superior|proven (?:roi|conversion)|(?:guaranteed|drives?|boosts?|increases?) (?:roi|sales|conversions|engagement)|more effective)\b/iu.test(
        candidateText.normalize("NFKC"),
      )
    )
      throw new Error("CREATOR_BRAND_PERFORMANCE_OR_CAUSAL_CLAIM_UNSUPPORTED");
    if (
      candidate.field === "paletteCue" &&
      typeof candidate.value === "object" &&
      !Array.isArray(candidate.value)
    ) {
      const words = (candidate.value as { words: string[] }).words;
      for (const word of words) {
        const normalized = word.normalize("NFKC").toLocaleLowerCase("en");
        if (
          !candidate.support.every((support) => {
            const text = support.excerpt
              .normalize("NFKC")
              .toLocaleLowerCase("en");
            const index = text.indexOf(normalized);
            return (
              index >= 0 &&
              !/[\p{L}\p{N}_]/u.test(text[index - 1] ?? "") &&
              !/[\p{L}\p{N}_]/u.test(text[index + normalized.length] ?? "")
            );
          })
        )
          throw new Error("CREATOR_BRAND_COLOR_WORD_NOT_GROUNDED");
      }
    }
    const confidence =
      posts.length >= 5 &&
      source.semanticCoverage >= 0.7 &&
      new Set(posts.map((post) => post.publicationDate)).size >= 2
        ? "MEDIUM"
        : "LOW";
    families[family][candidate.field] = {
      availability: "AVAILABLE",
      value: candidate.value,
      support: {
        confidence,
        eligiblePostIds: supportIds.sort(),
        evidenceRefs: [
          ...new Set(posts.flatMap((post) => post.evidenceRefs)),
        ].sort(),
        sourceComponentGenerationIds: source.componentGenerations
          .filter((item) =>
            CREATOR_BRAND_SOURCE_COMPONENTS_BY_FAMILY[family].includes(
              item.path,
            ),
          )
          .map((item) => item.generationId),
        derivation: { kind: "MODEL", ...identity, contractVersion: "1.0" },
      },
    };
  }
  return CreatorBrandSuggestionsSchema.parse({
    contractVersion: "1.0",
    objectSemanticId: "creator_brand_suggestions",
    subject: source.subject,
    authority: "CREATOR_SHOP_DERIVED",
    protection: "UNPROTECTED",
    autoApply: false,
    processorVersion: "1.0",
    sourceContent: {
      objectSemanticId: "creator_content",
      objectGenerationId: source.objectGenerationId,
      ownerScopeId: source.ownerScopeId,
      subject: source.subject,
      componentGenerations: source.componentGenerations,
      evidenceRefs: source.evidence.map((item) => item.evidenceRef),
      providerInventoryComplete: source.providerInventoryComplete,
      semanticCoverage: source.semanticCoverage,
      posts: source.posts.map(
        ({ providerMediaId, publicationDate, evidenceRefs }) => ({
          providerMediaId,
          publicationDate,
          evidenceRefs,
        }),
      ),
      windowDays: 90,
      windowEnd: source.windowEnd,
    },
    families,
  });
}
@Injectable()
export class CreatorBrandSuggestionsProcessor implements ProcessorExecutor {
  readonly processorId = "creator_brand_suggestions_v0";
  constructor(
    @Inject(CREATOR_BRAND_SEMANTIC_PORT)
    private readonly semantic: CreatorBrandSemanticPort,
  ) {}
  async execute(context: ProcessorExecutorContext) {
    const input = CreatorBrandProcessorInputSchema.parse(
      context.processorExecution.dependencyManifest,
    );
    if (
      sha256Canonical(input.source) !==
        sha256Canonical(context.processorExecution.evidenceManifest) ||
      sha256Canonical(input.semanticIdentity) !==
        sha256Canonical(this.semantic.identity())
    )
      throw new Error("CREATOR_BRAND_INPUT_IDENTITY_MISMATCH");
    await context.heartbeat();
    const sufficient =
      input.source.providerInventoryComplete &&
      input.source.semanticCoverage >= 0.5 &&
      input.source.posts.filter((post) => post.semantic.state === "AVAILABLE")
        .length >= 3;
    const raw = sufficient
      ? await this.semantic.observe({
          profile: CREATOR_BRAND_SEMANTIC_PROFILE,
          posts: input.source.posts,
        })
      : { contractVersion: "1.0", candidates: [] };
    const value = finalizeCreatorBrandCandidates(
      input.source,
      raw,
      input.semanticIdentity,
    );
    const available = Object.values(value.families)
      .flatMap((family) => Object.values(family))
      .filter((field) => field.availability === "AVAILABLE").length;
    return {
      readiness:
        available === 8
          ? IntelligenceReadiness.READY
          : IntelligenceReadiness.PARTIAL,
      telemetry: { modelCalls: sufficient ? 1 : 0, availableFields: available },
      persistencePayload: CreatorBrandPersistencePayloadSchema.parse({
        kind: "CREATOR_BRAND_PERSISTENCE_V1",
        source: input.source,
        value,
      }),
    };
  }
}
