import { ForbiddenException, Injectable } from "@nestjs/common";
import { SubscriptionTier } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { FOUNDERS_BETA_COMMISSION_RATE } from "../../pricing/constants/subscription.constants";
import { EntitlementService } from "../../pricing/services/entitlement.service";

export interface EscrowBillingContext {
  tier: SubscriptionTier;
  platformTakeRate: number;
  aggregateCap: number;
}

@Injectable()
export class EscrowSubscriptionContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: EntitlementService,
  ) {}

  async assertEscrowBillingAuthorized(
    brandProfileId: string,
  ): Promise<EscrowBillingContext> {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      select: { tier: true },
    });

    if (!subscription) {
      throw new ForbiddenException(
        "Escrow securement rejected: No billing subscription context detected.",
      );
    }

    return {
      tier: subscription.tier,
      platformTakeRate: this.entitlement.getEscrowTakeRate(subscription.tier),
      aggregateCap: this.entitlement.getEscrowAggregateCap(subscription.tier),
    };
  }

  async resolveTakeRateForBrand(brandProfileId: string): Promise<number> {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
      select: { tier: true },
    });

    if (!subscription) {
      return FOUNDERS_BETA_COMMISSION_RATE;
    }

    return this.entitlement.getEscrowTakeRate(subscription.tier);
  }
}
