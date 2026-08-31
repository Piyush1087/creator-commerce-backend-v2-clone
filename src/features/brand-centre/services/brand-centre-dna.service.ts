import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CanonicalOfferingAuthority,
  CanonicalOfferingOrigin,
  OfferingGuidanceKind,
  OfferingLifecycle,
  OfferingPriceFreshness,
  OfferingPriceMode,
  OfferingType,
  Prisma,
} from "@prisma/client";

import { gateAndNormalizeBrandUrl } from "../../brand-onboarding/discovery-url.util";
import { ParallelExtractClient } from "../../brand-onboarding/integrations/parallel/parallel-extract.client";
import { PrismaService } from "../../../prisma/prisma.service";
import { BrandVisualStateService } from "../../brand-canonical-state/brand-visual-state.service";
import { getIndustryRoutingTemplate } from "../config/industry-routing-templates";
import {
  canonicalOfferingType,
  CanonicalOfferingStateService,
} from "./canonical-offering-state.service";

const COLLECTION_TYPES: OfferingType[] = [OfferingType.COLLECTION];
const PRIMARY_TYPES: OfferingType[] = [
  OfferingType.PRODUCT,
  OfferingType.MODULE,
  OfferingType.TREATMENT,
  OfferingType.EXPERIENCE,
  OfferingType.SERVICE,
];

