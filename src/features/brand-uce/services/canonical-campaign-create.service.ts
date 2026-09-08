import { BadRequestException, Injectable } from "@nestjs/common";
import {
  Prisma,
  UceApplicationScope,
  UceBrandSupportType,
  UceCampaignObjective,
  UceCampaignStatus,
  UceCompensationType,
  UceMediaPlatform,
  UcePayoutTerms,
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
import { CampaignLifecycleLockService } from "./campaign-lifecycle-lock.service";
import {
  canonicalDerivedProjection,
  resolveCanonicalCampaignReadiness,
} from "./canonical-campaign-readiness.resolver";

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

function legacyVisibility(
  value: CanonicalCampaignWizardPayload["strategy"]["campaign_visibility"],
): UceVisibilityScope {
  if (value === "ELIGIBLE_CREATORS_ONLY")
    return UceVisibilityScope.ELIGIBLE_ONLY;
  if (value === "INVITE_ONLY") return UceVisibilityScope.INVITED_ONLY;
  return UceVisibilityScope.EVERYONE;
}

function legacyApplicationScope(
  value: CanonicalCampaignWizardPayload["strategy"]["campaign_visibility"],
): UceApplicationScope {
  if (value === "ELIGIBLE_CREATORS_ONLY")
    return UceApplicationScope.ELIGIBLE_ONLY;
  if (value === "INVITE_ONLY") return UceApplicationScope.INVITED_ONLY;
  return UceApplicationScope.EVERYONE;
}

function legacyPayout(
  value: CanonicalCampaignWizardPayload["commercials"]["payout_terms"],
): UcePayoutTerms {
  if (value === "NET_7") return UcePayoutTerms.NET_7;
  if (value === "NET_15") return UcePayoutTerms.NET_15;
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
  if (
    typeof minAge === "number" &&
    typeof maxAge === "number" &&
    maxAge < minAge
  ) {
    throw new BadRequestException(
      "audience_age_max must be >= audience_age_min.",
    );
  }

  const publishFrom = strategy.publish_from;
  const publishUntil = strategy.publish_until;
  if (
    typeof publishFrom === "string" &&
    typeof publishUntil === "string" &&
    new Date(publishUntil) < new Date(publishFrom)
  ) {
    throw new BadRequestException(
      "publish_until must be on or after publish_from.",
    );
  }

  const offer = commercials.commercial_offer;
  const budget = commercials.total_campaign_budget;
  if (
    typeof offer === "number" &&
    typeof budget === "number" &&
    budget < offer
  ) {
    throw new BadRequestException(
      "total_campaign_budget must be >= commercial_offer.",
    );
  }
}

@Injectable()
export class CanonicalCampaignCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyCampaigns: BrandUceCampaignService,
    private readonly campaignLock: CampaignLifecycleLockService,
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
        creationSource: "MANUAL",
        canonicalDefinition: draft as Prisma.InputJsonValue,
      },
      select: { id: true, status: true },
    });

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
      select: { id: true, status: true, canonicalDefinition: true },
    });
    if (!campaign) throw new BadRequestException("Campaign draft not found.");
    if (campaign.status !== UceCampaignStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT Campaigns can be autosaved.");
    }

    const patch = canonicalCampaignDraftPatchSchema.parse(input);
    const value = parseCanonicalDraftValue(patch.path, patch.value);

    const current = campaign.canonicalDefinition;
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

    if (
      patch.path === "strategy.publishing_schedule" &&
      value === "EVERGREEN"
    ) {
      definition.draft.strategy.publish_from = null;
      definition.draft.strategy.publish_until = null;
    }
    if (
      patch.path === "commercials.receives_brand_support" &&
      value === false
    ) {
      definition.draft.commercials.brand_support_type = null;
      definition.draft.commercials.brand_support_estimated_value = null;
    }

    validateDraftCrossField(definition);

    await this.prisma.$transaction(async (tx) => {
      await this.campaignLock.lockCampaign(tx, campaignId);
      const locked = await tx.uceCampaign.findFirst({
        where: { id: campaignId, brandProfileId },
        select: { status: true },
      });
      if (locked?.status !== UceCampaignStatus.DRAFT) {
        throw new BadRequestException("Only DRAFT Campaigns can be autosaved.");
      }
      if (patch.path === "strategy.campaign_name") {
        await tx.uceCampaign.update({
          where: { id: campaignId },
          data: { name: value as string },
        });
      }
      await tx.uceCampaign.update({
        where: { id: campaignId },
        data: { canonicalDefinition: definition as Prisma.InputJsonValue },
      });
    });

    return {
      campaignId,
      savedPath: patch.path,
      savedAt: new Date().toISOString(),
    };
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

    const objective = payload.strategy.core_objective;
    const readiness = resolveCanonicalCampaignReadiness(
      objective,
      brand.industry,
      brand.countryCode,
    );
    if (readiness.status !== "READY") {
      throw new BadRequestException(
        "Supporting KPI resolution is unavailable for this Brand industry.",
      );
    }

    const canonicalDefinition = {
      version: "1.2",
      creationSource: "MANUAL",
      ...payload,
      derived: canonicalDerivedProjection(readiness),
    };

    const visibility = legacyVisibility(payload.strategy.campaign_visibility);
    const isScheduled = payload.strategy.publishing_schedule === "SCHEDULED";
    const isFixed = payload.commercials.compensation_model === "FIXED";

    const strategyData = {
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
      platformDeliverables: {
        compatibility: "CANONICAL_CAMPAIGN_V1_2",
        platforms: ["INSTAGRAM"],
        canonicalObjective: objective,
      } as Prisma.InputJsonValue,
      platforms: [UceMediaPlatform.INSTAGRAM],
    };

    const targetingData = {
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
      targetLocations: payload.targeting.audience_geographies.map((g) =>
        JSON.stringify(g),
      ),
      disqualifyingKeywords: [],
      visibilityScopes: [visibility],
      visibilityScope: visibility,
      applicationScope: legacyApplicationScope(
        payload.strategy.campaign_visibility,
      ),
    };

    const commercialsData = {
      compensationType: isFixed
        ? UceCompensationType.FIXED_FEE
        : UceCompensationType.NEGOTIABLE,
      fixedFeeAmount: isFixed ? payload.commercials.commercial_offer : 0,
      negotiableMinFee: isFixed ? 0 : payload.commercials.commercial_offer,
      negotiableMaxFee: 0,
      totalCampaignBudgetPool: payload.commercials.total_campaign_budget,
      advancePaymentPercentage: payload.commercials.advance_payment_percentage,
      finalBalanceTerms: legacyPayout(payload.commercials.payout_terms),
      canonicalVersion: 1,
      commercialOffer: payload.commercials.commercial_offer,
      currency: readiness.currency,
      receivesBrandSupport: payload.commercials.receives_brand_support,
      brandSupportType: payload.commercials.brand_support_type
        ? UceBrandSupportType[payload.commercials.brand_support_type]
        : null,
      brandSupportEstimatedValue:
        payload.commercials.brand_support_estimated_value ?? null,
    };

    await this.prisma.$transaction(async (tx) => {
      await this.campaignLock.lockCampaign(tx, campaignId);
      const lockedCampaign = await tx.uceCampaign.findFirst({
        where: { id: campaignId, brandProfileId },
        select: { status: true },
      });
      if (lockedCampaign?.status !== UceCampaignStatus.DRAFT) {
        throw new BadRequestException("Only DRAFT Campaigns can be published.");
      }
      await tx.uceCampaign.update({
        where: { id: campaignId },
        data: {
          name: payload.strategy.campaign_name,
          status: UceCampaignStatus.PUBLISHED,
          creationSource: "MANUAL",
          canonicalDefinition: canonicalDefinition as Prisma.InputJsonValue,
          performanceAggregate: { upsert: { create: {}, update: {} } },
          strategy: { upsert: { create: strategyData, update: strategyData } },
          targeting: {
            upsert: { create: targetingData, update: targetingData },
          },
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
    });

    return this.legacyCampaigns.getCampaignShell(brandProfileId, campaignId);
  }

  /** Backward-compatible atomic create path for transitional clients. */
  async createManual(brandProfileId: string, input: unknown) {
    const draft = await this.createDraft(brandProfileId);
    return this.publishDraft(brandProfileId, draft.campaignId, input);
  }
}
