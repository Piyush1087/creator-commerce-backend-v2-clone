import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CampaignObjective,
  Prisma,
  UceApplicationScope,
  UceAudienceGender,
  UceBrandSupportType,
  UceCampaignCreationSource,
  UceCampaignObjective,
  UceCampaignStatus,
  UceCompensationType,
  UceMediaPlatform,
  UcePayoutTerms,
  UcePublishingSchedule,
  UceTimelineStructure,
  UceVisibilityScope,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  canonicalCampaignDraftPatchSchema,
  parseCanonicalDraftValue,
  type CanonicalCampaignDraftPath,
} from "../schemas/canonical-campaign-draft.schema";
import {
  canonicalCampaignWizardSchema,
  type CanonicalCampaignWizardPayload,
} from "../schemas/canonical-campaign-wizard.schema";
import { BrandUceCampaignService } from "./brand-uce-campaign.service";

const PRIMARY_KPI = {
  PULSE: "REACH",
  PROOF: "MEANINGFUL_ENGAGEMENT",
  PRODUCTION: "ASSET_QUALITY_SCORE",
  PUSH: "UNIQUE_CTA_CLICKS",
} as const;

const SUPPORTING_KPIS = {
  D2C: {
    PULSE: ["DISCOVER_REACH", "IMPRESSIONS", "PROFILE_VISITS", "NEW_FOLLOWERS"],
    PROOF: ["SAVES", "SHARES", "COMMENT_SENTIMENT", "UGC_MENTIONS"],
    PRODUCTION: ["BRAND_COMPLIANCE", "CREATIVE_VARIETY", "VISUAL_QUALITY", "ASSET_REUSABILITY"],
    PUSH: ["CTR", "TOTAL_CTA_CLICKS", "REPEAT_CLICKS", "PROMO_LINK_CLICKS"],
  },
  SAAS_AI: {
    PULSE: ["IMPRESSIONS", "PROFILE_VISITS", "WEBSITE_CLICKS", "NEW_FOLLOWERS"],
    PROOF: ["STORY_COMPLETION_RATE", "SAVES", "PROFILE_VISITS", "DM_INQUIRIES"],
    PRODUCTION: ["FEATURE_CLARITY", "SCREEN_RECORDING_QUALITY", "TECHNICAL_ACCURACY", "ASSET_REUSABILITY"],
    PUSH: ["CTR", "LANDING_PAGE_VISITS", "DOCUMENTATION_CLICKS", "TRIAL_PAGE_VISITS"],
  },
  HEALTHCARE: {
    PULSE: ["LOCAL_REACH", "PROFILE_VISITS", "NEW_FOLLOWERS", "LOCAL_AUDIENCE_PERCENT"],
    PROOF: ["DM_INQUIRIES", "SAVES", "SHARES", "COMMENT_SENTIMENT"],
    PRODUCTION: ["MEDICAL_COMPLIANCE", "BRAND_COMPLIANCE", "EDUCATIONAL_ACCURACY", "ASSET_REUSABILITY"],
    PUSH: ["WHATSAPP_CLICKS", "BOOKING_PAGE_CLICKS", "MAPS_CLICKS", "TOTAL_CTA_CLICKS"],
  },
} as const;

type DraftSection = Record<string, unknown>;
type CanonicalDraftDefinition = {
  version: "1.2";
  creationSource: "MANUAL";
  draft: {
    strategy: DraftSection;
    targeting: DraftSection;
    commercials: DraftSection;
  };
};

function emptyDraftDefinition(): CanonicalDraftDefinition {
  return {
    version: "1.2",
    creationSource: "MANUAL",
    draft: { strategy: {}, targeting: {}, commercials: {} },
  };
}

function legacyObjective(
  objective: CanonicalCampaignWizardPayload["strategy"]["core_objective"],
): UceCampaignObjective {
  if (objective === "PUSH") return UceCampaignObjective.SALES_CONVERSIONS;
  return UceCampaignObjective.BRAND_AWARENESS;
}

function canonicalObjective(
  objective: CanonicalCampaignWizardPayload["strategy"]["core_objective"],
): CampaignObjective {
  if (objective === "PULSE") return CampaignObjective.PULSE;
  if (objective === "PROOF") return CampaignObjective.PROOF;
  if (objective === "PRODUCTION") return CampaignObjective.PRODUCTION;
  return CampaignObjective.PUSH;
}

