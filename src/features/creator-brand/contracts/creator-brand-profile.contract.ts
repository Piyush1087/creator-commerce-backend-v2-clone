import { z } from "zod";
import type { CreatorWorkspaceActorRole } from "../../../shared/creator/creator-workspace-actor.contract";
import { CreatorBrandArchetypeIdSchema } from "./creator-brand-archetype.adapter";
import {
  CREATOR_BRAND_BOUNDS as B,
  CREATOR_BRAND_NICHE_IDS,
  CREATOR_BRAND_VOICE_IDS,
} from "./creator-brand-taxonomies";

/** Projection from existing canonical owners; never stored/mutated as Brand. */
export type CreatorBrandProjectedIdentity = Readonly<{
  creatorName: string | null;
  avatarImageReference: string | null;
  primaryInstagramHandle: string | null;
}>;

export const CreatorBrandNicheIdSchema = z.enum(CREATOR_BRAND_NICHE_IDS);
export const CreatorBrandVoiceIdSchema = z.enum(CREATOR_BRAND_VOICE_IDS);
export const CreatorBrandPaletteColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/u)
  .transform((value) => value.toUpperCase());
export const CreatorBrandLanguageSchema = z
  .string()
  .min(2)
  .max(100)
  .refine((value) => {
    try {
      return Intl.getCanonicalLocales(value).length === 1;
    } catch {
      return false;
    }
  }, "Valid BCP-47 tag required")
  .transform((value) => Intl.getCanonicalLocales(value)[0]);
export const CreatorBrandVisualDescriptorSchema = z
  .string()
  .trim()
  .min(1)
  .max(B.visualDescriptorCharacters);
const unique = <T extends z.ZodTypeAny>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine(
      (values) => new Set(values).size === values.length,
      "Duplicate canonical values rejected",
    );

/** No name/avatar/handle, source identity, willingness or caller-selected subject. */
export const CreatorBrandProfileInputSchema = z
  .object({
    headline: z.string().trim().min(1).max(B.headlineCharacters).nullable(),
    commercialBio: z
      .string()
      .trim()
      .min(1)
      .max(B.commercialBioCharacters)
      .nullable(),
    primaryNicheIds: unique(CreatorBrandNicheIdSchema, B.primaryNiches),
    creatorArchetypeIds: unique(
      CreatorBrandArchetypeIdSchema,
      B.configuredArchetypes,
    ),
    archetypeState: z.enum(["UNCONFIGURED", "CONFIRMED"]),
    voiceDescriptorIds: unique(CreatorBrandVoiceIdSchema, B.voiceDescriptors),
    voiceDescription: z
      .string()
      .trim()
      .min(1)
      .max(B.voiceDescriptionCharacters)
      .nullable(),
    visualStyleDescriptors: unique(
      CreatorBrandVisualDescriptorSchema,
      B.visualDescriptors,
    ),
    palette: unique(CreatorBrandPaletteColorSchema, B.paletteColors).nullable(),
    languages: unique(CreatorBrandLanguageSchema, B.languages),
  })
  .strict()
  .superRefine((profile, context) => {
    if (
      (profile.creatorArchetypeIds.length === 0) !==
      (profile.archetypeState === "UNCONFIGURED")
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["archetypeState"],
        message:
          "Empty selection is partial/unconfigured; confirmed selection requires 1..3 IDs",
      });
  });
export type CreatorBrandProfileInput = z.infer<
  typeof CreatorBrandProfileInputSchema
>;

/** Trusted internal context only: P1 must server-resolve active membership/Owner. */
export const CreatorBrandServerSubjectSchema = z
  .object({
    creatorWorkspaceId: z.string().uuid(),
    ownerCreatorProfileId: z.string().uuid(),
    ownerUserId: z.string().uuid(),
  })
  .strict();
export const CreatorBrandServerActorSchema = z
  .object({
    actorUserId: z.string().uuid(),
    actorMembershipId: z.string().uuid(),
    actorRole: z.enum(["OWNER", "MANAGER", "ASSISTANT"]),
  })
  .strict();
