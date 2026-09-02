import type { BrandProfile } from "@prisma/client";

import type { EscrowCurrency } from "../types";

export function resolveEscrowCurrency(profile: BrandProfile): EscrowCurrency {
  return profile.countryCode?.toUpperCase() === "IN" ? "INR" : "USD";
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