function canonicalGender(
  gender: CanonicalCampaignWizardPayload["targeting"]["audience_gender"],
): UceAudienceGender {
  if (gender === "FEMALE") return UceAudienceGender.FEMALE;
  if (gender === "MALE") return UceAudienceGender.MALE;
  return UceAudienceGender.ALL;
}

function canonicalBrandSupportType(
  value: CanonicalCampaignWizardPayload["commercials"]["brand_support_type"],
): UceBrandSupportType | null {
  if (!value) return null;
  if (value === "PRODUCT") return UceBrandSupportType.PRODUCT;
  if (value === "SERVICE") return UceBrandSupportType.SERVICE;
  if (value === "EXPERIENCE") return UceBrandSupportType.EXPERIENCE;
  if (value === "ACCESS_SUBSCRIPTION") {
    return UceBrandSupportType.ACCESS_SUBSCRIPTION;
  }
  return UceBrandSupportType.OTHER;
}

function legacyVisibility(
  value: CanonicalCampaignWizardPayload["strategy"]["campaign_visibility"],
): UceVisibilityScope {
  if (value === "ELIGIBLE_CREATORS_ONLY") return UceVisibilityScope.ELIGIBLE_ONLY;
  if (value === "INVITE_ONLY") return UceVisibilityScope.INVITED_ONLY;
  return UceVisibilityScope.EVERYONE;
}

function legacyApplicationScope(
  value: CanonicalCampaignWizardPayload["strategy"]["campaign_visibility"],
): UceApplicationScope {
  if (value === "ELIGIBLE_CREATORS_ONLY") return UceApplicationScope.ELIGIBLE_ONLY;
  if (value === "INVITE_ONLY") return UceApplicationScope.INVITED_ONLY;
  return UceApplicationScope.EVERYONE;
}

function legacyPayout(
  value: CanonicalCampaignWizardPayload["commercials"]["payout_terms"],
): UcePayoutTerms {
  if (value === "NET_7") return UcePayoutTerms.NET_7;
  if (value === "NET_15") return UcePayoutTerms.NET_15;
  if (value === "NET_45") return UcePayoutTerms.NET_45;
  if (value === "NET_60") return UcePayoutTerms.NET_60;
  return UcePayoutTerms.NET_30;
}

function sectionAndField(path: CanonicalCampaignDraftPath) {
  const [section, field] = path.split(".") as [
    "strategy" | "targeting" | "commercials",
    string,
  ];
  return { section, field };
}

function validateDraftCrossField(definition: CanonicalDraftDefinition) {
  const { strategy, targeting, commercials } = definition.draft;

  const minFollowers = targeting.minimum_followers;
  const maxFollowers = targeting.maximum_followers;
  if (
    typeof minFollowers === "number" &&
    typeof maxFollowers === "number" &&
    maxFollowers <= minFollowers
  ) {
    throw new BadRequestException(
      "maximum_followers must be greater than minimum_followers.",
    );
  }

  const minAge = targeting.audience_age_min;
  const maxAge = targeting.audience_age_max;
  if (typeof minAge === "number" && typeof maxAge === "number" && maxAge < minAge) {
    throw new BadRequestException("audience_age_max must be >= audience_age_min.");
  }

  const publishFrom = strategy.publish_from;
  const publishUntil = strategy.publish_until;
  if (
    typeof publishFrom === "string" &&
    typeof publishUntil === "string" &&
    new Date(publishUntil) < new Date(publishFrom)
  ) {
    throw new BadRequestException("publish_until must be on or after publish_from.");
  }

  const offer = commercials.commercial_offer;
  const budget = commercials.total_campaign_budget;
  if (typeof offer === "number" && typeof budget === "number" && budget < offer) {
    throw new BadRequestException("total_campaign_budget must be >= commercial_offer.");
  }
}

