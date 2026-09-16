import { isIP } from "node:net";
import { z } from "zod";

export const CREATOR_MEDIA_KIT_CONTRACT_VERSION =
  "creator-media-kit-v3.1" as const;
export const CREATOR_MEDIA_KIT_PUBLIC_CONTRACT_VERSION =
  "creator-media-kit-public-v3.1" as const;
export const CREATOR_MEDIA_KIT_VERIFIED_CONTRACT_VERSION =
  "creator-media-kit-verified-v3.1" as const;
export const CREATOR_MEDIA_KIT_PDF_CONTRACT_VERSION =
  "creator-media-kit-pdf-v3.1" as const;

const boundedText = (maximum: number) =>
  z
    .string()
    .transform((value) => value.normalize("NFKC").trim().replace(/\s+/gu, " "))
    .pipe(z.string().min(1).max(maximum));

export function normalizeMediaKitHttpsUrl(input: string): string {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isIP(url.hostname) ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".") ||
    (url.port && url.port !== "443") ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid)$/iu.test(url.hostname)
  )
    throw new Error("MEDIA_KIT_UNSAFE_URL");
  for (const key of url.searchParams.keys())
    if (
      /token|signature|credential|secret|password|x-amz|x-goog|expires|expiry|oauth|authkey|^(?:sig|policy|key-pair-id|hmac|sas)$/iu.test(
        key,
      )
    )
      throw new Error("MEDIA_KIT_EPHEMERAL_URL");
  url.hash = "";
  return url.toString();
}

export const MediaKitSafeUrlSchema = z
  .string()
  .max(4096)
  .transform((value, context) => {
    try {
      return normalizeMediaKitHttpsUrl(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A stable public HTTPS URL is required",
      });
      return z.NEVER;
    }
  });

export const MediaKitPublicVisualSchema = z
  .object({
    visualId: boundedText(160),
    sourceDestination: MediaKitSafeUrlSchema,
    staticAssetUrl: MediaKitSafeUrlSchema.nullable(),
    altText: boundedText(240),
  })
  .strict();

const concurrency = {
  expectedRevision: z.number().int().nonnegative(),
  idempotencyKey: z.string().uuid(),
};

export const CreatorMediaKitMutationSchema = z.discriminatedUnion("intent", [
  z
    .object({
      ...concurrency,
      intent: z.literal("UPDATE_CONFIGURATION"),
      visibility: z
        .object({
          audience: z.boolean(),
          content: z.boolean(),
          portfolio: z.boolean(),
          rateCard: z.boolean(),
        })
        .strict(),
      publicVisuals: z
        .array(MediaKitPublicVisualSchema)
        .max(3)
        .refine(
          (values) =>
            new Set(values.map((value) => value.visualId)).size ===
            values.length,
          "Duplicate public visual identity",
        ),
      featuredPortfolioItemIds: z
        .array(z.string().regex(/^portfolio-item:[a-f0-9]{64}$/u))
        .max(6)
        .refine(
          (values) => new Set(values).size === values.length,
          "Duplicate featured Portfolio identity",
        ),
    })
    .strict(),
  z
    .object({
      ...concurrency,
      intent: z.literal("PUBLISH"),
    })
    .strict(),
  z
    .object({
      ...concurrency,
      intent: z.literal("UNPUBLISH"),
    })
    .strict(),
]);

export type CreatorMediaKitMutation = z.infer<
  typeof CreatorMediaKitMutationSchema
>;

export const CreatorMediaKitEventRequestSchema = z
  .object({
    eventType: z.enum([
      "KIT_VIEW",
      "PUBLIC_THUMBNAIL_SOURCE_OPENED",
      "WORK_WITH_CREATOR_CLICK",
      "REVEAL_EMAIL_ID_CLICK",
      "MEDIA_KIT_PDF_DOWNLOAD",
    ]),
  })
  .strict();

export const MediaKitIdentitySchema = z
  .object({
    name: boundedText(160).nullable(),
    avatarUrl: MediaKitSafeUrlSchema.nullable(),
    instagramHandle: boundedText(100).nullable(),
    headline: boundedText(160).nullable(),
    bio: boundedText(1000).nullable(),
    niches: z.array(boundedText(100)).max(6),
    visualStyle: z.array(boundedText(100)).max(6),
  })
  .strict();

export const MediaKitPublicShellSchema = z
  .object({
    contractVersion: z.literal(CREATOR_MEDIA_KIT_PUBLIC_CONTRACT_VERSION),
    publicId: z.string().regex(/^[a-z0-9]{24,64}$/u),
    lifecycle: z.literal("LIVE"),
    identity: MediaKitIdentitySchema,
    visuals: z.array(MediaKitPublicVisualSchema).max(3),
    callsToAction: z.tuple([
      z
        .object({
          action: z.literal("WORK_WITH_CREATOR"),
          label: z.literal("Work with Creator"),
          subtext: z.literal("Start a collaboration"),
        })
        .strict(),
      z
        .object({
          action: z.literal("REVEAL_EMAIL_ID"),
          label: z.literal("Reveal Email ID"),
          subtext: z.literal("Agencies and email enquiries"),
        })
        .strict(),
    ]),
  })
  .strict();

export type MediaKitPublicShell = z.infer<typeof MediaKitPublicShellSchema>;

export const MEDIA_KIT_ROLE_POLICY = Object.freeze({
  OWNER: Object.freeze({
    read: true,
    preview: true,
    manage: true,
    publish: true,
    pdf: true,
  }),
  MANAGER: Object.freeze({
    read: true,
    preview: true,
    manage: true,
    publish: true,
    pdf: true,
  }),
  ASSISTANT: Object.freeze({
    read: true,
    preview: true,
    manage: false,
    publish: false,
    pdf: false,
  }),
});

export const MEDIA_KIT_CTA_BOUNDARY = Object.freeze({
  workWithCreatorTerminatesAtClick: true,
  downstreamDestinationOwned: false,
  createsEnquiry: false,
  createsCampaign: false,
  createsCollaboration: false,
  triggersIntelligence: false,
  triggersOnboarding: false,
  revealEmailRequiresBrandAuthentication: false,
});

export const MEDIA_KIT_LEGACY_CUTOVER = Object.freeze({
  legacyPublicFlagAuthoritative: false,
  legacyPublicFlagMigratedToLive: false,
  newAggregateLifecycle: "DRAFT",
  legacyPublicRouteRequiresV3LiveAggregate: true,
});
