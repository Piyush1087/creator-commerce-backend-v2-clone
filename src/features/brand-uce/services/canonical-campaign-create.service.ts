import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Prisma,
  UceApplicationScope,
  UceCampaignObjective,
  UceCampaignStatus,
  UceCompensationType,
  UcePayoutTerms,
  UceTimelineStructure,
  UceVisibilityScope,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
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

function legacyObjective(objective: CanonicalCampaignWizardPayload["strategy"]["core_objective"]): UceCampaignObjective {
  if (objective === "PUSH") return UceCampaignObjective.SALES_CONVERSIONS;
  return UceCampaignObjective.BRAND_AWARENESS;
}

function legacyVisibility(value: CanonicalCampaignWizardPayload["strategy"]["campaign_visibility"]): UceVisibilityScope {
  if (value === "ELIGIBLE_CREATORS_ONLY") return UceVisibilityScope.ELIGIBLE_ONLY;
  if (value === "INVITE_ONLY") return UceVisibilityScope.INVITED_ONLY;
  return UceVisibilityScope.EVERYONE;
}

function legacyApplicationScope(value: CanonicalCampaignWizardPayload["strategy"]["campaign_visibility"]): UceApplicationScope {
  if (value === "ELIGIBLE_CREATORS_ONLY") return UceApplicationScope.ELIGIBLE_ONLY;
  if (value === "INVITE_ONLY") return UceApplicationScope.INVITED_ONLY;
  return UceApplicationScope.EVERYONE;
}

function legacyPayout(value: CanonicalCampaignWizardPayload["commercials"]["payout_terms"]): UcePayoutTerms {
  if (value === "NET_7") return UcePayoutTerms.NET_7;
  if (value === "NET_15") return UcePayoutTerms.NET_15;
  return UcePayoutTerms.NET_30;
}

@Injectable()
export class CanonicalCampaignCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyCampaigns: BrandUceCampaignService,
  ) {}

  async createManual(brandProfileId: string, input: unknown) {
    const parsed = canonicalCampaignWizardSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Canonical Campaign payload validation failed",
        issues: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, countryCode: true, industry: true },
    });
    if (!brand) throw new BadRequestException("Brand profile not found");

    const currency = (brand.countryCode ?? "").toUpperCase() === "IN" ? "INR" : "USD";
    const objective = payload.strategy.core_objective;
    const supportingByIndustry = SUPPORTING_KPIS[brand.industry as keyof typeof SUPPORTING_KPIS];
    const supportingKpis = supportingByIndustry?.[objective] ?? [];

    const canonicalDefinition = {
      version: "1.2",
      creationSource: "MANUAL",
      ...payload,
      derived: {
        currency,
        primaryKpi: PRIMARY_KPI[objective],
        supportingKpis,
        supportingKpiStatus: supportingKpis.length >= 2 ? "READY" : "UNAVAILABLE_FOR_INDUSTRY",
      },
    };

    const visibility = legacyVisibility(payload.strategy.campaign_visibility);
    const isScheduled = payload.strategy.publishing_schedule === "SCHEDULED";
    const isFixed = payload.commercials.compensation_model === "FIXED";

    const campaign = await this.prisma.$transaction(async (tx) => {
      const created = await tx.uceCampaign.create({
        data: {
          brandProfileId,
          name: payload.strategy.campaign_name,
          status: UceCampaignStatus.DRAFT,
          performanceAggregate: { create: {} },
          strategy: {
            create: {
              timelineType: isScheduled
                ? UceTimelineStructure.FIXED_DATES
                : UceTimelineStructure.DYNAMIC_MILESTONES,
              fixedStartDate: payload.strategy.publish_from
                ? new Date(payload.strategy.publish_from)
                : null,
              fixedEndDate: payload.strategy.publish_until
                ? new Date(payload.strategy.publish_until)
                : null,
              dynamicDaysLimit: isScheduled ? null : 1,
              coreObjective: legacyObjective(objective),
              // Compatibility-only legacy column. Deliverables are Brief-owned in the canonical model.
              platformDeliverables: {
                compatibility: "CANONICAL_CAMPAIGN_V1_2",
                platforms: ["INSTAGRAM"],
                canonicalObjective: objective,
              } as Prisma.InputJsonValue,
            },
          },
          targeting: {
            create: {
              industryVertical: String(brand.industry),
              creatorArchetypes: payload.targeting.creator_archetypes,
              followerTiers: [
                `MIN:${payload.targeting.minimum_followers}`,
                payload.targeting.maximum_followers == null
                  ? "MAX:UNBOUNDED"
                  : `MAX:${payload.targeting.maximum_followers}`,
              ],
              audienceAgeMin: payload.targeting.audience_age_min,
              audienceAgeMax: payload.targeting.audience_age_max,
              audienceGender: payload.targeting.audience_gender,
              targetLocations: payload.targeting.audience_geographies.map((g) => JSON.stringify(g)),
              // Canonical affinities live in canonical_definition until normalized UCE persistence is migrated.
              disqualifyingKeywords: [],
              visibilityScopes: [visibility],
              applicationScope: legacyApplicationScope(payload.strategy.campaign_visibility),
            },
          },
          commercials: {
            create: {
              compensationType: isFixed
                ? UceCompensationType.FIXED_FEE
                : UceCompensationType.NEGOTIABLE,
              fixedFeeAmount: isFixed ? payload.commercials.commercial_offer : 0,
              negotiableMinFee: isFixed ? 0 : payload.commercials.commercial_offer,
              // No maximum payout exists in the canonical Campaign model.
              negotiableMaxFee: 0,
              totalCampaignBudgetPool: payload.commercials.total_campaign_budget,
              advancePaymentPercentage: payload.commercials.advance_payment_percentage,
              finalBalanceTerms: legacyPayout(payload.commercials.payout_terms),
            },
          },
        },
      });

      await tx.uceCampaignReportingSnapshot.create({
        data: {
          campaignId: created.id,
          primaryObjective: legacyObjective(objective),
          lastApiSyncTimestamp: new Date(),
        },
      });

      await tx.$executeRaw`
        UPDATE "uce_campaigns"
        SET "creation_source" = 'MANUAL',
            "canonical_definition" = ${JSON.stringify(canonicalDefinition)}::jsonb
        WHERE "id" = ${created.id}
      `;

      return created;
    });

    return this.legacyCampaigns.getCampaignShell(brandProfileId, campaign.id);
  }
}