@Injectable()
export class CanonicalCampaignCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyCampaigns: BrandUceCampaignService,
  ) {}

  async createDraft(brandProfileId: string) {
    const draft = emptyDraftDefinition();
    const campaign = await this.prisma.uceCampaign.create({
      data: {
        brandProfileId,
        // Compatibility-only required persistence field. Empty string is not accepted
        // as canonical Campaign name and is replaced only after a valid name autosaves.
        name: "",
        status: UceCampaignStatus.DRAFT,
        creationSource: UceCampaignCreationSource.MANUAL,
      },
      select: { id: true, status: true },
    });

    await this.prisma.$executeRaw`
      UPDATE "uce_campaigns"
      SET "canonical_definition" = ${JSON.stringify(draft)}::jsonb
      WHERE "id" = ${campaign.id}
    `;

    return {
      campaignId: campaign.id,
      status: campaign.status,
      creationSource: "MANUAL" as const,
    };
  }

  async autosaveField(
    brandProfileId: string,
    campaignId: string,
    input: unknown,
  ) {
    const campaign = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: { id: true, status: true },
    });
    if (!campaign) throw new BadRequestException("Campaign draft not found.");
    if (campaign.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT Campaigns can be autosaved.");
    }

    const patch = canonicalCampaignDraftPatchSchema.parse(input);
    const value = parseCanonicalDraftValue(patch.path, patch.value);

    const rows = await this.prisma.$queryRaw<Array<{ canonical_definition: unknown }>>`
      SELECT "canonical_definition"
      FROM "uce_campaigns"
      WHERE "id" = ${campaignId}
      LIMIT 1
    `;
    const current = rows[0]?.canonical_definition;
    const definition: CanonicalDraftDefinition =
      current &&
      typeof current === "object" &&
      !Array.isArray(current) &&
      "draft" in current
        ? (current as CanonicalDraftDefinition)
        : emptyDraftDefinition();

    const { section, field } = sectionAndField(patch.path);
    definition.draft[section] = {
      ...definition.draft[section],
      [field]: value,
    };

    if (patch.path === "strategy.publishing_schedule" && value === "EVERGREEN") {
      definition.draft.strategy.publish_from = null;
      definition.draft.strategy.publish_until = null;
    }
    if (patch.path === "commercials.receives_brand_support" && value === false) {
      definition.draft.commercials.brand_support_type = null;
      definition.draft.commercials.brand_support_estimated_value = null;
    }

    validateDraftCrossField(definition);

    await this.prisma.$transaction(async (tx) => {
      if (patch.path === "strategy.campaign_name") {
        await tx.uceCampaign.update({
          where: { id: campaignId },
          data: { name: value as string },
        });
      }
      await tx.$executeRaw`
        UPDATE "uce_campaigns"
        SET "canonical_definition" = ${JSON.stringify(definition)}::jsonb,
            "updated_at" = NOW()
        WHERE "id" = ${campaignId}
      `;
    });

    return { campaignId, savedPath: patch.path, savedAt: new Date().toISOString() };
  }

  async publishDraft(
    brandProfileId: string,
    campaignId: string,
    input: unknown,
  ) {
    const parsed = canonicalCampaignWizardSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Canonical Campaign publish validation failed",
        issues: parsed.error.issues,
      });
    }

    const existing = await this.prisma.uceCampaign.findFirst({
      where: { id: campaignId, brandProfileId },
      select: { id: true, status: true },
    });
    if (!existing) throw new BadRequestException("Campaign draft not found.");
    if (existing.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT Campaigns can be published.");
    }

    const payload = parsed.data;
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, countryCode: true, industry: true },
    });
    if (!brand) throw new BadRequestException("Brand profile not found");

    const currency = (brand.countryCode ?? "").toUpperCase() === "IN" ? "INR" : "USD";
    const objective = payload.strategy.core_objective;
    const supportingByIndustry = SUPPORTING_KPIS[
      brand.industry as keyof typeof SUPPORTING_KPIS
    ];
    const supportingKpis = supportingByIndustry?.[objective] ?? [];
    if (supportingKpis.length < 2) {
      throw new BadRequestException(
        "Supporting KPI resolution is unavailable for this Brand industry.",
      );
    }

    const canonicalDefinition = {
      version: "1.2",
      creationSource: "MANUAL",
      ...payload,
      derived: {
        currency,
        primaryKpi: PRIMARY_KPI[objective],
        supportingKpis,
        supportingKpiStatus: "READY",
      },
    };

    const visibility = legacyVisibility(payload.strategy.campaign_visibility);
    const isScheduled = payload.strategy.publishing_schedule === "SCHEDULED";
    const isFixed = payload.commercials.compensation_model === "FIXED";
    const publishFrom = payload.strategy.publish_from
      ? new Date(payload.strategy.publish_from)
      : null;
    const publishUntil = payload.strategy.publish_until
      ? new Date(payload.strategy.publish_until)
      : null;

    const strategyData = {
      // Canonical authority.
      publishingSchedule: isScheduled
        ? UcePublishingSchedule.SCHEDULED
        : UcePublishingSchedule.EVERGREEN,
      publishFrom,
      publishUntil,
      canonicalObjective: canonicalObjective(objective),
      primaryKpiId: PRIMARY_KPI[objective],
      supportingKpiIds: [...supportingKpis],
      platforms: [UceMediaPlatform.INSTAGRAM],
      visibilityScope: visibility,

      // Transitional compatibility projection.
      timelineType: isScheduled
        ? UceTimelineStructure.FIXED_DATES
        : UceTimelineStructure.DYNAMIC_MILESTONES,
      fixedStartDate: publishFrom,
      fixedEndDate: publishUntil,
      dynamicDaysLimit: isScheduled ? null : 1,
      coreObjective: legacyObjective(objective),
      platformDeliverables: {
        compatibility: "CANONICAL_CAMPAIGN_V1_2",
        platforms: ["INSTAGRAM"],
        canonicalObjective: objective,
      } as Prisma.InputJsonValue,
    };

    const targetingData = {
      // Canonical authority.
      creatorArchetypes: payload.targeting.creator_archetypes,
      minimumFollowers: payload.targeting.minimum_followers,
      maximumFollowers: payload.targeting.maximum_followers,
      audienceAgeMin: payload.targeting.audience_age_min,
      audienceAgeMax: payload.targeting.audience_age_max,
      audienceGender: canonicalGender(payload.targeting.audience_gender),
      audienceAffinityIds: payload.targeting.audience_affinity_ids,
      audienceGeographies:
        payload.targeting.audience_geographies as unknown as Prisma.InputJsonValue,

      // Transitional compatibility projection.
      industryVertical: String(brand.industry),
      followerTiers: [
        `MIN:${payload.targeting.minimum_followers}`,
        payload.targeting.maximum_followers == null
          ? "MAX:UNBOUNDED"
          : `MAX:${payload.targeting.maximum_followers}`,
      ],
      targetLocations: payload.targeting.audience_geographies.map((g) =>
        JSON.stringify(g),
      ),
      disqualifyingKeywords: [],
      visibilityScopes: [visibility],
      applicationScope: legacyApplicationScope(
        payload.strategy.campaign_visibility,
      ),
    };

    const commercialsData = {
      // Canonical authority.
      receivesBrandSupport: payload.commercials.receives_brand_support,
      brandSupportType: canonicalBrandSupportType(
        payload.commercials.brand_support_type,
      ),
      brandSupportEstimatedValue:
        payload.commercials.brand_support_estimated_value ?? null,
      compensationType: isFixed
        ? UceCompensationType.FIXED_FEE
        : UceCompensationType.NEGOTIABLE,
      commercialOffer: payload.commercials.commercial_offer,
      totalCampaignBudget: payload.commercials.total_campaign_budget,
      currency,
      advancePaymentPercentage: payload.commercials.advance_payment_percentage,
      finalBalanceTerms: legacyPayout(payload.commercials.payout_terms),

      // Transitional compatibility projection.
      fixedFeeAmount: isFixed ? payload.commercials.commercial_offer : 0,
      negotiableMinFee: isFixed ? 0 : payload.commercials.commercial_offer,
      negotiableMaxFee: 0,
      totalCampaignBudgetPool: payload.commercials.total_campaign_budget,
    };

    const publishedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.uceCampaign.update({
        where: { id: campaignId },
        data: {
          name: payload.strategy.campaign_name,
          status: UceCampaignStatus.PUBLISHED,
          creationSource: UceCampaignCreationSource.MANUAL,
          publishedAt,
          performanceAggregate: { upsert: { create: {}, update: {} } },
          strategy: { upsert: { create: strategyData, update: strategyData } },
          targeting: { upsert: { create: targetingData, update: targetingData } },
          commercials: {
            upsert: { create: commercialsData, update: commercialsData },
          },
        },
      });

      await tx.uceCampaignReportingSnapshot.create({
        data: {
          campaignId,
          primaryObjective: legacyObjective(objective),
          lastApiSyncTimestamp: new Date(),
        },
      });

      await tx.$executeRaw`
        UPDATE "uce_campaigns"
        SET "canonical_definition" = ${JSON.stringify(canonicalDefinition)}::jsonb,
            "updated_at" = NOW()
        WHERE "id" = ${campaignId}
      `;
    });

    return this.legacyCampaigns.getCampaignShell(brandProfileId, campaignId);
  }

  /** Backward-compatible atomic create path for transitional clients. */
  async createManual(brandProfileId: string, input: unknown) {
    const draft = await this.createDraft(brandProfileId);
    return this.publishDraft(brandProfileId, draft.campaignId, input);
  }
}
