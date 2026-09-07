import { Injectable } from "@nestjs/common";

import { CreatorCampaignApplyContinuationService } from "../../creator-entry/creator-campaign-apply-continuation.service";
import { CreatorMarketplaceService } from "./creator-marketplace.service";

@Injectable()
export class CampaignApplyContinuationIssuanceService {
  constructor(
    private readonly marketplace: CreatorMarketplaceService,
    private readonly continuations: CreatorCampaignApplyContinuationService,
  ) {}

  async issue(campaignId: string, now = new Date()) {
    const detail =
      await this.marketplace.getPublicMarketplaceCampaignDetail(campaignId);
    return this.continuations.issueResolvedCampaign(
      detail.campaign.campaign_id,
      now,
    );
  }
}
