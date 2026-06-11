import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubscriptionTier } from "@prisma/client";

import {
  PLAN_MAPPINGS,
  RAZORPAY_PLAN_DEFINITIONS,
  type BillableSubscriptionTier,
  type RazorpayPlanCurrency,
} from "../constants/subscription.constants";
import { PricingRazorpayClient } from "./pricing-razorpay.client";

@Injectable()
export class RazorpayPlanProvisioningService {
  private readonly logger = new Logger(RazorpayPlanProvisioningService.name);
  private readonly resolvedPlanIds = new Map<string, string>();

  constructor(
    private readonly razorpay: PricingRazorpayClient,
    private readonly config: ConfigService,
  ) {}

  async resolvePlanId(
    tier: BillableSubscriptionTier,
    currency: RazorpayPlanCurrency,
  ): Promise<string> {
    const cacheKey = `${tier}_${currency}`;
    const cached = this.resolvedPlanIds.get(cacheKey);
    if (cached) {
      return cached;
    }

    const envPlanId = this.config.get<string>(
      `RAZORPAY_PLAN_${tier}_${currency}`,
    );
    if (envPlanId && (await this.razorpay.planExists(envPlanId))) {
      this.rememberPlanId(cacheKey, envPlanId, "environment override");
      return envPlanId;
    }

    const configuredHint = PLAN_MAPPINGS[tier][currency];
    if (await this.razorpay.planExists(configuredHint)) {
      this.rememberPlanId(cacheKey, configuredHint, "configured plan id");
      return configuredHint;
    }

    const definition = RAZORPAY_PLAN_DEFINITIONS[tier][currency];
    const existing = await this.razorpay.findPlanByBillingSignature(definition);
    if (existing) {
      this.rememberPlanId(cacheKey, existing, "existing Razorpay catalog");
      return existing;
    }

    const created = await this.razorpay.createSubscriptionPlan(definition);
    this.rememberPlanId(cacheKey, created.id, "created via Plans API");
    return created.id;
  }

  isBillableTier(tier: SubscriptionTier): tier is BillableSubscriptionTier {
    return tier !== SubscriptionTier.ENTERPRISE;
  }

  resolveTierForPlanId(planId: string): BillableSubscriptionTier | null {
    for (const [cacheKey, cachedPlanId] of this.resolvedPlanIds) {
      if (cachedPlanId !== planId) {
        continue;
      }
      const tier = cacheKey.split("_")[0] as BillableSubscriptionTier;
      if (tier in RAZORPAY_PLAN_DEFINITIONS) {
        return tier;
      }
    }

    for (const tier of Object.keys(RAZORPAY_PLAN_DEFINITIONS) as BillableSubscriptionTier[]) {
      for (const currency of ["INR", "USD"] as const) {
        if (PLAN_MAPPINGS[tier][currency] === planId) {
          return tier;
        }
      }
    }

    return null;
  }

  private rememberPlanId(cacheKey: string, planId: string, source: string): void {
    this.resolvedPlanIds.set(cacheKey, planId);
    this.logger.log(`Razorpay plan ${cacheKey} → ${planId} (${source})`);
  }
}
