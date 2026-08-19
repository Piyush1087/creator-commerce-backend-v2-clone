import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SubscriptionStatus, SubscriptionTier } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { ESCROW_TAKE_RATES } from "../constants/subscription.constants";

type PolicyClient =
  Pick<PrismaService, "brandSubscription"> | Prisma.TransactionClient;

export type BrandPlanCommercialPolicy = {
  tier: SubscriptionTier;
  policyVersion: string;
  platformCommissionRate: Prisma.Decimal;
};

@Injectable()
export class PlanCommercialPolicyService {
  async resolveForBrand(
    brandProfileId: string,
    client: PolicyClient,
  ): Promise<BrandPlanCommercialPolicy> {
    const subscription = await client.brandSubscription.findUnique({
      where: { brandProfileId },
      select: { tier: true, status: true },
    });
    if (
      !subscription ||
      (subscription.status !== SubscriptionStatus.ACTIVE &&
        subscription.status !== SubscriptionStatus.TRIALING)
    ) {
      throw new BadRequestException(
        "An active Brand pricing subscription is required to lock Collaboration terms",
      );
    }
    return {
      tier: subscription.tier,
      policyVersion: `subscription-commercial-v1:${subscription.tier}`,
      platformCommissionRate: new Prisma.Decimal(
        ESCROW_TAKE_RATES[subscription.tier],
      ).mul(100),
    };
  }
}