@Injectable()
export class BrandCentreDnaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parallel: ParallelExtractClient,
    private readonly visuals: BrandVisualStateService,
    private readonly canonicalOfferings: CanonicalOfferingStateService,
  ) {}

  async getDnaAggregate(brandProfileId: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      include: {
        offerings: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
        competitors: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
        audiencePersonas: { orderBy: { sortOrder: "asc" } },
        brandOffers: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
        },
        budgetConfiguration: true,
      },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const template = getIndustryRoutingTemplate(profile.brandRoutingType);
    const primary = profile.offerings.filter((o) =>
      PRIMARY_TYPES.includes(o.type),
    );
    const collections = profile.offerings.filter((o) =>
      COLLECTION_TYPES.includes(o.type),
    );

    const strategicDna = (profile.strategicDna ?? {}) as Record<
      string,
      unknown
    >;
    const narrative = (strategicDna.narrative ?? {}) as Record<string, unknown>;
    const visuals = (strategicDna.visuals ?? {}) as Record<string, unknown>;
    const compliance = (strategicDna.complianceGuardrails ?? {}) as Record<
      string,
      unknown
    >;

    return {
      profile: {
        id: profile.id,
        logoUrl: profile.logoUrl,
        brandName: profile.name,
        websiteUrl: `https://${profile.domain}`,
        igHandle: profile.igHandle,
        ytHandle: profile.ytHandle,
        tiktokHandle: profile.tiktokHandle,
        countryCode: profile.countryCode,
        currencyCode: profile.currencyCode,
        industry: profile.industry,
        subIndustry: profile.subIndustry,
        industryNiche: profile.industryNiche,
        lifecycleStage: profile.lifecycleStage,
        brandRoutingType: profile.brandRoutingType,
        scanStatus: profile.scanStatus,
        isVerified: profile.isVerified,
      },
      narrative: {
        tagline: profile.tagline,
        briefDescription: profile.description,
        brandUsps: (narrative.brandUsps as string[] | undefined) ?? [],
        toneOfVoice: (narrative.toneOfVoice as string[] | undefined) ?? [],
        doNotSayList: (compliance.doNotSayList as string[] | undefined) ?? [],
      },
      identity: {
        palette: (visuals.palette as string[] | undefined) ?? [],
        fonts: (visuals.fonts as string[] | undefined) ?? [],
        aesthetics: (visuals.aesthetics as string[] | undefined) ?? [],
        visualIdentityLegacy: profile.visualIdentity,
      },
      personas: profile.audiencePersonas,
      offeringsPrimary: primary,
      offeringsCollections: collections,
      offers: profile.brandOffers,
      competitors: profile.competitors,
      routingTemplate: template,
      completeness: {
        hasNarrative: Boolean(profile.tagline && profile.description),
        hasPersonas: profile.audiencePersonas.length > 0,
        hasPrimaryOfferings: primary.length > 0,
        hasBudget: Boolean(profile.budgetConfiguration),
      },
    };
  }

  async patchProfile(
    brandProfileId: string,
    data: {
      logoUrl?: string;
      brandName?: string;
      igHandle?: string;
      ytHandle?: string;
      tiktokHandle?: string;
      lifecycleStage?: string;
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      if (data.logoUrl !== undefined)
        await this.visuals.confirmLogo(
          brandProfileId,
          data.logoUrl,
          "BRAND_SELECTION",
          tx,
        );
      await tx.brandProfile.update({
        where: { id: brandProfileId },
        data: {
          logoUrl: data.logoUrl,
          name: data.brandName,
          igHandle: data.igHandle,
          ytHandle: data.ytHandle,
          tiktokHandle: data.tiktokHandle,
          lifecycleStage: data.lifecycleStage,
        },
      });
    });
    return this.getDnaAggregate(brandProfileId);
  }

  async patchNarrative(
    brandProfileId: string,
    data: {
      tagline?: string;
      briefDescription?: string;
      brandUsps?: string[];
      toneOfVoice?: string[];
      doNotSayList?: string[];
    },
  ) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    if (data.brandUsps && data.brandUsps.length !== 3) {
      throw new BadRequestException("Exactly three brand USPs are required");
    }

    const existing = (profile.strategicDna ?? {}) as Record<string, unknown>;
    const narrative = (existing.narrative ?? {}) as Record<string, unknown>;
    const compliance = (existing.complianceGuardrails ?? {
      doNotSayList: [],
    }) as Record<string, unknown>;

    const strategicDna = {
      ...existing,
      narrative: {
        ...narrative,
        brandUsps: data.brandUsps ?? narrative.brandUsps,
        toneOfVoice: data.toneOfVoice ?? narrative.toneOfVoice,
      },
      complianceGuardrails: {
        doNotSayList: data.doNotSayList ?? compliance.doNotSayList,
      },
    };

    await this.prisma.brandProfile.update({
      where: { id: brandProfileId },
      data: {
        tagline: data.tagline,
        description: data.briefDescription,
        strategicDna: strategicDna as unknown as Prisma.InputJsonValue,
      },
    });
    return this.getDnaAggregate(brandProfileId);
  }

  async patchIdentity(
    brandProfileId: string,
    data: { palette?: string[]; fonts?: string[]; aesthetics?: string[] },
  ) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }

    const existing = (profile.strategicDna ?? {}) as Record<string, unknown>;
    const visuals = (existing.visuals ?? {}) as Record<string, unknown>;
    const strategicDna = {
      ...existing,
      visuals: {
        palette: data.palette ?? visuals.palette,
        fonts: data.fonts ?? visuals.fonts,
        aesthetics: data.aesthetics ?? visuals.aesthetics,
      },
    };

    await this.prisma.$transaction(async (tx) => {
      await this.visuals.confirmLegacyIdentity(brandProfileId, data, tx);
      await tx.brandProfile.update({
        where: { id: brandProfileId },
        data: {
          strategicDna: strategicDna as unknown as Prisma.InputJsonValue,
          visualIdentity: {
            colors: data.palette,
            fonts: {
              heading: data.fonts?.[0] ?? "Unknown",
              body: data.fonts?.[1] ?? data.fonts?.[0] ?? "Unknown",
            },
            aesthetic: data.aesthetics,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });
    return this.getDnaAggregate(brandProfileId);
  }

  async listPersonas(brandProfileId: string) {
    return this.prisma.brandAudiencePersona.findMany({
      where: { brandProfileId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createPersona(
    brandProfileId: string,
    data: {
      personaName: string;
      demographicsJson: Record<string, unknown>;
      psychographicsText?: string;
    },
  ) {
    const count = await this.prisma.brandAudiencePersona.count({
      where: { brandProfileId },
    });
    return this.prisma.brandAudiencePersona.create({
      data: {
        brandProfileId,
        personaName: data.personaName,
        demographicsJson:
          data.demographicsJson as unknown as Prisma.InputJsonValue,
        psychographicsText: data.psychographicsText,
        sortOrder: count,
        isUserEdited: true,
      },
    });
  }

  async updatePersona(
    brandProfileId: string,
    personaId: string,
    data: {
      personaName?: string;
      demographicsJson?: Record<string, unknown>;
      psychographicsText?: string;
    },
  ) {
    const row = await this.prisma.brandAudiencePersona.findFirst({
      where: { id: personaId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Persona not found");
    }
    return this.prisma.brandAudiencePersona.update({
      where: { id: personaId },
      data: {
        personaName: data.personaName,
        demographicsJson: data.demographicsJson
          ? (data.demographicsJson as unknown as Prisma.InputJsonValue)
          : undefined,
        psychographicsText: data.psychographicsText,
        isUserEdited: true,
      },
    });
  }

  async deletePersona(brandProfileId: string, personaId: string) {
    const row = await this.prisma.brandAudiencePersona.findFirst({
      where: { id: personaId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Persona not found");
    }
    await this.prisma.brandAudiencePersona.delete({ where: { id: personaId } });
  }

  async listOfferings(brandProfileId: string, kind: "primary" | "collection") {
    const types = kind === "collection" ? COLLECTION_TYPES : PRIMARY_TYPES;
    return this.prisma.offering.findMany({
      where: { brandProfileId, isActive: true, type: { in: types } },
      orderBy: { createdAt: "asc" },
    });
  }

  private async assertUrlOnBrandDomain(profileDomain: string, url: string) {
    const gated = gateAndNormalizeBrandUrl(url);
    if (!gated.ok) {
      throw new BadRequestException("URL failed validation");
    }
    const profileHost = profileDomain.toLowerCase().replace(/^www\./, "");
    const urlHost = gated.hostname.toLowerCase().replace(/^www\./, "");
    if (urlHost !== profileHost && !urlHost.endsWith(`.${profileHost}`)) {
      throw new BadRequestException(
        "URL must belong to your verified brand domain",
      );
    }
    return gated.normalizedUrl;
  }

  async scanOfferingUrl(brandProfileId: string, url: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    const normalized = await this.assertUrlOnBrandDomain(profile.domain, url);
    try {
      const extract = await this.parallel.extract({
        urls: [normalized],
        objective: "Extract page title and primary product or collection name.",
      });
      const first = extract.results?.[0];
      const md = first?.full_content ?? first?.excerpts?.join("\n") ?? "";
      const name =
        first?.title?.trim() ??
        md.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
        "Untitled";
      return {
        url: normalized,
        name,
        imageUrl: null,
        excerpt: md.slice(0, 500),
      };
    } catch {
      return {
        url: normalized,
        name: "Untitled",
        imageUrl: null,
        excerpt: "",
      };
    }
  }

  async createOffering(
    brandProfileId: string,
    data: {
      kind: "primary" | "collection";
      type: OfferingType;
      name: string;
      url: string;
      description?: string;
      imageUrl?: string;
      sellingPoints?: string[];
      doNotSay?: string[];
    },
  ) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    const template = getIndustryRoutingTemplate(profile.brandRoutingType);
    const max =
      data.kind === "collection"
        ? template.section5.maxCount
        : template.section4.maxCount;
    const types = data.kind === "collection" ? COLLECTION_TYPES : PRIMARY_TYPES;
    const count = await this.prisma.offering.count({
      where: { brandProfileId, isActive: true, type: { in: types } },
    });
    if (count >= max) {
      throw new BadRequestException(
        `Maximum ${max} items allowed for this section`,
      );
    }
    const normalized = await this.assertUrlOnBrandDomain(
      profile.domain,
      data.url,
    );
    if (data.sellingPoints && data.sellingPoints.length !== 3) {
      throw new BadRequestException(
        "Exactly three selling points are required",
      );
    }
    const canonical = canonicalOfferingType(data.type);
    if (!canonical.kind) {
      throw new BadRequestException(
        "MODULE cannot be created as canonical Offering without explicit Product eligibility",
      );
    }
    const created = await this.prisma.offering.create({
      data: {
        brandProfileId,
        type: data.type,
        canonicalKind: canonical.kind,
        canonicalSubtype: canonical.subtype,
        canonicalLifecycle: OfferingLifecycle.ACTIVE,
        name: data.name,
        url: normalized,
        description: data.description,
        imageUrl: data.imageUrl,
        sellingPoints: data.sellingPoints ?? [],
        doNotSay: data.doNotSay ?? [],
        currency: profile.currencyCode,
        isUserEdited: true,
      },
    });
    await this.canonicalOfferings.confirmFields(brandProfileId, created.id, {
      name: data.name,
      url: normalized,
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      canonicalKind: canonical.kind,
      ...(canonical.subtype ? { canonicalSubtype: canonical.subtype } : {}),
    });
    if (data.sellingPoints) {
      await this.canonicalOfferings.replaceBrandGuidance(
        brandProfileId,
        created.id,
        OfferingGuidanceKind.SELLING_POINT,
        data.sellingPoints,
      );
    }
    if (data.doNotSay) {
      await this.canonicalOfferings.replaceBrandGuidance(
        brandProfileId,
        created.id,
        OfferingGuidanceKind.DO_NOT_SAY,
        data.doNotSay,
      );
    }
    if (data.imageUrl) {
      await this.canonicalOfferings.addMedia(brandProfileId, created.id, {
        url: data.imageUrl,
        makePrimary: true,
        authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
        origin: CanonicalOfferingOrigin.BRAND_EDIT,
        provenance: { actor: "BRAND", operation: "OFFERING_CREATE" },
      });
    }
    return created;
  }

  async updateOffering(
    brandProfileId: string,
    offeringId: string,
    data: {
      name?: string;
      url?: string;
      description?: string;
      imageUrl?: string;
      sellingPoints?: string[];
      doNotSay?: string[];
    },
  ) {
    const row = await this.prisma.offering.findFirst({
      where: { id: offeringId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Offering not found");
    }
    let url = row.url;
    if (data.url) {
      const profile = await this.prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
      });
      if (!profile) {
        throw new NotFoundException("Brand profile not found");
      }
      url = await this.assertUrlOnBrandDomain(profile.domain, data.url);
    }
    if (data.sellingPoints && data.sellingPoints.length !== 3) {
      throw new BadRequestException(
        "Exactly three selling points are required",
      );
    }
    const updated = await this.prisma.offering.update({
      where: { id: offeringId },
      data: {
        name: data.name,
        url,
        description: data.description,
        imageUrl: data.imageUrl,
        sellingPoints: data.sellingPoints,
        doNotSay: data.doNotSay,
        isUserEdited: true,
      },
    });
    const touched = Object.fromEntries(
      Object.entries({
        name: data.name,
        url: data.url ? url : undefined,
        description: data.description,
      }).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(touched).length) {
      await this.canonicalOfferings.confirmFields(
        brandProfileId,
        offeringId,
        touched,
      );
    }
    if (data.sellingPoints) {
      await this.canonicalOfferings.replaceBrandGuidance(
        brandProfileId,
        offeringId,
        OfferingGuidanceKind.SELLING_POINT,
        data.sellingPoints,
      );
    }
    if (data.doNotSay) {
      await this.canonicalOfferings.replaceBrandGuidance(
        brandProfileId,
        offeringId,
        OfferingGuidanceKind.DO_NOT_SAY,
        data.doNotSay,
      );
    }
    if (data.imageUrl) {
      await this.canonicalOfferings.addMedia(brandProfileId, offeringId, {
        url: data.imageUrl,
        makePrimary: true,
        authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
        origin: CanonicalOfferingOrigin.BRAND_EDIT,
        provenance: { actor: "BRAND", operation: "OFFERING_UPDATE" },
      });
    }
    return updated;
  }

  async setManualOfferingPrice(
    brandProfileId: string,
    offeringId: string,
    input: Readonly<{
      mode: OfferingPriceMode;
      currentMinAmount?: string | null;
      currentMaxAmount?: string | null;
      regularReferenceMinAmount?: string | null;
      regularReferenceMaxAmount?: string | null;
      currency: string;
    }>,
  ) {
    const offering = await this.canonicalOfferings.read(
      brandProfileId,
      offeringId,
    );
    if (!offering) throw new NotFoundException("Offering not found");
    this.assertManualPriceTuple(input);
    const state = offering.priceState;
    return this.canonicalOfferings.advancePrice(
      brandProfileId,
      offeringId,
      state?.revision ?? null,
      {
        mode: input.mode,
        currentMinAmount: input.currentMinAmount,
        currentMaxAmount: input.currentMaxAmount,
        regularMinAmount: input.regularReferenceMinAmount,
        regularMaxAmount: input.regularReferenceMaxAmount,
        currency: input.currency.toUpperCase(),
        freshness: OfferingPriceFreshness.CURRENT,
        authority: CanonicalOfferingAuthority.BRAND_CONFIRMED,
        origin: CanonicalOfferingOrigin.BRAND_EDIT,
        sourceClass: "APPLICATION",
        freshnessEvaluatedAt: new Date(),
        provenance: { actor: "BRAND", operation: "MANUAL_PRICE_EDIT" },
      },
    );
  }

  private assertManualPriceTuple(
    input: Readonly<{
      mode: OfferingPriceMode;
      currentMinAmount?: string | null;
      currentMaxAmount?: string | null;
      regularReferenceMinAmount?: string | null;
      regularReferenceMaxAmount?: string | null;
    }>,
  ): void {
    const min = input.currentMinAmount;
    const max = input.currentMaxAmount;
    const regularMin = input.regularReferenceMinAmount;
    const regularMax = input.regularReferenceMaxAmount;
    const same = (left?: string | null, right?: string | null) =>
      left != null &&
      right != null &&
      new Prisma.Decimal(left).equals(new Prisma.Decimal(right));
    if (input.mode === OfferingPriceMode.NOT_PUBLICLY_LISTED) {
      if ([min, max, regularMin, regularMax].some((value) => value != null)) {
        throw new BadRequestException(
          "NOT_PUBLICLY_LISTED cannot carry amount fields",
        );
      }
      return;
    }
    if (min == null) throw new BadRequestException("Current minimum required");
    if (
      input.mode === OfferingPriceMode.EXACT &&
      (max == null || !same(min, max))
    ) {
      throw new BadRequestException("EXACT requires equal min/max amounts");
    }
    if (input.mode === OfferingPriceMode.STARTING_AT && max != null) {
      throw new BadRequestException("STARTING_AT cannot carry a maximum");
    }
    if (
      input.mode === OfferingPriceMode.RANGE &&
      (max == null || new Prisma.Decimal(max).lte(new Prisma.Decimal(min)))
    ) {
      throw new BadRequestException("RANGE requires an ascending min/max");
    }
    if ((regularMin == null) !== (regularMax == null)) {
      throw new BadRequestException(
        "Regular reference amounts must be supplied as a pair",
      );
    }
    if (
      regularMin != null &&
      regularMax != null &&
      new Prisma.Decimal(regularMin).gt(new Prisma.Decimal(regularMax))
    ) {
      throw new BadRequestException("Regular reference range is invalid");
    }
  }

  async deleteOffering(brandProfileId: string, offeringId: string) {
    const row = await this.prisma.offering.findFirst({
      where: { id: offeringId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Offering not found");
    }
    await this.canonicalOfferings.setLifecycle(
      brandProfileId,
      offeringId,
      OfferingLifecycle.PAUSED_INACTIVE,
    );
  }

  async listOffers(brandProfileId: string) {
    return this.prisma.brandOffer.findMany({
      where: { brandProfileId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createOffer(
    brandProfileId: string,
    data: {
      offerName: string;
      promoCode: string;
      applicabilityScope: string;
      validityStart: string;
      validityEnd: string;
      description?: string;
    },
  ) {
    return this.prisma.brandOffer.create({
      data: {
        brandProfileId,
        offerName: data.offerName,
        promoCode: data.promoCode.toUpperCase(),
        applicabilityScope: data.applicabilityScope,
        validityStart: new Date(data.validityStart),
        validityEnd: new Date(data.validityEnd),
        description: data.description,
      },
    });
  }

  async updateOffer(
    brandProfileId: string,
    offerId: string,
    data: Partial<{
      offerName: string;
      promoCode: string;
      applicabilityScope: string;
      validityStart: string;
      validityEnd: string;
      description: string;
    }>,
  ) {
    const row = await this.prisma.brandOffer.findFirst({
      where: { id: offerId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Offer not found");
    }
    return this.prisma.brandOffer.update({
      where: { id: offerId },
      data: {
        offerName: data.offerName,
        promoCode: data.promoCode?.toUpperCase(),
        applicabilityScope: data.applicabilityScope,
        validityStart: data.validityStart
          ? new Date(data.validityStart)
          : undefined,
        validityEnd: data.validityEnd ? new Date(data.validityEnd) : undefined,
        description: data.description,
      },
    });
  }

  async deleteOffer(brandProfileId: string, offerId: string) {
    const row = await this.prisma.brandOffer.findFirst({
      where: { id: offerId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Offer not found");
    }
    await this.prisma.brandOffer.update({
      where: { id: offerId },
      data: { isActive: false },
    });
  }

  async listCompetitors(brandProfileId: string) {
    return this.prisma.competitor.findMany({
      where: { brandProfileId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async scanCompetitorUrl(brandProfileId: string, url: string) {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    const gated = gateAndNormalizeBrandUrl(url);
    if (!gated.ok) {
      throw new BadRequestException("URL failed validation");
    }
    const profileHost = profile.domain.toLowerCase().replace(/^www\./, "");
    const urlHost = gated.hostname.toLowerCase().replace(/^www\./, "");
    if (urlHost === profileHost || urlHost.endsWith(`.${profileHost}`)) {
      throw new BadRequestException("Competitor URL cannot be your own domain");
    }
    return {
      websiteUrl: gated.normalizedUrl,
      name: gated.hostname,
      logoUrl: null,
    };
  }

  async createCompetitor(
    brandProfileId: string,
    data: {
      name: string;
      websiteUrl: string;
      whyCompetitor?: string;
      logoUrl?: string;
    },
  ) {
    const count = await this.prisma.competitor.count({
      where: { brandProfileId, isActive: true },
    });
    if (count >= 3) {
      throw new BadRequestException("Maximum 3 competitors allowed");
    }
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Brand profile not found");
    }
    const gated = gateAndNormalizeBrandUrl(data.websiteUrl);
    if (!gated.ok) {
      throw new BadRequestException("Invalid competitor URL");
    }
    const profileHost = profile.domain.toLowerCase().replace(/^www\./, "");
    const urlHost = gated.hostname.toLowerCase().replace(/^www\./, "");
    if (urlHost === profileHost) {
      throw new BadRequestException("Competitor URL cannot be your own domain");
    }
    return this.prisma.competitor.create({
      data: {
        brandProfileId,
        name: data.name,
        websiteUrl: gated.normalizedUrl,
        logoUrl: data.logoUrl,
        whyCompetitor: data.whyCompetitor,
      },
    });
  }

  async deleteCompetitor(brandProfileId: string, competitorId: string) {
    const row = await this.prisma.competitor.findFirst({
      where: { id: competitorId, brandProfileId },
    });
    if (!row) {
      throw new NotFoundException("Competitor not found");
    }
    await this.prisma.competitor.update({
      where: { id: competitorId },
      data: { isActive: false },
    });
  }

  getAccountPlaceholder(profile: { planType: string; outreachCount: number }) {
    return {
      escrowStatus: "PLACEHOLDER_ACTIVE",
      metaConnectionStatus: "PLACEHOLDER_ACTIVE",
      subscriptionTier: profile.planType,
      outreachQuota: { used: profile.outreachCount, total: 100 },
    };
  }
}
