import { BadRequestException } from "@nestjs/common";
import {
  CollaborationEscrowStatus,
  CollaborationMediaReviewStatus,
  type CollaborationCommercial,
  type CollaborationFinalization,
  type CollaborationLogistics,
} from "@prisma/client";

export function logisticsIsDispatched(
  logistics: CollaborationLogistics | null | undefined,
): boolean {
  if (!logistics) {
    return false;
  }
  return Boolean(
    logistics.trackingId?.trim() ||
    logistics.digitalAccessCredentials?.trim() ||
    logistics.redemptionCode?.trim(),
  );
}

export function assertLogisticsNotDispatched(
  logistics: CollaborationLogistics | null | undefined,
): void {
  if (logisticsIsDispatched(logistics)) {
    throw new BadRequestException(
      "Logistics already dispatched. Waiting for the creator to confirm receipt.",
    );
  }
}

export function assertReceiptNotConfirmed(
  logistics: CollaborationLogistics | null | undefined,
): void {
  if (logistics?.isReceivedConfirmed) {
    throw new BadRequestException(
      "Receipt already confirmed. Production stage is active.",
    );
  }
}

export function assertEscrowNotFunded(
  commercials: CollaborationCommercial | null | undefined,
): void {
  const status = commercials?.escrowStatus;
  if (
    status === CollaborationEscrowStatus.FUNDED ||
    status === CollaborationEscrowStatus.SETTLED
  ) {
    throw new BadRequestException(
      "Escrow is already funded for this collaboration.",
    );
  }
}

export function assertAdvanceReceiptNotUploaded(
  commercials: CollaborationCommercial | null | undefined,
): void {
  if (commercials?.advanceReceiptUrl?.trim()) {
    throw new BadRequestException(
      "Advance receipt already uploaded. Waiting for creator confirmation.",
    );
  }
}

export function assertCreatorCanSubmitQuote(
  negotiationRound: number,
  commercials: CollaborationCommercial | null | undefined,
): void {
  if (commercials?.isFinalOffer) {
    throw new BadRequestException(
      "You already submitted a final offer. Wait for the brand to accept or decline.",
    );
  }
  if (negotiationRound >= 1 && commercials?.brandCounterOffer == null) {
    throw new BadRequestException(
      "Your quote is with the brand. Wait for their response before sending another.",
    );
  }
}

export function assertBrandCanCounter(
  commercials: CollaborationCommercial | null | undefined,
): void {
  if (commercials?.brandCounterOffer != null) {
    throw new BadRequestException(
      "Counter-offer already sent. Waiting for the creator to respond.",
    );
  }
  if (commercials?.isFinalOffer) {
    throw new BadRequestException(
      "Creator sent a final offer. Accept or decline — counter is disabled.",
    );
  }
}

export function assertNoPendingMedia(pendingCount: number): void {
  if (pendingCount > 0) {
    throw new BadRequestException(
      "A draft is already pending brand review. Wait for feedback before submitting again.",
    );
  }
}

export function assertLivePostNotSubmitted(
  finalization: CollaborationFinalization | null | undefined,
): void {
  if (finalization?.livePostUrl?.trim()) {
    throw new BadRequestException(
      "Live post URL already submitted. Waiting for brand compliance review.",
    );
  }
}

export function assertComplianceNotVerified(
  finalization: CollaborationFinalization | null | undefined,
): void {
  if (finalization?.isComplianceVerified) {
    throw new BadRequestException(
      "Compliance is already verified for this collaboration.",
    );
  }
}
