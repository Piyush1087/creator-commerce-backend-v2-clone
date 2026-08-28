import { Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";

import type {
  EscrowCalculationOutput,
  EscrowCurrency,
  EscrowTdsPercentage,
} from "../types";

export interface CalculateEscrowStructureInput {
  grossCreatorQuote: number;
  currency: EscrowCurrency;
  expectedTdsPercentage: EscrowTdsPercentage;
  platformTakeRate: number;
}

@Injectable()
export class EscrowComputationEngine {
  calculateStructure(
    input: CalculateEscrowStructureInput,
  ): EscrowCalculationOutput {
    const grossCreatorQuote = new Decimal(input.grossCreatorQuote);
    const platformCommissionFee = grossCreatorQuote.mul("0.07");
    const platformCommissionGst =
      input.currency === "INR"
        ? platformCommissionFee.mul(0.18)
        : new Decimal(0);
    const totalEscrowLockedAmount = grossCreatorQuote
      .add(platformCommissionFee)
      .add(platformCommissionGst);
    const calculatedTdsDeduction = new Decimal(0);
    const netCreatorPayoutPool = grossCreatorQuote;

    return {
      grossCreatorQuote,
      platformCommissionFee,
      platformCommissionGst,
      totalEscrowLockedAmount,
      calculatedTdsDeduction,
      netCreatorPayoutPool,
    };
  }
}
