import {
  CollaborationFinancialOutcome,
  CollaborationLifecycle,
  CollaborationSecurementState,
  CollaborationStage,
  Prisma,
} from "@prisma/client";

import { commandConflict } from "../errors/collaboration-command.error";

type ExceptionPolicyRow = {
  aggregateVersion: number;
  canonicalStage: CollaborationStage;
  commercialAgreement: {
    securementState: CollaborationSecurementState | null;
  } | null;
  deliverables: Array<{
    state: string;
    publishingRequired: boolean;
    publishing: {
      authorizationState: string;
      state: string;
    } | null;
  }>;
};

export type DeterministicExceptionAction =
  | "BRAND_END"
  | "CREATOR_CANCEL"
  | "CREATOR_NON_PERFORMANCE"
  | "CREATOR_PUBLISHING_NON_PERFORMANCE";

export function resolveDeterministicExceptionPolicy(
  row: ExceptionPolicyRow,
  action: DeterministicExceptionAction,
) {
  const secured =
    row.commercialAgreement?.securementState ===
    CollaborationSecurementState.COMPLETED;

  if (action === "BRAND_END") {
    const specificPublicationDecision = row.deliverables.some(
      (item) =>
        item.state === "AUTO_APPROVED" &&
        item.publishingRequired &&
        item.publishing?.authorizationState === "NOT_AUTHORIZED",
    );
    if (specificPublicationDecision) {
      commandConflict(
        "INVALID_STATE",
        "Brand must use the specific DeclinePublishing decision",
        row.aggregateVersion,
      );
    }
    return secured
      ? {
          lifecycle: CollaborationLifecycle.CANCELLED,
          endedReasonCode: "BRAND_EXIT_POST_SECUREMENT",
          financialOutcome:
            CollaborationFinancialOutcome.BRAND_PROTECTED_POST_SECUREMENT_EXIT,
          entitlement: "ADVANCE" as const,
        }
      : {
          lifecycle: CollaborationLifecycle.CANCELLED,
          endedReasonCode: "BRAND_EXIT_PRE_SECUREMENT",
          financialOutcome: CollaborationFinancialOutcome.PRE_SECUREMENT_EXIT,
          entitlement: "ZERO" as const,
        };
  }

  if (action === "CREATOR_CANCEL") {
    return secured
      ? {
          lifecycle: CollaborationLifecycle.CANCELLED,
          endedReasonCode: "CREATOR_CANCELLED_POST_SECUREMENT",
          financialOutcome:
            CollaborationFinancialOutcome.CREATOR_NON_PERFORMANCE,
          entitlement: "ZERO" as const,
        }
      : {
          lifecycle: CollaborationLifecycle.CANCELLED,
          endedReasonCode: "CREATOR_EXIT_PRE_SECUREMENT",
          financialOutcome: CollaborationFinancialOutcome.PRE_SECUREMENT_EXIT,
          entitlement: "ZERO" as const,
        };
  }

  if (action === "CREATOR_PUBLISHING_NON_PERFORMANCE") {
    const authorizedObligation = row.deliverables.some(
      (item) =>
        item.publishingRequired &&
        item.publishing?.authorizationState === "AUTHORIZED" &&
        (item.publishing.state === "AWAITING_PUBLISHING" ||
          item.publishing.state === "CORRECTION_REQUIRED"),
    );
    if (!authorizedObligation) {
      commandConflict(
        "INVALID_STATE",
        "Creator publishing non-performance requires an authorized outstanding publishing obligation",
        row.aggregateVersion,
      );
    }
    return {
      lifecycle: CollaborationLifecycle.TERMINATED,
      endedReasonCode: "CREATOR_PUBLISHING_NON_PERFORMANCE",
      financialOutcome:
        CollaborationFinancialOutcome.CREATOR_PUBLISHING_NON_PERFORMANCE,
      entitlement: "ZERO" as const,
    };
  }

  return {
    lifecycle: CollaborationLifecycle.TERMINATED,
    endedReasonCode: "CREATOR_NON_PERFORMANCE",
    financialOutcome: CollaborationFinancialOutcome.CREATOR_NON_PERFORMANCE,
    entitlement: "ZERO" as const,
  };
}

export function validateAdminEconomicAllocation(input: {
  agreedCreatorFee: Prisma.Decimal;
  creatorEntitlementAmount: Prisma.Decimal;
  brandRefundEntitlementAmount: Prisma.Decimal;
  derivedBrandCommercialRefundEntitlementAmount: Prisma.Decimal;
  aggregateVersion: number;
}) {
  if (
    input.creatorEntitlementAmount.isNegative() ||
    input.creatorEntitlementAmount.greaterThan(input.agreedCreatorFee) ||
    input.brandRefundEntitlementAmount.isNegative() ||
    !input.brandRefundEntitlementAmount.equals(
      input.derivedBrandCommercialRefundEntitlementAmount.toDecimalPlaces(2),
    )
  ) {
    commandConflict(
      "INVALID_STATE",
      "Admin Brand refund must equal the backend-derived total Brand commercial refund entitlement",
      input.aggregateVersion,
    );
  }
}
