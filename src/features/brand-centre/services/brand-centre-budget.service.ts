import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BudgetAllocationPhase, Prisma } from "@prisma/client";
import { subDays } from "date-fns";

import { PrismaService } from "../../../prisma/prisma.service";
import type { StrategyMixPercents } from "../types/budget-mix.types";
import {
  assertMixImpliedSlotFloors,
  assertMixSumsTo100,
  budgetFloorForCurrency,
} from "../utils/budget-rules.util";

const MAX_BUDGET_EDITS_30D = 2;

@Injectable()
export class BrandCentreBudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async getBudget(brandProfileId: string, currencyCode: string) {
    const config = await this.prisma.brandBudgetConfiguration.findUnique({
      where: { brandProfileId },
    });
    if (!config) {
      throw new NotFoundException("Budget configuration not found");
    }

    const editsInWindow = await this.prisma.brandBudgetModificationLog.count({
      where: {
        brandProfileId,
        modifiedAt: { gte: subDays(new Date(), 30) },
      },
    });

    const master = Number(config.masterMonthlyBudget);
    const booked = Number(config.utilizedBooked);
    const spent = Number(config.utilizedSpent);
    const total = booked + spent;
    const utilizationPercentage =
      master > 0 ? Math.round((total / master) * 100) : 0;

    return {
      masterMonthlyBudget: master,
      allocationPhase: config.allocationPhase,
      assetMix: config.assetMix as StrategyMixPercents["assetMix"],
      tierMix: config.tierMix as StrategyMixPercents["tierMix"],
      objectiveMix: config.objectiveMix as StrategyMixPercents["objectiveMix"],
      utilizedBooked: booked,
      utilizedSpent: spent,
      utilizationPercentage,
      aiExplanationText: config.aiExplanationText,
      budgetEditsRemaining: Math.max(0, MAX_BUDGET_EDITS_30D - editsInWindow),
      validationFloor: budgetFloorForCurrency(currencyCode),
    };
  }

  async updateCeiling(
    brandProfileId: string,
    currencyCode: string,
    masterMonthlyBudget: number,
  ) {
    const floor = budgetFloorForCurrency(currencyCode);
    if (masterMonthlyBudget < floor) {
      throw new BadRequestException(
        `Master monthly budget cannot be below ${floor} for ${currencyCode}`,
      );
    }

    const config = await this.prisma.brandBudgetConfiguration.findUnique({
      where: { brandProfileId },
    });
    if (!config) {
      throw new NotFoundException("Budget configuration not found");
    }

    const current = Number(config.masterMonthlyBudget);
    if (current === masterMonthlyBudget) {
      return this.getBudget(brandProfileId, currencyCode);
    }

    const booked = Number(config.utilizedBooked);
    if (masterMonthlyBudget < booked) {
      throw new BadRequestException(
        "Cannot set budget below already booked commitments",
      );
    }

    const editsInWindow = await this.prisma.brandBudgetModificationLog.count({
      where: {
        brandProfileId,
        modifiedAt: { gte: subDays(new Date(), 30) },
      },
    });
    if (editsInWindow >= MAX_BUDGET_EDITS_30D) {
      throw new HttpException(
        "Strategic budget modifications are limited to 2 per rolling 30-day window",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.$transaction([
      this.prisma.brandBudgetConfiguration.update({
        where: { brandProfileId },
        data: {
          masterMonthlyBudget: new Prisma.Decimal(masterMonthlyBudget),
        },
      }),
      this.prisma.brandBudgetModificationLog.create({
        data: {
          brandProfileId,
          oldBudget: new Prisma.Decimal(current),
          newBudget: new Prisma.Decimal(masterMonthlyBudget),
        },
      }),
    ]);

    return this.getBudget(brandProfileId, currencyCode);
  }

  async updateMixes(brandProfileId: string, currencyCode: string, mixes: StrategyMixPercents) {
    assertMixSumsTo100(mixes);

    const config = await this.prisma.brandBudgetConfiguration.findUnique({
      where: { brandProfileId },
    });
    if (!config) {
      throw new NotFoundException("Budget configuration not found");
    }

    const master = Number(config.masterMonthlyBudget);
    assertMixImpliedSlotFloors(master, currencyCode, mixes);

    await this.prisma.brandBudgetConfiguration.update({
      where: { brandProfileId },
      data: {
        assetMix: mixes.assetMix as unknown as Prisma.InputJsonValue,
        tierMix: mixes.tierMix as unknown as Prisma.InputJsonValue,
        objectiveMix: mixes.objectiveMix as unknown as Prisma.InputJsonValue,
        allocationPhase: BudgetAllocationPhase.PHASE_2_SELF_HEALING,
      },
    });

    return this.getBudget(brandProfileId, currencyCode);
  }
}
