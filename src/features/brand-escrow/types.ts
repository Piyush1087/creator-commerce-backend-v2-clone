import type { Decimal } from "@prisma/client/runtime/library";

export type EscrowCurrency = "INR" | "USD";

export type EscrowTdsPercentage = 0 | 1 | 2;

export interface EscrowCalculationOutput {
  grossCreatorQuote: Decimal;
  platformCommissionFee: Decimal;
  platformCommissionGst: Decimal;
  totalEscrowLockedAmount: Decimal;
  calculatedTdsDeduction: Decimal;
  netCreatorPayoutPool: Decimal;
}

export interface VaultRowLock {
  vault_id: string;
  brand_id: string;
  total_pooled_balance: string | number;
  locked_campaign_funds: string | number;
  available_balance: string | number;
  active_return_commitment?: string | number;
  currency: string;
}
