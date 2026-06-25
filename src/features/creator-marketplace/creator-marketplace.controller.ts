import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClaimInvitationDto } from "./dto/claim-invitation.dto";
import { MarketplaceQueryDto } from "./dto/marketplace-query.dto";
import { CreatorInvitationService } from "./services/creator-invitation.service";
import { CreatorMarketplaceService } from "./services/creator-marketplace.service";

/**
 * Screen 1 — Marketplace discovery feed.
 * Route prefix mirrors product docs: /creator/marketplace (API layer).
 */
@Controller("api/v1/creator/marketplace")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorMarketplaceController {
  constructor(
    private readonly marketplace: CreatorMarketplaceService,
    private readonly invitations: CreatorInvitationService,
  ) {}

  @Get("campaigns")
  listCampaigns(
    @Req() req: RequestWithAuthUser,
    @Query() query: MarketplaceQueryDto,
  ) {
    return this.marketplace.listMarketplaceCampaigns(req.user, query);
  }

  @Get("campaigns/:campaignId")
  getCampaign(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Query("invite_token") inviteToken?: string,
  ) {
    return this.marketplace.getMarketplaceCampaignDetail(
      req.user,
      campaignId,
      inviteToken,
    );
  }

  @Get("campaigns/:campaignId/alternatives")
  getAlternatives(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
  ) {
    return this.marketplace.getCrossSellAlternatives(req.user, campaignId);
  }

  @Get("campaigns/:campaignId/share-link")
  getShareLink(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Query("origin") origin?: string,
  ) {
    return this.marketplace.buildShareLink(
      req.user,
      campaignId,
      origin?.trim() || "http://localhost:5173",
    );
  }

  @Post("invitations/claim")
  @HttpCode(200)
  claimInvitation(@Req() req: RequestWithAuthUser, @Body() body: ClaimInvitationDto) {
    return this.invitations.claimInvitation(req.user, body.invite_token);
  }
}
