import { BrandRoutingType } from "@prisma/client";

import type { StrategyMixPercents } from "../types/budget-mix.types";

/** Structural pie-chart defaults per routing type (Phase 1 cold start). */
const DEFAULT_MIXES: Record<BrandRoutingType, StrategyMixPercents> = {
  [BrandRoutingType.D2C_SKINCARE]: {
    assetMix: { product: 45, collection: 30, sale: 25 },
    tierMix: { nano: 25, micro: 30, midTier: 25, mega: 15, celebrity: 5 },
    objectiveMix: { pulse: 30, proof: 25, push: 25, production: 20 },
  },
  [BrandRoutingType.SAAS_PRODUCT]: {
    assetMix: { product: 55, collection: 30, sale: 15 },
    tierMix: { nano: 10, micro: 25, midTier: 35, mega: 25, celebrity: 5 },
    objectiveMix: { pulse: 25, proof: 35, push: 25, production: 15 },
  },
  [BrandRoutingType.HEALTHCARE_TREATMENT]: {
    assetMix: { product: 50, collection: 35, sale: 15 },
    tierMix: { nano: 15, micro: 30, midTier: 30, mega: 20, celebrity: 5 },
    objectiveMix: { pulse: 20, proof: 40, push: 20, production: 20 },
  },
  [BrandRoutingType.OFFLINE_EXPERIENCE]: {
    assetMix: { product: 40, collection: 35, sale: 25 },
    tierMix: { nano: 20, micro: 35, midTier: 25, mega: 15, celebrity: 5 },
    objectiveMix: { pulse: 35, proof: 20, push: 30, production: 15 },
  },
};

/** Interim monthly budget placeholders (above validation floor, below typical AI inference). */
const INTERIM_BUDGET_INR = 85000;
const INTERIM_BUDGET_USD = 5000;

export function getColdStartStrategyMix(
  routingType: BrandRoutingType,
): StrategyMixPercents {
  return DEFAULT_MIXES[routingType];
}

export function getColdStartMonthlyBudget(currencyCode: string): number {
  return currencyCode.toUpperCase() === "INR"
    ? INTERIM_BUDGET_INR
    : INTERIM_BUDGET_USD;
}
