export const CREATOR_PAYOUT_PROVIDER_PORT = Symbol(
  "CREATOR_PAYOUT_PROVIDER_PORT",
);

export interface CreatorPayoutProviderAmountV1 {
  readonly amount: string;
  readonly currency: string;
}

export interface CreatorPayoutProviderCapabilitiesV1 {
  readonly availability: "AVAILABLE" | "UNAVAILABLE";
  readonly transferCreate: boolean;
  readonly transferRead: boolean;
  readonly reversalRequest: boolean;
  readonly observedAt: Date;
  readonly limitationReasonCode: string | null;
}

export interface CreatorPayoutProviderCreateRequestV1 {
  readonly obligationId: string;
  readonly attemptId: string;
  readonly idempotencyKey: string;
  readonly amount: CreatorPayoutProviderAmountV1;
  readonly destinationReference: string;
  readonly destinationVersion: number;
}

export type CreatorPayoutProviderCreateResultV1 =
  | Readonly<{
      outcome: "ACCEPTED";
      executionReference: string;
      observedState: "PROCESSING" | "HELD_RELEASE_PENDING";
      observedAt: Date;
    }>
  | Readonly<{
      outcome:
        | "RETRYABLE_FAILURE"
        | "TERMINAL_FAILURE"
        | "AMBIGUOUS"
        | "UNAVAILABLE";
      executionReference: string | null;
      reasonCode: string;
      observedAt: Date;
    }>;

export interface CreatorPayoutProviderReadRequestV1 {
  readonly attemptId: string;
  readonly executionReference: string;
}

export type CreatorPayoutProviderObservedStateV1 =
  | "PROCESSING"
  | "HELD_RELEASE_PENDING"
  | "SETTLED"
  | "FAILED"
  | "PARTIALLY_REVERSED"
  | "FULLY_REVERSED"
  | "UNKNOWN";

export type CreatorPayoutProviderReadResultV1 =
  | Readonly<{
      outcome: "FOUND";
      executionReference: string;
      observedState: CreatorPayoutProviderObservedStateV1;
      observedAt: Date;
      evidenceReference: string;
    }>
  | Readonly<{
      outcome: "NOT_FOUND" | "AMBIGUOUS" | "UNAVAILABLE";
      executionReference: string | null;
      reasonCode: string;
      observedAt: Date;
    }>;

export interface CreatorPayoutProviderReversalRequestV1 {
  readonly obligationId: string;
  readonly attemptId: string;
  readonly reversalId: string;
  readonly executionReference: string;
  readonly idempotencyKey: string;
  readonly amount: CreatorPayoutProviderAmountV1;
}

export type CreatorPayoutProviderReversalResultV1 =
  | Readonly<{
      outcome: "ACCEPTED";
      reversalExecutionReference: string;
      observedAt: Date;
    }>
  | Readonly<{
      outcome:
        | "RETRYABLE_FAILURE"
        | "TERMINAL_FAILURE"
        | "AMBIGUOUS"
        | "UNAVAILABLE";
      reversalExecutionReference: string | null;
      reasonCode: string;
      observedAt: Date;
    }>;

/**
 * Unwired, provider-neutral execution boundary. Callers must first persist a
 * durable local attempt; returned observations are evidence for canonical
 * reconciliation and are not themselves ledger mutations.
 */
export interface CreatorPayoutProviderPort {
  readCapabilities(): Promise<CreatorPayoutProviderCapabilitiesV1>;
  createTransfer(
    request: CreatorPayoutProviderCreateRequestV1,
  ): Promise<CreatorPayoutProviderCreateResultV1>;
  readTransfer(
    request: CreatorPayoutProviderReadRequestV1,
  ): Promise<CreatorPayoutProviderReadResultV1>;
  requestReversal(
    request: CreatorPayoutProviderReversalRequestV1,
  ): Promise<CreatorPayoutProviderReversalResultV1>;
}
