export const CREATOR_PAYOUT_READINESS_PORT = Symbol(
  "CREATOR_PAYOUT_READINESS_PORT",
);

export type CreatorPayoutDestinationRailV1 = "BANK_ACCOUNT" | "UPI" | "PAYPAL";

export interface CreatorPayoutDestinationReferenceV1 {
  readonly reference: string;
  readonly version: number;
  readonly countryCode: string;
  readonly currency: string;
  readonly rail: CreatorPayoutDestinationRailV1;
}

export type CreatorPayoutSetupStatusV1 =
  | "READY"
  | "ACTION_REQUIRED"
  | "UNKNOWN";

export type CreatorPayoutProviderReadinessStatusV1 =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "UNDER_REVIEW"
  | "READY"
  | "BLOCKED"
  | "UNKNOWN";

export type CreatorPayoutReadinessRecoveryTargetV1 =
  | "CREATOR_PAYOUT_SETTINGS"
  | "PAYOUT_SUPPORT";

/**
 * Provider-neutral projection owned upstream by Creator payout readiness.
 * It deliberately contains no bank, legal, tax, KYC, or diagnostic payload.
 */
export interface CreatorPayoutReadinessV1 {
  readonly creatorProfileId: string;
  readonly destination: CreatorPayoutDestinationReferenceV1 | null;
  readonly setupStatus: CreatorPayoutSetupStatusV1;
  readonly providerStatus: CreatorPayoutProviderReadinessStatusV1;
  readonly blockingReasonCode: string | null;
  readonly recoveryTarget: CreatorPayoutReadinessRecoveryTargetV1 | null;
  readonly stateVersion: string;
  readonly observedAt: Date;
}

export interface CreatorPayoutReadinessReadRequestV1 {
  readonly creatorProfileId: string;
}

/** Read-only boundary. The Payouts consumer must fence exact destination/version. */
export interface CreatorPayoutReadinessPort {
  readCurrent(
    request: CreatorPayoutReadinessReadRequestV1,
  ): Promise<CreatorPayoutReadinessV1>;
}
