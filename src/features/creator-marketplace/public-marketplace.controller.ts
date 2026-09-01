import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { MarketplaceQueryDto } from "./dto/marketplace-query.dto";
import { CreatorInvitationService } from "./services/creator-invitation.service";
import { CreatorMarketplaceService } from "./services/creator-marketplace.service";
import { CampaignApplyContinuationIssuanceService } from "./services/campaign-apply-continuation-issuance.service";

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
    private readonly continuations: CampaignApplyContinuationIssuanceService,
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
    return this.marketplace.getPublicMarketplaceCampaignDetail(
      campaignId,
      inviteToken,
    );
  }

  @Post("campaigns/:campaignId/apply-continuation")
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  issueApplyContinuation(
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
  ) {
    return this.continuations.issue(campaignId);
  }

  @Get("invitations/:token")
  resolveInvitation(@Param("token") token: string) {
    return this.invitations.resolveInvitationToken(token);
  }
}
