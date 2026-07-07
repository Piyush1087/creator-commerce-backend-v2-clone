import {
  UceCollabStatus,
  UceLogisticsSubState,
  UceMilestoneStage,
  UceProductionPhase,
  UceReviewSubState,
  UceWorkflowActionRole,
  type UceCampaignCollaboration,
} from "@prisma/client";

export const PENDING_PRODUCTION_PHASES: UceProductionPhase[] = [
  UceProductionPhase.INBOUND_INVITE,
  UceProductionPhase.APPLICATION_REVIEW,
  UceProductionPhase.SHORTLISTED,
];

export const ACTIVE_PRODUCTION_PHASES: UceProductionPhase[] = [
  UceProductionPhase.LOGISTICS_TRANSIT,
  UceProductionPhase.CONTENT_DRAFTING,
  UceProductionPhase.SAFETY_REVIEW,
  UceProductionPhase.LIVE_SCRAPING,
];

export const ARCHIVED_PRODUCTION_PHASES: UceProductionPhase[] = [
  UceProductionPhase.ARCHIVED_COMPLETED,
  UceProductionPhase.ARCHIVED_CLOSED,
];

type PhaseSource = Pick<
  UceCampaignCollaboration,
  | "collabStatus"
  | "currentMilestone"
  | "logisticsState"
  | "reviewState"
  | "contentDraftUrl"
  | "currentMilestoneDeadline"
>;

export function deriveProductionPhase(collab: PhaseSource): UceProductionPhase {
  switch (collab.collabStatus) {
    case UceCollabStatus.PROSPECT_CURATED:
    case UceCollabStatus.PROSPECT_INVITED:
      return UceProductionPhase.INBOUND_INVITE;
    case UceCollabStatus.APPLICANT_PENDING:
      return UceProductionPhase.APPLICATION_REVIEW;
    case UceCollabStatus.APPLICANT_SHORTLISTED:
      return UceProductionPhase.SHORTLISTED;
    case UceCollabStatus.ARCHIVED_COMPLETE:
      return UceProductionPhase.ARCHIVED_COMPLETED;
    case UceCollabStatus.APPLICANT_REJECTED:
    case UceCollabStatus.TERMINATED_CANCELED:
      return UceProductionPhase.ARCHIVED_CLOSED;
    case UceCollabStatus.ACTIVE_WORKFLOW:
      break;
    default:
      return UceProductionPhase.APPLICATION_REVIEW;
  }

  if (collab.currentMilestone === UceMilestoneStage.STAGE_5_PUBLISHING) {
    return UceProductionPhase.LIVE_SCRAPING;
  }

  if (collab.currentMilestone === UceMilestoneStage.STAGE_4_CONTENT_REVIEW) {
    if (
      collab.contentDraftUrl ||
      collab.reviewState === UceReviewSubState.INITIAL_DRAFT_SUBMITTED
    ) {
      return UceProductionPhase.SAFETY_REVIEW;
    }
    if (collab.reviewState === UceReviewSubState.REVISION_ROUND_ACTIVE) {
      return UceProductionPhase.CONTENT_DRAFTING;
    }
    return UceProductionPhase.CONTENT_DRAFTING;
  }

  if (collab.currentMilestone === UceMilestoneStage.STAGE_3_LOGISTICS) {
    if (collab.logisticsState === UceLogisticsSubState.IN_TRANSIT) {
      return UceProductionPhase.LOGISTICS_TRANSIT;
    }
    return UceProductionPhase.LOGISTICS_TRANSIT;
  }

  return UceProductionPhase.CONTENT_DRAFTING;
}

export function deriveActionRequiredByRole(
  collab: PhaseSource,
  phase: UceProductionPhase,
): UceWorkflowActionRole {
  if (phase === UceProductionPhase.INBOUND_INVITE) {
    return UceWorkflowActionRole.CREATOR;
  }
  if (
    phase === UceProductionPhase.APPLICATION_REVIEW ||
    phase === UceProductionPhase.SHORTLISTED ||
    phase === UceProductionPhase.SAFETY_REVIEW
  ) {
    return UceWorkflowActionRole.BRAND;
  }
  if (
    phase === UceProductionPhase.LOGISTICS_TRANSIT ||
    phase === UceProductionPhase.CONTENT_DRAFTING ||
    phase === UceProductionPhase.LIVE_SCRAPING
  ) {
    return UceWorkflowActionRole.CREATOR;
  }
  return UceWorkflowActionRole.NONE;
}

export function deriveProductionDeadlineAt(
  collab: PhaseSource,
  phase: UceProductionPhase,
): Date | null {
  if (!ACTIVE_PRODUCTION_PHASES.includes(phase)) {
    return null;
  }
  return collab.currentMilestoneDeadline ?? null;
}

export function buildPhaseSyncPatch(collab: PhaseSource): {
  currentPhase: UceProductionPhase;
  actionRequiredByRole: UceWorkflowActionRole;
  productionDeadlineAt: Date | null;
} {
  const currentPhase = deriveProductionPhase(collab);
  return {
    currentPhase,
    actionRequiredByRole: deriveActionRequiredByRole(collab, currentPhase),
    productionDeadlineAt: deriveProductionDeadlineAt(collab, currentPhase),
  };
}

export function mapContentFormatFromTags(tags: string[]): string | null {
  if (tags.length === 0) return null;
  const normalized = tags[0]?.toUpperCase().replace(/\s+/g, "_");
  return normalized ?? null;
}
