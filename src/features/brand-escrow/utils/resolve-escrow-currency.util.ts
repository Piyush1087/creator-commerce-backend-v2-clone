import type { BrandProfile } from "@prisma/client";

import type { EscrowCurrency } from "../types";

const SUPPORTED_ESCROW_CURRENCIES = new Set<EscrowCurrency>(["INR", "USD"]);

export function resolveEscrowCurrency(profile: BrandProfile): EscrowCurrency {
  const fromProfile = profile.currencyCode?.toUpperCase();
  if (
    fromProfile &&
    SUPPORTED_ESCROW_CURRENCIES.has(fromProfile as EscrowCurrency)
  ) {
    return fromProfile as EscrowCurrency;
  }

  if (profile.domain.endsWith(".in")) {
    return "INR";
  }

  return "USD";
}

export function assertCurrencyMatch(
  vaultCurrency: string,
  requestedCurrency: string,
): void {
  if (vaultCurrency.toUpperCase() !== requestedCurrency.toUpperCase()) {
    throw new Error(
      `Currency isolation violation: vault is ${vaultCurrency}, request used ${requestedCurrency}`,
    );
  }
}
