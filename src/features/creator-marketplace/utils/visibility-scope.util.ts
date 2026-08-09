import type { UceVisibilityScope } from "@prisma/client";

const INVITED_PIPELINE_STATUSES = new Set([
  "PROSPECT_INVITED",
  "PROSPECT_CURATED",
]);

export function isInvitedCollaboration(collabStatus: string): boolean {
  return INVITED_PIPELINE_STATUSES.has(collabStatus);
}

/**
 * Campaign is visible in marketplace when any configured visibility scope matches.
 */
export function isCampaignVisibleToCreator(
  visibilityScopes: UceVisibilityScope[],
  context: {
    isEligible: boolean;
    isInvited: boolean;
  },
): boolean {
  if (visibilityScopes.length === 0) {
    return true;
  }

  return visibilityScopes.some((scope) => {
    switch (scope) {
      case "EVERYONE":
        return true;
      case "ELIGIBLE_ONLY":
        return context.isEligible;
      case "INVITED_ONLY":
        return context.isInvited;
      default:
        return false;
    }
  });
}
