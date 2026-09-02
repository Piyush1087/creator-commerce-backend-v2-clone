import {
  CreatorPayoutBankStatus,
  CreatorPayoutOnboardingStatus,
  CreatorPayoutOperationalEligibility,
  RouteReversalState,
  RouteTransferState,
} from "@prisma/client";

import type {
  NormalizedRouteProfile,
  RouteProfileEvidence,
} from "./razorpay-route.types";

const normalized = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

export function normalizeRouteProfile(
  evidence: RouteProfileEvidence,
): NormalizedRouteProfile {
  const account = normalized(evidence.accountStatus);
  const product = normalized(evidence.productStatus);
  const bank = normalized(evidence.bankStatus);

  let onboardingStatus: CreatorPayoutOnboardingStatus =
    CreatorPayoutOnboardingStatus.UNKNOWN;
  if (!evidence.linkedAccountId) {
    onboardingStatus = CreatorPayoutOnboardingStatus.NOT_STARTED;
  } else if (
    evidence.restricted ||
    ["suspended", "restricted"].includes(product)
  ) {
    onboardingStatus = CreatorPayoutOnboardingStatus.RESTRICTED;
  } else if (["needs_clarification", "needs_information"].includes(product)) {
    onboardingStatus = CreatorPayoutOnboardingStatus.NEEDS_INFORMATION;
  } else if (["under_review", "requested"].includes(product)) {
    onboardingStatus = CreatorPayoutOnboardingStatus.UNDER_REVIEW;
  } else if (product === "activated") {
    onboardingStatus = CreatorPayoutOnboardingStatus.VERIFIED;
  } else if (
    !product &&
    (evidence.stakeholderId || evidence.productConfigurationId)
  ) {
    onboardingStatus = CreatorPayoutOnboardingStatus.IN_PROGRESS;
  }

  let bankStatus: CreatorPayoutBankStatus = CreatorPayoutBankStatus.UNKNOWN;
  if (!bank) bankStatus = CreatorPayoutBankStatus.BANK_NOT_CONFIGURED;
  else if (["pending", "under_review", "validation_pending"].includes(bank))
    bankStatus = CreatorPayoutBankStatus.BANK_VALIDATION_PENDING;
  else if (["validated", "verified", "active"].includes(bank))
    bankStatus = CreatorPayoutBankStatus.BANK_VALIDATED;
  else if (["failed", "rejected", "invalid"].includes(bank))
    bankStatus = CreatorPayoutBankStatus.BANK_VALIDATION_FAILED;

  let operationalEligibility: CreatorPayoutOperationalEligibility =
    CreatorPayoutOperationalEligibility.UNKNOWN;
  if (!evidence.linkedAccountId)
    operationalEligibility =
      CreatorPayoutOperationalEligibility.NO_LINKED_ACCOUNT;
  else if (evidence.restricted || onboardingStatus === "RESTRICTED")
    operationalEligibility =
      CreatorPayoutOperationalEligibility.SUSPENDED_OR_RESTRICTED;
  else if (evidence.coolingPeriod)
    operationalEligibility = CreatorPayoutOperationalEligibility.COOLING_PERIOD;
  else if (product === "needs_clarification")
    operationalEligibility =
      CreatorPayoutOperationalEligibility.NEEDS_CLARIFICATION;
  else if (product === "under_review")
    operationalEligibility = CreatorPayoutOperationalEligibility.UNDER_REVIEW;
  else if (!evidence.stakeholderId)
    operationalEligibility =
      CreatorPayoutOperationalEligibility.ACCOUNT_CREATED;
  else if (!evidence.productConfigurationId)
    operationalEligibility =
      CreatorPayoutOperationalEligibility.STAKEHOLDER_COMPLETE;
  else if (product === "requested")
    operationalEligibility =
      CreatorPayoutOperationalEligibility.ROUTE_CONFIGURATION_REQUESTED;
  else if (bankStatus === "BANK_NOT_CONFIGURED")
    operationalEligibility =
      CreatorPayoutOperationalEligibility.BANK_CONFIGURATION_PENDING;
  else if (bankStatus === "BANK_VALIDATION_PENDING")
    operationalEligibility =
      CreatorPayoutOperationalEligibility.BANK_VALIDATION_PENDING;
  else if (
    product === "activated" &&
    bankStatus === "BANK_VALIDATED" &&
    ["activated", "active", "created"].includes(account)
  )
    operationalEligibility =
      CreatorPayoutOperationalEligibility.ELIGIBLE_FOR_TRANSFER;
  else if (product === "activated")
    operationalEligibility = CreatorPayoutOperationalEligibility.ACTIVATED;

  return { onboardingStatus, bankStatus, operationalEligibility };
}

export function normalizeTransferState(value: string): RouteTransferState {
  const state = normalized(value);
  if (state === "created") return RouteTransferState.CREATED;
  if (state === "pending") return RouteTransferState.PENDING;
  if (state === "processed") return RouteTransferState.PROCESSED;
  if (state === "failed") return RouteTransferState.FAILED;
  if (state === "reversed") return RouteTransferState.REVERSED;
  if (state === "partially_reversed")
    return RouteTransferState.PARTIALLY_REVERSED;
  return RouteTransferState.UNKNOWN;
}

export function normalizeReversalState(value: string): RouteReversalState {
  const state = normalized(value);
  if (state === "created") return RouteReversalState.CREATED;
  if (state === "pending") return RouteReversalState.PENDING;
  if (["processed", "reversed"].includes(state))
    return RouteReversalState.PROCESSED;
  if (state === "failed") return RouteReversalState.FAILED;
  return RouteReversalState.UNKNOWN;
}
