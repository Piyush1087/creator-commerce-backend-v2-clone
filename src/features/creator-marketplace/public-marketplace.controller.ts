import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { MarketplaceQueryDto } from "./dto/marketplace-query.dto";
import { CreatorInvitationService } from "./services/creator-invitation.service";
import { CreatorMarketplaceService } from "./services/creator-marketplace.service";

/**
 * Public marketplace (State A — unauthenticated guest).
 * No JWT required; teaser-tier data only.
 */
@Controller("api/v1/public/marketplace")
@UseGuards(ThrottlerGuard)
export class PublicMarketplaceController {
  constructor(
    private readonly marketplace: CreatorMarketplaceService,
    private readonly invitations: CreatorInvitationService,
  ) {}

  @Get("campaigns")
  listCampaigns(@Query() query: MarketplaceQueryDto) {
    return this.marketplace.listPublicMarketplaceCampaigns(query);
  }

  @Get("campaigns/:campaignId")
  getCampaign(
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Query("invite_token") inviteToken?: string,
  ) {
    return this.marketplace.getPublicMarketplaceCampaignDetail(campaignId, inviteToken);
  }

  @Get("invitations/:token")
  resolveInvitation(@Param("token") token: string) {
    return this.invitations.resolveInvitationToken(token);
  }
}
