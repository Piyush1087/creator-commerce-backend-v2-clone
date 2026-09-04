import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  UceBriefStatus,
  UceCampaignAssetStatus,
  UceVisibilityScope,
} from "@prisma/client";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  storedCanonicalBriefPublishSchema,
  validateCanonicalDeliverableGraph,
} from "../schemas/canonical-campaign-brief.schema";

const storedDefinitionSchema = z
  .object({
    version: z.literal("1.2"),
    creationSource: z.enum(["MANUAL", "AI_RECOMMENDED"]),
    strategy: z
      .object({
        platforms: z.array(z.enum(["INSTAGRAM", "TIKTOK", "YOUTUBE"])).min(1),
        campaign_visibility: z.enum([
          "PUBLIC",
          "ELIGIBLE_CREATORS_ONLY",
          "INVITE_ONLY",
        ]),
      })
      .passthrough(),
    targeting: z.record(z.unknown()),
    commercials: z
      .object({
        receives_brand_support: z.boolean(),
        brand_support_type: z
          .enum([
            "PRODUCT",
            "SERVICE",
            "EXPERIENCE",
            "ACCESS_SUBSCRIPTION",
            "OTHER",
          ])
          .optional()
          .nullable(),
        brand_support_estimated_value: z
          .number()
          .finite()
          .min(0)
          .optional()
          .nullable(),
        commercial_offer: z.number().finite().min(0),
        total_campaign_budget: z.number().finite().min(0),
      })
      .passthrough(),
    derived: z.object({ currency: z.enum(["INR", "USD"]) }).passthrough(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (
      !value.commercials.receives_brand_support &&
      (value.commercials.brand_support_type != null ||
        value.commercials.brand_support_estimated_value != null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commercials", "receives_brand_support"],
        message: "Brand-support values must be empty when support is disabled.",
      });
    }
    if (
      value.commercials.receives_brand_support &&
      !value.commercials.brand_support_type
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commercials", "brand_support_type"],
        message: "Brand support type is required.",
      });
    }
    if (
      value.commercials.total_campaign_budget <
      value.commercials.commercial_offer
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commercials", "total_campaign_budget"],
        message: "Campaign budget is lower than the commercial offer.",
      });
    }
  });

