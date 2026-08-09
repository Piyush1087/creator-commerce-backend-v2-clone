import { Injectable, Logger } from "@nestjs/common";
import {
  BrandCentreJobStatus,
  BrandCentreJobType,
  BudgetAllocationPhase,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import {
  getColdStartMonthlyBudget,
  getColdStartStrategyMix,
} from "../config/budget-cold-start-templates";
import { mapIndustryVerticalToRoutingType } from "../config/map-industry-vertical";

@Injectable()
export class BrandCentreColdStartService {
  private readonly logger = new Logger(BrandCentreColdStartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Event 1 — called after surface scan persists BrandProfile + catalogue.
   * Sets routing type and PHASE_1_COLD_START budget (no Gemini call).
   */
  async seedFromSurfaceScan(brandProfileId: string): Promise<void> {
    const profile = await this.prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        id: true,
        industry: true,
        currencyCode: true,
        brandRoutingType: true,
      },
    });

    if (!profile) {
      this.logger.warn(
        `cold-start.skip profile_not_found id=${brandProfileId}`,
      );
      return;
    }

    const routingType = mapIndustryVerticalToRoutingType(profile.industry);
    const mixes = getColdStartStrategyMix(routingType);
    const masterMonthlyBudget = getColdStartMonthlyBudget(profile.currencyCode);

    await this.prisma.$transaction(async (tx) => {
      await tx.brandProfile.update({
        where: { id: brandProfileId },
        data: { brandRoutingType: routingType },
      });

      await tx.brandBudgetConfiguration.upsert({
        where: { brandProfileId },
        create: {
          brandProfileId,
          masterMonthlyBudget: new Prisma.Decimal(masterMonthlyBudget),
          allocationPhase: BudgetAllocationPhase.PHASE_1_COLD_START,
          assetMix: mixes.assetMix as unknown as Prisma.InputJsonValue,
          tierMix: mixes.tierMix as unknown as Prisma.InputJsonValue,
          objectiveMix: mixes.objectiveMix as unknown as Prisma.InputJsonValue,
        },
        update: {
          masterMonthlyBudget: new Prisma.Decimal(masterMonthlyBudget),
          allocationPhase: BudgetAllocationPhase.PHASE_1_COLD_START,
          assetMix: mixes.assetMix as unknown as Prisma.InputJsonValue,
          tierMix: mixes.tierMix as unknown as Prisma.InputJsonValue,
          objectiveMix: mixes.objectiveMix as unknown as Prisma.InputJsonValue,
          aiExplanationText: null,
        },
      });
    });

    this.logger.log(
      `cold-start.complete brandProfileId=${brandProfileId} routing=${routingType} budget=${masterMonthlyBudget} ${profile.currencyCode}`,
    );
  }
}
