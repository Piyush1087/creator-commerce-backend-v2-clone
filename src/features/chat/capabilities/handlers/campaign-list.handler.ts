import { Injectable } from "@nestjs/common";

import { BrandUceCampaignService } from "../../../brand-uce/services/brand-uce-campaign.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class CampaignListHandler implements ChatCapabilityHandler {
  readonly capabilityId = "campaign.list";

  constructor(private readonly campaigns: BrandUceCampaignService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
  ): Promise<ChatCapabilityExecutionResult> {
    const data = await this.campaigns.listCampaigns(
      context.chatContext.workspace.brandProfileId,
      {},
    );
    const refs = data.map((campaign) => ({
      type: "CAMPAIGN" as const,
      id: campaign.campaign_id,
    }));
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data,
      grounding: [
        {
          sourceType: "CANONICAL",
          capabilityId: this.capabilityId,
          entityRefs: refs,
        },
      ],
      authorizedEntityRefs: refs,
    };
  }
}
