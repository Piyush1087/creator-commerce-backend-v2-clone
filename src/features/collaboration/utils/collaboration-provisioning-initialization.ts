import {
  CollaborationNegotiationState,
  UceCompensationType,
} from "@prisma/client";

export function resolveProvisioningNegotiationState(
  compensationType: UceCompensationType,
): CollaborationNegotiationState {
  return compensationType === UceCompensationType.FIXED_FEE
    ? CollaborationNegotiationState.NOT_REQUIRED
    : CollaborationNegotiationState.AWAITING_BRAND_DECISION;
}
