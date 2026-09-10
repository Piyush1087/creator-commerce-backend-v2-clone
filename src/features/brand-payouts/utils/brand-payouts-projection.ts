import {
  BrandReturnStatus,
  EscrowTransactionStatus,
  EscrowTransactionType,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

import type {
  BrandPayoutsActivityCategory,
  BrandPayoutsBrandReturnStatus,
  BrandPayoutsMoneyV2,
} from "../contracts/brand-payouts-v2.contract";

export type LedgerClassification = {
  readonly category: BrandPayoutsActivityCategory;
  readonly isFinancialMovement: boolean;
  readonly normalizedStatus: string;
  readonly legacyLimitationReason: string | null;
};

const PROTECTED_ALLOCATION_TYPES = new Set<EscrowTransactionType>([
  EscrowTransactionType.RESERVE,
  EscrowTransactionType.CONTRACT_LOCK_RESERVE,
  EscrowTransactionType.RELEASE,
]);

export function classifyLedgerEntry(
  transactionType: EscrowTransactionType,
  transactionStatus: EscrowTransactionStatus,
): LedgerClassification | null {
  if (transactionType === EscrowTransactionType.TDS_BUFFER_REVERSAL) {
    return null;
  }
  if (PROTECTED_ALLOCATION_TYPES.has(transactionType)) {
    return {
      category: "PROTECTED_ALLOCATION",
      isFinancialMovement: false,
      normalizedStatus: normalizedAllocationStatus(transactionStatus),
      legacyLimitationReason: null,
    };
  }
  if (transactionType === EscrowTransactionType.LOAD) {
    const confirmed = transactionStatus === EscrowTransactionStatus.CREDITED;
    return {
      category: confirmed ? "MONEY_MOVEMENT" : "INFORMATIONAL_LIFECYCLE",
      isFinancialMovement: confirmed,
      normalizedStatus: confirmed
        ? "FUNDING_CREDITED"
        : normalizedFundingStatus(transactionStatus),
      legacyLimitationReason: null,
    };
  }
  if (transactionType === EscrowTransactionType.CREATOR_PAYOUT_SETTLEMENT) {
    const confirmed = transactionStatus === EscrowTransactionStatus.CLEARED;
    return {
      category: confirmed ? "MONEY_MOVEMENT" : "PROVIDER_EXECUTION",
      isFinancialMovement: confirmed,
      normalizedStatus: confirmed
        ? "SETTLED"
        : "SETTLEMENT_STATUS_UNRECONCILED",
      legacyLimitationReason: confirmed
        ? null
        : "SETTLEMENT_EVIDENCE_INCOMPLETE",
    };
  }
  if (
    transactionType === EscrowTransactionType.BRAND_RETURN ||
    transactionType === EscrowTransactionType.COLLAB_REFUND
  ) {
    const confirmed = transactionStatus === EscrowTransactionStatus.CLEARED;
    return {
      category: "RETURN_REFUND_REVERSAL",
      isFinancialMovement: confirmed,
      normalizedStatus: confirmed
        ? "COMPLETED"
        : normalizedRecoveryStatus(transactionStatus),
      legacyLimitationReason: confirmed
        ? null
        : "RETURN_OR_REFUND_MOVEMENT_UNCONFIRMED",
    };
  }
  if (transactionType === EscrowTransactionType.CREATOR_PAYOUT_REVERSAL) {
    const confirmed =
      transactionStatus === EscrowTransactionStatus.REVERSED ||
      transactionStatus === EscrowTransactionStatus.CLEARED;
    return {
      category: "RETURN_REFUND_REVERSAL",
      isFinancialMovement: confirmed,
      normalizedStatus: confirmed
        ? "REVERSAL_CONFIRMED"
        : normalizedRecoveryStatus(transactionStatus),
      legacyLimitationReason: confirmed
        ? null
        : "REVERSAL_MOVEMENT_UNCONFIRMED",
    };
  }
  return {
    category: "INFORMATIONAL_LIFECYCLE",
    isFinancialMovement: false,
    normalizedStatus: "LEGACY_RECORDED_EVENT",
    legacyLimitationReason: "LEGACY_LEDGER_SEMANTICS_NOT_CANONICAL_EXECUTION",
  };
}

function normalizedAllocationStatus(status: EscrowTransactionStatus): string {
  switch (status) {
    case EscrowTransactionStatus.PENDING:
      return "PROTECTED_ALLOCATION_PENDING";
    case EscrowTransactionStatus.PROCESSING_GATEWAY:
      return "PROTECTED_ALLOCATION_PROCESSING";
    case EscrowTransactionStatus.CREDITED:
    case EscrowTransactionStatus.CLEARED:
      return "PROTECTED_ALLOCATION_RECORDED";
    case EscrowTransactionStatus.FAILED:
      return "PROTECTED_ALLOCATION_ACTION_REQUIRED";
    case EscrowTransactionStatus.REVERSED:
      return "PROTECTED_ALLOCATION_REVERSED";
  }
}

function normalizedFundingStatus(status: EscrowTransactionStatus): string {
  switch (status) {
    case EscrowTransactionStatus.PENDING:
    case EscrowTransactionStatus.PROCESSING_GATEWAY:
      return "FUNDING_PENDING";
    case EscrowTransactionStatus.FAILED:
      return "FUNDING_ACTION_REQUIRED";
    case EscrowTransactionStatus.REVERSED:
      return "FUNDING_REVERSED";
    case EscrowTransactionStatus.CREDITED:
      return "FUNDING_CREDITED";
    case EscrowTransactionStatus.CLEARED:
      return "FUNDING_STATUS_UNRECONCILED";
  }
}

function normalizedRecoveryStatus(status: EscrowTransactionStatus): string {
  switch (status) {
    case EscrowTransactionStatus.PENDING:
    case EscrowTransactionStatus.PROCESSING_GATEWAY:
      return "RECOVERY_PROCESSING";
    case EscrowTransactionStatus.FAILED:
      return "RECOVERY_ACTION_REQUIRED";
    case EscrowTransactionStatus.CREDITED:
    case EscrowTransactionStatus.CLEARED:
      return "RECOVERY_RECORDED";
    case EscrowTransactionStatus.REVERSED:
      return "RECOVERY_REVERSED";
  }
}

export function exactMoney(
  amount: Decimal,
  currency: string,
): BrandPayoutsMoneyV2 {
  return { amount: amount.toFixed(4), currency };
}

export function decimalSum(values: readonly Decimal[]): Decimal {
  return values.reduce((sum, value) => sum.add(value), new Decimal(0));
}

export function utcInstant(value: Date): string {
  return value.toISOString();
}

export function maxObservedAt(
  values: readonly (Date | null | undefined)[],
): Date | null {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    return !latest || value.getTime() > latest.getTime() ? value : latest;
  }, null);
}

export function mapBrandReturnStatus(
  status: BrandReturnStatus,
): BrandPayoutsBrandReturnStatus {
  switch (status) {
    case BrandReturnStatus.RETURN_REQUESTED:
      return "REQUESTED";
    case BrandReturnStatus.ALLOCATING_SOURCES:
      return "ALLOCATING_ORIGINAL_SOURCES";
    case BrandReturnStatus.PROCESSING:
      return "PROCESSING";
    case BrandReturnStatus.PARTIAL:
      return "PARTIAL";
    case BrandReturnStatus.COMPLETED:
      return "COMPLETED";
    case BrandReturnStatus.ACTION_REQUIRED:
      return "ACTION_REQUIRED";
    case BrandReturnStatus.FAILED:
      return "FAILED";
  }
}
