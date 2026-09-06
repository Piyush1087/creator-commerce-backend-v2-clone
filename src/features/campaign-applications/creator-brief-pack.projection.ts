import { ConflictException } from "@nestjs/common";
import { z } from "zod";

const id = z.string().uuid();
const text = z.string().nullable();
const time = z.string().datetime().nullable();
const money = z.string().regex(/^\d+(?:\.\d+)?$/);
type Content =
  | string
  | number
  | boolean
  | null
  | Content[]
  | { [key: string]: Content };
// These are authored Brief content trees, never arbitrary snapshot partitions.
const content: z.ZodType<Content> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(content),
    z
      .record(content)
      .refine(
        (value) =>
          Object.keys(value).every(
            (key) =>
              !/^(actor|membership|subject|creatorIdentity|email|phone|shipping|contact|firstQualifiedTouch|conversionTouch|utm|invitation|campaignInvitation|eligibility|matchScore|provider|nativePlatform|instagramNative|integrationId|internalReview|privateBrand|notification|idempotency|commandReceipt|eventMetadata)/i.test(
                key.replace(/[_-]/g, ""),
              ),
          ),
        "Private metadata is not authored Brief content",
      ),
  ]),
);
const structuredContent = content.refine(
  (value) => value === null || typeof value === "object",
  "Brief content must be a structured tree",
);
const brand = z.object({
  name: text,
  description: text,
  logoUrl: text,
  domain: text,
});
const offering = z
  .object({ name: text, description: text, imageUrl: text, url: text })
  .nullable();
const offer = z
  .object({ offerName: text, description: text, entityLink: text })
  .nullable();
const commercial = z.object({
  compensationModel: z.enum(["FIXED", "NEGOTIABLE"]),
  offer: money,
  currency: z.enum(["INR", "USD"]),
  receivesBrandSupport: z.boolean(),
  brandSupportType: text,
  brandSupportEstimatedValue: money.nullable(),
});
const campaign = z.object({
  schemaVersion: z.literal(1),
  id,
  name: z.string(),
  brand: brand.nullable(),
  objective: text,
  platforms: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])),
  publishingStart: time,
  publishingEnd: time,
  applicationDeadline: time,
  createdAt: z.string().datetime(),
});
const asset = z.object({
  id,
  campaignId: id,
  kind: z.enum(["BRAND", "OFFERING", "OFFER"]),
  offering,
  offer,
});
const brief = z.object({
  id,
  campaignAssetId: id,
  briefName: z.string().min(1),
  creativeIntent: z.string().min(1),
  creatorBrief: z.string().min(1),
  briefType: z.enum(["CREATOR_LED", "BRAND_LED"]),
  platform: z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"]),
  briefLevelGuidance: structuredContent,
  referenceContent: structuredContent,
  usageRights: structuredContent,
  creatorRequirements: text,
  deliverables: z
    .array(
      z.object({
        id,
        format: z.enum([
          "REEL_VIDEO",
          "STORY",
          "PHOTOSHOOT",
          "BANNER_CAROUSEL",
        ]),
        displayOrder: z.number().int().min(0),
        configuration: structuredContent,
        creativeGuidance: structuredContent,
        amplifyTargetDeliverableId: id.nullable(),
      }),
    )
    .min(1),
});
const evidence = z
  .object({
    id,
    authorityVersion: z.literal("C03_CANONICAL"),
    campaignId: id,
    canonicalCampaignAssetId: id,
    canonicalBriefId: id,
    subjectCreatorProfileId: id,
    subjectCreatorWorkspaceId: id,
    appliedAt: z.date(),
    snapshot: z.object({
      applicationId: id,
      schemaVersion: z.literal("C03_APPLICATION_SNAPSHOT_V1"),
      createdAt: z.date(),
      campaignContext: campaign,
      campaignAssetContext: asset,
      briefContext: brief,
      commercialContext: commercial,
      creatorIdentity: z.object({
        subjectCreatorProfileId: id,
        workspaceId: id,
      }),
    }),
  })
  .superRefine((row, ctx) => {
    const s = row.snapshot;
    if (
      s.applicationId !== row.id ||
      s.campaignContext.id !== row.campaignId ||
      s.campaignAssetContext.id !== row.canonicalCampaignAssetId ||
      s.campaignAssetContext.campaignId !== row.campaignId ||
      s.briefContext.id !== row.canonicalBriefId ||
      s.briefContext.campaignAssetId !== row.canonicalCampaignAssetId ||
      s.creatorIdentity.subjectCreatorProfileId !==
        row.subjectCreatorProfileId ||
      s.creatorIdentity.workspaceId !== row.subjectCreatorWorkspaceId ||
      s.createdAt.getTime() !== row.appliedAt.getTime() ||
      Date.parse(s.campaignContext.createdAt) !== row.appliedAt.getTime()
    )
      ctx.addIssue({
        code: "custom",
        message: "Snapshot lineage is incomplete",
      });
  });

export function projectCreatorBriefPack(value: unknown) {
  const parsed = evidence.safeParse(value);
  if (!parsed.success)
    throw new ConflictException({ code: "APPLICATION_BRIEF_PACK_UNAVAILABLE" });
  const row = parsed.data,
    s = row.snapshot;
  return {
    schemaVersion: 1 as const,
    application: {
      applicationId: row.id,
      reference: row.id,
      submittedAt: s.createdAt.toISOString(),
    },
    brand: s.campaignContext.brand,
    campaign: {
      name: s.campaignContext.name,
      objective: s.campaignContext.objective,
      platforms: s.campaignContext.platforms,
      publishingStart: s.campaignContext.publishingStart,
      publishingEnd: s.campaignContext.publishingEnd,
      applicationDeadline: s.campaignContext.applicationDeadline,
    },
    commercial: s.commercialContext,
    asset: {
      kind: s.campaignAssetContext.kind,
      offering: s.campaignAssetContext.offering,
      offer: s.campaignAssetContext.offer,
    },
    brief: {
      briefName: s.briefContext.briefName,
      creativeIntent: s.briefContext.creativeIntent,
      creatorBrief: s.briefContext.creatorBrief,
      briefType: s.briefContext.briefType,
      platform: s.briefContext.platform,
      briefLevelGuidance: s.briefContext.briefLevelGuidance,
      referenceContent: s.briefContext.referenceContent,
      usageRights: s.briefContext.usageRights,
      creatorRequirements: s.briefContext.creatorRequirements,
      deliverables: [...s.briefContext.deliverables].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
      ),
    },
  };
}
export type CreatorBriefPackV1 = ReturnType<typeof projectCreatorBriefPack>;
