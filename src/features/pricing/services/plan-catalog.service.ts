import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  FOUNDERS_BETA_COMMISSION_RATE,
  RAZORPAY_PLAN_DEFINITIONS,
  TRIAL_DURATION_DAYS,
  type RazorpayPlanCurrency,
} from "../constants/subscription.constants";
import type { CatalogPlanView } from "../types";
import { GeoRoutingService } from "./geo-routing.service";

@Injectable()
export class PlanCatalogService {
  private static readonly UPCOMING_CATALOG: CatalogPlanView[] = [
    {
      tierKey: "GROWTH_STARTER",
      name: "Growth Starter",
      priceDescriptor: "Upcoming",
      isPubliclyAvailable: true,
      availability: "UPCOMING",
      isPurchasable: false,
      currency: null,
      amountMinor: null,
      billingInterval: null,
      trialDays: null,
      platformCommissionRate: null,
      taxInclusive: null,
    },
    {
      tierKey: "PROFESSIONAL",
      name: "Professional",
      priceDescriptor: "Upcoming",
      isPubliclyAvailable: true,
      availability: "UPCOMING",
      isPurchasable: false,
      currency: null,
      amountMinor: null,
      billingInterval: null,
      trialDays: null,
      platformCommissionRate: null,
      taxInclusive: null,
    },
    {
      tierKey: "ENTERPRISE",
      name: "Enterprise",
      priceDescriptor: "Upcoming",
      isPubliclyAvailable: true,
      availability: "UPCOMING",
      isPurchasable: false,
      currency: null,
      amountMinor: null,
      billingInterval: null,
      trialDays: null,
      platformCommissionRate: null,
      taxInclusive: null,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly geoRouting: GeoRoutingService,
  ) {}

  async getVisiblePlans(
    brandProfileId: string | null,
  ): Promise<CatalogPlanView[]> {
    const currency = await this.resolveCurrency(brandProfileId);
    return [
      this.foundersPlan(currency),
      ...PlanCatalogService.UPCOMING_CATALOG,
    ];
  }

  private foundersPlan(currency: RazorpayPlanCurrency): CatalogPlanView {
    const definition = RAZORPAY_PLAN_DEFINITIONS.FOUNDERS_BETA[currency];
    return {
      tierKey: "FOUNDERS_BETA",
      name: "Founder's Beta",
      priceDescriptor: currency === "INR" ? "₹9,990/mo" : "$99/mo",
      isPubliclyAvailable: true,
      availability: "PURCHASABLE",
      isPurchasable: true,
      currency,
      amountMinor: definition.amountMinor,
      billingInterval: "MONTH",
      trialDays: TRIAL_DURATION_DAYS,
      platformCommissionRate: FOUNDERS_BETA_COMMISSION_RATE,
      taxInclusive: currency === "INR",
    };
  }

  private async resolveCurrency(
    brandProfileId: string | null,
  ): Promise<RazorpayPlanCurrency> {
    if (!brandProfileId) {
      return "USD";
    }

    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { countryCode: true },
    });
    return this.geoRouting.resolveGeoContext(profile?.countryCode).currency;
  }
}
