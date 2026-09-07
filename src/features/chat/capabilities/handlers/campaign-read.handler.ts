import { BadRequestException, Injectable } from "@nestjs/common";

import { BrandUceCampaignService } from "../../../brand-uce/services/brand-uce-campaign.service";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";

@Injectable()
export class CampaignReadHandler implements ChatCapabilityHandler {
  readonly capabilityId = "campaign.read";

  constructor(private readonly campaigns: BrandUceCampaignService) {}

  async execute(
    context: ChatCapabilityExecutionContext,
    input: Readonly<Record<string, unknown>>,
  ): Promise<ChatCapabilityExecutionResult> {
    const campaignId = String(input.campaignId);
    if (
      !context.authorizedEntityRefs.some(
        (ref) => ref.type === "CAMPAIGN" && ref.id === campaignId,
      )
    ) {
      return this.denied();
    }
    const campaign = await this.campaigns.getCampaignShell(
      context.chatContext.workspace.brandProfileId,
      campaignId,
    );
    if (campaign.campaign_id !== campaignId) {
      throw new BadRequestException("Campaign not found");
    }
    const entityRef = { type: "CAMPAIGN" as const, id: campaignId };
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data: {
        campaignId: campaign.campaign_id,
        campaignName: campaign.campaign_name,
        currentStatus: campaign.current_status,
        canEditEssentials: campaign.can_edit_essentials,
        totalInventoryAllocated: campaign.total_inventory_allocated,
        pauseWarning: campaign.pause_warning,
      },
      grounding: [
        {
          sourceType: "CANONICAL",
          capabilityId: this.capabilityId,
          entityRefs: [entityRef],
        },
      ],
      authorizedEntityRefs: [entityRef],
    };
  }

  private denied(): ChatCapabilityExecutionResult {
    return {
      capabilityId: this.capabilityId,
      availability: "NOT_AUTHORIZED",
      grounding: [],
      authorizedEntityRefs: [],
      limitations: ["The requested item is not available in this workspace."],
    };
  }
}
