import type {
  CreatorPayoutBankStatus,
  CreatorPayoutOnboardingStatus,
  CreatorPayoutOperationalEligibility,
  RouteReversalState,
  RouteSettlementState,
  RouteTransferState,
} from "@prisma/client";

export const RAZORPAY_ROUTE_PROVIDER = "RAZORPAY_ROUTE" as const;

export type RouteCapability =
  | "LINKED_ACCOUNT"
  | "STAKEHOLDER"
  | "PRODUCT_CONFIGURATION"
  | "BANK_CONFIGURATION"
  | "DIRECT_TRANSFER"
  | "TRANSFER_READ"
  | "SETTLEMENT_HOLD"
  | "SETTLEMENT_RELEASE"
  | "REVERSAL"
  | "SETTLEMENT_READ";

export class RouteProviderGateError extends Error {
  readonly code = "PROVIDER_CAPABILITY_UNAVAILABLE";

  constructor(
    readonly capability: RouteCapability,
    message = `${capability} is not enabled or its provider contract is not verified`,
  ) {
    super(message);
    this.name = "RouteProviderGateError";
  }
}

export type RouteProfileEvidence = {
  linkedAccountId?: string | null;
  stakeholderId?: string | null;
  productConfigurationId?: string | null;
  accountStatus?: string | null;
  productStatus?: string | null;
  bankStatus?: string | null;
  coolingPeriod?: boolean;
  restricted?: boolean;
  maskedBankDisplay?: string | null;
};

export type NormalizedRouteProfile = {
  onboardingStatus: CreatorPayoutOnboardingStatus;
  bankStatus: CreatorPayoutBankStatus;
  operationalEligibility: CreatorPayoutOperationalEligibility;
};

export type RouteTransferResult = {
  transferId: string;
  providerState: string;
  state: RouteTransferState;
  settlementState: RouteSettlementState;
  onHold: boolean;
  onHoldUntil?: Date | null;
};

export type RouteReversalResult = {
  reversalId: string;
  providerState: string;
  state: RouteReversalState;
};