const campaignApplicationReadInclude =
  Prisma.validator<Prisma.UceCampaignInclude>()({
    strategy: true,
    targeting: true,
    commercials: true,
    assets: {
      orderBy: { createdAt: "asc" },
      include: {
        canonicalBriefs: {
          orderBy: { createdAt: "asc" },
          include: {
            deliverables: {
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    },
  });

type CampaignApplicationReadRow = Prisma.UceCampaignGetPayload<{
  include: typeof campaignApplicationReadInclude;
}>;

export type CanonicalBriefReadinessInput = {
  status: UceBriefStatus;
  briefName: string | null;
  creativeIntent: string | null;
  creatorBrief: string | null;
  briefType: "CREATOR_LED" | "BRAND_LED" | null;
  platform: "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | null;
  briefLevelGuidance: unknown;
  referenceContent: unknown;
  usageRights: unknown;
  creatorRequirements: string | null;
  deliverables: Array<{
    id: string;
    format: "REEL_VIDEO" | "STORY" | "PHOTOSHOOT" | "BANNER_CAROUSEL" | null;
    displayOrder: number | null;
    configuration: unknown;
    creativeGuidance: unknown;
    amplifyTargetDeliverableId: string | null;
  }>;
};

export function resolveCanonicalBriefReadiness(
  brief: CanonicalBriefReadinessInput,
) {
  if (brief.status !== UceBriefStatus.PUBLISHED) {
    return { ready: false as const, reason: "BRIEF_NOT_PUBLISHED" as const };
  }
  const parsed = storedCanonicalBriefPublishSchema.safeParse(brief);
  if (!parsed.success) {
    return {
      ready: false as const,
      reason: "BRIEF_DEFINITION_INCOMPLETE" as const,
      missingRequirements: [
        ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
      ],
    };
  }
  try {
    validateCanonicalDeliverableGraph(
      parsed.data.deliverables.map((item) => ({
        deliverable_id: item.id,
        format: item.format,
        display_order: item.displayOrder,
        configuration: item.configuration,
        creative_guidance: item.creativeGuidance,
        amplify_target_deliverable_id: item.amplifyTargetDeliverableId,
      })),
    );
  } catch {
    return {
      ready: false as const,
      reason: "BRIEF_DELIVERABLE_GRAPH_INVALID" as const,
    };
  }
  return { ready: true as const };
}

export function isApplicationSelectableBrief(
  brief: CanonicalBriefReadinessInput,
) {
  return resolveCanonicalBriefReadiness(brief).ready;
}

@Injectable()
export class CanonicalCampaignApplicationReadService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(brandProfileId: string, campaignId: string) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      include: campaignApplicationReadInclude,
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    return projectCanonicalCampaignForApplication(campaign);
  }
}

export function projectCanonicalCampaignForApplication(
  campaign: CampaignApplicationReadRow,
) {
  const definition = storedDefinitionSchema.safeParse(
    campaign.canonicalDefinition,
  );
  const validDefinition = definition.success ? definition.data : null;
  const visibility = resolveVisibility(campaign, validDefinition);
  const platforms = campaign.strategy?.platforms.length
    ? campaign.strategy.platforms
    : (validDefinition?.strategy.platforms ?? []);
  const commercial = resolveCommercial(campaign, validDefinition);

  return {
    adapterVersion: "C03_CAMPAIGN_APPLICATION_READ_V1" as const,
    campaign: {
      id: campaign.id,
      brandProfileId: campaign.brandProfileId,
      name: campaign.name,
      status: campaign.status,
      creationSource: campaign.creationSource,
      liveAt: campaign.liveAt,
      applicationDeadline: campaign.applicationDeadline,
      platforms,
      visibility,
      commercial,
    },
    assets: campaign.assets.map((asset) => ({
      id: asset.id,
      campaignId: asset.campaignId,
      kind: asset.kind,
      status: asset.status,
      briefs: asset.canonicalBriefs.map((brief) => {
        const readiness = resolveCanonicalBriefReadiness(brief);
        return {
          id: brief.id,
          campaignAssetId: brief.campaignAssetId,
          status: brief.status,
          applicationSelection:
            asset.status === UceCampaignAssetStatus.ACTIVE && readiness.ready
              ? ({ state: "AVAILABLE" } as const)
              : ({
                  state: "UNAVAILABLE",
                  reason:
                    asset.status !== UceCampaignAssetStatus.ACTIVE
                      ? "CAMPAIGN_ASSET_NOT_ACTIVE"
                      : readiness.reason,
                } as const),
          definition: {
            briefName: brief.briefName,
            creativeIntent: brief.creativeIntent,
            creatorBrief: brief.creatorBrief,
            briefType: brief.briefType,
            platform: brief.platform,
            briefLevelGuidance: brief.briefLevelGuidance,
            referenceContent: brief.referenceContent,
            usageRights: brief.usageRights,
            creatorRequirements: brief.creatorRequirements,
            deliverables: brief.deliverables.map((deliverable) => ({
              id: deliverable.id,
              format: deliverable.format,
              displayOrder: deliverable.displayOrder,
              configuration: deliverable.configuration,
              creativeGuidance: deliverable.creativeGuidance,
              amplifyTargetDeliverableId:
                deliverable.amplifyTargetDeliverableId,
            })),
          },
        };
      }),
    })),
  };
}

function resolveVisibility(
  campaign: CampaignApplicationReadRow,
  definition: z.infer<typeof storedDefinitionSchema> | null,
) {
  const persisted = campaign.targeting?.visibilityScope;
  if (persisted) return { state: "AVAILABLE" as const, value: persisted };
  const legacy = campaign.targeting?.visibilityScopes ?? [];
  if (legacy.length === 1) {
    return { state: "AVAILABLE" as const, value: legacy[0] };
  }
  const authored = definition?.strategy.campaign_visibility;
  if (authored) {
    const value: UceVisibilityScope =
      authored === "PUBLIC"
        ? UceVisibilityScope.EVERYONE
        : authored === "ELIGIBLE_CREATORS_ONLY"
          ? UceVisibilityScope.ELIGIBLE_ONLY
          : UceVisibilityScope.INVITED_ONLY;
    return { state: "AVAILABLE" as const, value };
  }
  return {
    state: "UNAVAILABLE" as const,
    reason: "CAMPAIGN_VISIBILITY_CONFIGURATION_INVALID" as const,
  };
}

function resolveCommercial(
  campaign: CampaignApplicationReadRow,
  definition: z.infer<typeof storedDefinitionSchema> | null,
) {
  const commercial = campaign.commercials;
  if (
    commercial?.canonicalVersion === 1 &&
    commercial.commercialOffer != null &&
    commercial.currency != null &&
    commercial.receivesBrandSupport != null
  ) {
    return {
      state: "AVAILABLE" as const,
      canonicalVersion: 1 as const,
      commercialOffer: commercial.commercialOffer,
      currency: commercial.currency,
      receivesBrandSupport: commercial.receivesBrandSupport,
      brandSupportType: commercial.brandSupportType,
      brandSupportEstimatedValue: commercial.brandSupportEstimatedValue,
      totalCampaignBudget: commercial.totalCampaignBudgetPool,
    };
  }
  if (definition) {
    return {
      state: "AVAILABLE" as const,
      canonicalVersion: 1 as const,
      commercialOffer: new Prisma.Decimal(
        definition.commercials.commercial_offer,
      ),
      currency: definition.derived.currency,
      receivesBrandSupport: definition.commercials.receives_brand_support,
      brandSupportType: definition.commercials.brand_support_type ?? null,
      brandSupportEstimatedValue:
        definition.commercials.brand_support_estimated_value == null
          ? null
          : new Prisma.Decimal(
              definition.commercials.brand_support_estimated_value,
            ),
      totalCampaignBudget: new Prisma.Decimal(
        definition.commercials.total_campaign_budget,
      ),
    };
  }
  return {
    state: "UNAVAILABLE" as const,
    reason: "CAMPAIGN_COMMERCIAL_CONFIGURATION_INVALID" as const,
  };
}
