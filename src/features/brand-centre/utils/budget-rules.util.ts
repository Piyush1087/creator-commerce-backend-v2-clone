import { BadRequestException } from "@nestjs/common";

import type { StrategyMixPercents } from "../types/budget-mix.types";

export function budgetFloorForCurrency(currencyCode: string): number {
  return currencyCode.toUpperCase() === "INR" ? 50_000 : 1_000;
}

export function slotFloorForCurrency(currencyCode: string): number {
  return currencyCode.toUpperCase() === "INR" ? 30_000 : 500;
}

/**
 * REQ-T1-007: each non-zero mix bucket implies at least ₹30k / $500 of monthly budget.
 */
export function assertMixImpliedSlotFloors(
  masterMonthlyBudget: number,
  currencyCode: string,
  mixes: StrategyMixPercents,
): void {
  const floor = slotFloorForCurrency(currencyCode);
  const checks: Array<{ label: string; percent: number }> = [
    { label: "asset product", percent: mixes.assetMix.product },
    { label: "asset collection", percent: mixes.assetMix.collection },
    { label: "asset sale", percent: mixes.assetMix.sale },
    { label: "tier nano", percent: mixes.tierMix.nano },
    { label: "tier micro", percent: mixes.tierMix.micro },
    { label: "tier midTier", percent: mixes.tierMix.midTier },
    { label: "tier mega", percent: mixes.tierMix.mega },
    { label: "tier celebrity", percent: mixes.tierMix.celebrity },
    { label: "objective pulse", percent: mixes.objectiveMix.pulse },
    { label: "objective proof", percent: mixes.objectiveMix.proof },
    { label: "objective push", percent: mixes.objectiveMix.push },
    { label: "objective production", percent: mixes.objectiveMix.production },
  ];
  for (const { label, percent } of checks) {
    if (percent <= 0) {
      continue;
    }
    const implied = (masterMonthlyBudget * percent) / 100;
    if (implied < floor) {
      throw new BadRequestException(
        `${label} allocation (${Math.round(implied)}) is below the minimum slot threshold (${floor} ${currencyCode})`,
      );
    }
  }
}

export function assertMixSumsTo100(mixes: StrategyMixPercents): void {
  const asset =
    mixes.assetMix.product +
    mixes.assetMix.collection +
    mixes.assetMix.sale;
  const tier =
    mixes.tierMix.nano +
    mixes.tierMix.micro +
    mixes.tierMix.midTier +
    mixes.tierMix.mega +
    mixes.tierMix.celebrity;
  const objective =
    mixes.objectiveMix.pulse +
    mixes.objectiveMix.proof +
    mixes.objectiveMix.push +
    mixes.objectiveMix.production;
  if (asset !== 100 || tier !== 100 || objective !== 100) {
    throw new BadRequestException(
      "Strategy mix percentages must each total 100%",
    );
  }
}
