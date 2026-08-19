import {
  CollaborationFulfillmentState,
  CollaborationStage,
  CollaborationStageStatus,
  UceMilestoneStage,
} from "@prisma/client";

export function afterSecurementProgression(
  fulfillmentState: CollaborationFulfillmentState | null,
) {
  if (
    fulfillmentState === null ||
    fulfillmentState === CollaborationFulfillmentState.SKIPPED ||
    fulfillmentState === CollaborationFulfillmentState.COMPLETED
  ) {
    return {
      canonicalStage: CollaborationStage.PRODUCTION,
      currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
      legacyStage: UceMilestoneStage.STAGE_4_CONTENT_REVIEW,
      fulfillmentState,
    };
  }
  return {
    canonicalStage: CollaborationStage.FULFILLMENT,
    currentStageStatus: CollaborationStageStatus.IN_PROGRESS,
    legacyStage: UceMilestoneStage.STAGE_3_LOGISTICS,
    fulfillmentState:
      fulfillmentState === CollaborationFulfillmentState.NOT_STARTED
        ? CollaborationFulfillmentState.AWAITING_BRAND_FULFILLMENT
        : fulfillmentState,
  };
}