export const CREATOR_BRAND_ACTIONS = [
  "CREATOR_BRAND_READ",
  "CREATOR_BRAND_EDIT",
  "CREATOR_BRAND_CONFIRM_SUGGESTION",
] as const;
export const CreatorBrandActionSchema = z.enum(CREATOR_BRAND_ACTIONS);
export const CREATOR_BRAND_ROLE_POLICY = Object.freeze({
  OWNER: Object.freeze({
    CREATOR_BRAND_READ: true,
    CREATOR_BRAND_EDIT: true,
    CREATOR_BRAND_CONFIRM_SUGGESTION: true,
  }),
  MANAGER: Object.freeze({
    CREATOR_BRAND_READ: true,
    CREATOR_BRAND_EDIT: true,
    CREATOR_BRAND_CONFIRM_SUGGESTION: true,
  }),
  ASSISTANT: Object.freeze({
    CREATOR_BRAND_READ: true,
    CREATOR_BRAND_EDIT: false,
    CREATOR_BRAND_CONFIRM_SUGGESTION: false,
  }),
}) satisfies Record<
  CreatorWorkspaceActorRole,
  Record<(typeof CREATOR_BRAND_ACTIONS)[number], boolean>
>;
export const CreatorBrandMutationOriginSchema = z.enum([
  "MANUAL",
  "SUGGESTION_USED",
  "SUGGESTION_EDITED",
]);
const concurrency = {
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
};
const suggestionReference = z
  .object({
    objectGenerationId: z.string().uuid(),
    componentGenerationId: z.string().uuid(),
    candidateId: z.string().min(1).max(100),
  })
  .strict();
/** Client selects a server-held candidate; cannot claim audit/source provenance. */
export const CreatorBrandMutationRequestSchema = z.discriminatedUnion(
  "intent",
  [
    z
      .object({
        ...concurrency,
        intent: z.literal("MANUAL"),
        values: CreatorBrandProfileInputSchema,
      })
      .strict(),
    z
      .object({
        ...concurrency,
        intent: z.literal("USE_SUGGESTION"),
        suggestionReference,
      })
      .strict(),
    z
      .object({
        ...concurrency,
        intent: z.literal("EDIT_SUGGESTION"),
        suggestionReference,
        values: CreatorBrandProfileInputSchema,
      })
      .strict(),
  ],
);
export const CreatorBrandRevisionContractSchema = z
  .object({
    subject: CreatorBrandServerSubjectSchema,
    actor: CreatorBrandServerActorSchema,
    revision: z.number().int().positive(),
    previousRevision: z.number().int().nonnegative(),
    idempotencyKey: z.string().uuid(),
    createdAt: z.string().datetime(),
    origin: CreatorBrandMutationOriginSchema,
    confirmedValues: CreatorBrandProfileInputSchema,
    serverVerifiedSuggestionReference: suggestionReference.nullable(),
  })
  .strict()
  .superRefine((revision, context) => {
    if (
      revision.revision !== revision.previousRevision + 1 ||
      revision.actor.actorRole === "ASSISTANT" ||
      (revision.origin === "MANUAL") !==
        (revision.serverVerifiedSuggestionReference === null)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Serialized revision, authorized actor and server provenance required",
      });
  });
export const CREATOR_BRAND_MUTATION_BOUNDARY = Object.freeze({
  serverResolvedSubject: true,
  activeMembershipRequired: true,
  expectedRevisionRequired: true,
  idempotencyRequired: true,
  serializedTransactionRequired: true,
  postMutationValidationRequired: true,
  immutableRevisionRequired: true,
  clientProvenanceTrusted: false,
  rewriteHistoricalApplicationsCollaborations: false,
  canonicalTruthOwner: "CreatorBrandProfile",
  revisionOwner: "CreatorBrandRevision",
  intelligenceRequiredForManualSetup: false,
  sourceDisconnectDeletesCanonicalTruth: false,
  ugcArchetypeImpliesWillingness: false,
});
