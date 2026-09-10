import { GoneException } from "@nestjs/common";

export const UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED =
  "UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED" as const;

export function retiredUceCampaignCollaborationWrite(): never {
  throw new GoneException({
    code: UCE_CAMPAIGN_COLLABORATION_WRITE_RETIRED,
    message:
      "UceCampaignCollaboration is retained schema; use canonical Collaboration APIs",
  });
}
