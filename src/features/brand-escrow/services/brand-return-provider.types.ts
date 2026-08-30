import type { EscrowFundingLotSourceType } from "@prisma/client";

export type BrandReturnProviderCapability = {
  sourceType: EscrowFundingLotSourceType;
  currency: string;
};

export type BrandReturnProviderRefundInput = {
  semanticIdentity: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
};

export type BrandReturnProviderOutcome =
  | {
      kind: "SUCCEEDED";
      providerRefundId: string;
      providerState: string;
    }
  | {
      kind: "TERMINAL_REJECTION";
      providerState?: string;
      diagnosticCode?: string;
    }
  | {
      kind: "RETRYABLE_FAILURE";
      providerState?: string;
      diagnosticCode?: string;
    }
  | {
      kind: "AMBIGUOUS";
      providerRefundId?: string;
      providerState?: string;
      diagnosticCode?: string;
    };

export type TrustedFundingEvidence = {
  providerPaymentId: string;
  brandProfileId: string;
  amount: string;
  currency: string;
  sourceType: EscrowFundingLotSourceType;
  providerOrderId?: string | null;
  capturedAmount?: string | null;
};

export class BrandReturnProviderSetupRequiredError extends Error {
  readonly code = "PROVIDER_SETUP_REQUIRED";

  constructor(message = "Brand Return provider runtime is not enabled") {
    super(message);
    this.name = "BrandReturnProviderSetupRequiredError";
  }
}

export class BrandReturnProviderReconciliationRequiredError extends Error {
  readonly code = "PROVIDER_RECONCILIATION_REQUIRED";

  constructor(message = "Provider truth must be reconciled before retry") {
    super(message);
    this.name = "BrandReturnProviderReconciliationRequiredError";
  }
}
