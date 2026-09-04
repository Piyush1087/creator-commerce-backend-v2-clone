export const COLLABORATION_PAYOUT_INSTRUCTION_INTAKE_PORT_V1 = Symbol(
  "COLLABORATION_PAYOUT_INSTRUCTION_INTAKE_PORT_V1",
);

export type CollaborationPaymentTermV1 =
  | "NET_7"
  | "NET_15"
  | "NET_30"
  | "NET_45"
  | "NET_60";

export interface CollaborationCommercialBreakdownV1 {
  readonly currency: string;
  readonly creatorGrossFee: string;
  readonly platformCommission: string;
  readonly gstOnPlatformCommission: string;
  readonly totalBrandCommercialReserve: string;
}

export interface CollaborationImmutableReferenceV1 {
  readonly id: string;
  readonly version: string;
  readonly integrityHash: string;
}

export type CollaborationDueAuthorityV1 =
  | Readonly<{
      kind: "NORMAL_SUCCESS";
      paymentTerm: CollaborationPaymentTermV1;
      settlementEligibleAt: Date;
    }>
  | Readonly<{
      kind: "EXCEPTIONAL_EXPLICIT_DUE";
      resolutionReference: string;
      paymentDueAt: Date;
    }>
  | Readonly<{
      kind: "EXCEPTIONAL_FROZEN_RULE";
      resolutionReference: string;
      ruleVersion: string;
      anchorAt: Date;
    }>;

export interface CollaborationPayoutEntitlementInstructionV1 {
  readonly instruction: CollaborationImmutableReferenceV1;
  readonly commercialAgreement: CollaborationImmutableReferenceV1;
  readonly reserveRequest: CollaborationImmutableReferenceV1;
  readonly brandProfileId: string;
  readonly campaignId: string;
  readonly collaborationId: string;
  readonly creatorProfileId: string;
  readonly commercialBreakdown: CollaborationCommercialBreakdownV1;
  readonly creatorGrossEntitlement: string;
  readonly brandRefundEntitlement: string;
  readonly dueAuthority: CollaborationDueAuthorityV1;
  readonly resolutionReference: string | null;
  readonly issuedAt: Date;
}

export type CollaborationFinancialRecoveryEffectV1 =
  | "OBLIGATION_ADJUSTMENT"
  | "COLLABORATION_REFUND_AUTHORIZATION"
  | "PAYOUT_RECOVERY_REQUIRED";

export interface CollaborationFinancialRecoveryInstructionV1 {
  readonly instruction: CollaborationImmutableReferenceV1;
  readonly authorityType: "COLLABORATION_RESOLUTION" | "ADMIN_RESOLUTION";
  readonly collaborationId: string;
  readonly resolutionReference: string;
  readonly supersededInstructionReference: string | null;
  readonly sourceObligationReference: string;
  readonly sourceSettlementReference: string | null;
  readonly sourceTransferReference: string | null;
  readonly sourceReversalReference: string | null;
  readonly currency: string;
  readonly effects: readonly CollaborationFinancialRecoveryEffectV1[];
  readonly creatorEntitlementAdjustment: string;
  readonly remainingCreatorObligation: string;
  readonly brandCommercialRefundEntitlement: string;
  readonly providerRecoveryAmount: string;
  readonly dueAuthority: CollaborationDueAuthorityV1 | null;
  readonly lifecycle: "ACTIVE" | "SUPERSEDED";
  readonly issuedAt: Date;
}

export type PayoutEntitlementInstructionConfirmationV1 =
  | Readonly<{
      outcome: "ACCEPTED" | "REPLAYED";
      instruction: CollaborationImmutableReferenceV1;
      obligationReference: string;
      paymentDueAt: Date;
      observedAt: Date;
    }>
  | Readonly<{
      outcome: "REJECTED";
      instruction: CollaborationImmutableReferenceV1;
      reasonCode: string;
      observedAt: Date;
    }>;

export type PayoutRecoveryInstructionConfirmationV1 =
  | Readonly<{
      outcome: "ACCEPTED" | "REPLAYED";
      instruction: CollaborationImmutableReferenceV1;
      acceptedEffects: readonly CollaborationFinancialRecoveryEffectV1[];
      amountApplied: string;
      amountRemaining: string;
      obligationReference: string;
      refundReference: string | null;
      recoveryReference: string | null;
      status: "ACCEPTED" | "PROCESSING" | "COMPLETED" | "ACTION_REQUIRED";
      observedAt: Date;
    }>
  | Readonly<{
      outcome: "REJECTED";
      instruction: CollaborationImmutableReferenceV1;
      reasonCode: string;
      observedAt: Date;
    }>;

/**
 * C-04 owns every instruction above. This Payouts boundary may validate and
 * acknowledge exact immutable inputs but may never recompute commercial truth.
 * It remains unwired until the applicable C-04 dependency gate is accepted.
 */
export interface CollaborationPayoutInstructionIntakePortV1 {
  acceptEntitlement(
    instruction: CollaborationPayoutEntitlementInstructionV1,
  ): Promise<PayoutEntitlementInstructionConfirmationV1>;

  acceptRecovery(
    instruction: CollaborationFinancialRecoveryInstructionV1,
  ): Promise<PayoutRecoveryInstructionConfirmationV1>;
}
