import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { CatalogPlanView } from "../types";

@Injectable()
export class PlanCatalogService {
  private static readonly MASTER_CATALOG: Record<string, CatalogPlanView> = {
    FOUNDERS_BETA: {
      tierKey: "FOUNDERS_BETA",
      name: "Founder's Beta",
      priceDescriptor: "$99/mo",
      isPubliclyAvailable: false,
    },
    GROWTH_STARTER: {
      tierKey: "GROWTH_STARTER",
      name: "Growth Starter",
      priceDescriptor: "$149/mo",
      isPubliclyAvailable: true,
    },
    PROFESSIONAL: {
      tierKey: "PROFESSIONAL",
      name: "Professional",
      priceDescriptor: "$399/mo",
      isPubliclyAvailable: true,
    },
    ENTERPRISE: {
      tierKey: "ENTERPRISE",
      name: "Enterprise",
      priceDescriptor: "Custom Rate",
      isPubliclyAvailable: true,
    },
  };

  constructor(private readonly prisma: PrismaService) {}

  async getVisiblePlans(brandProfileId: string | null): Promise<CatalogPlanView[]> {
    const allPlans = Object.values(PlanCatalogService.MASTER_CATALOG);

    if (!brandProfileId) {
      return allPlans.filter((plan) => plan.isPubliclyAvailable);
    }

    const currentSub = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });

    if (!currentSub) {
      return allPlans.filter((plan) => plan.isPubliclyAvailable);
    }

    return allPlans.filter((plan) => {
      if (plan.isPubliclyAvailable) {
        return true;
      }
      return plan.tierKey === currentSub.tier;
    });
  }
}
