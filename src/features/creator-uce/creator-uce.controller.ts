import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorPlatformAccessGuard } from "../creator-entry/creator-platform-access.guard";
import { CreatorApplyToCampaignDto } from "./dto/creator-apply.dto";
import { CreatorUceCampaignsService } from "./services/creator-uce-campaigns.service";

@Controller("api/v1/creator-uce")
@UseGuards(ThrottlerGuard, JwtAuthGuard, CreatorPlatformAccessGuard)
export class CreatorUceController {
  constructor(private readonly campaigns: CreatorUceCampaignsService) {}

  @Get("campaigns")
  listCampaigns(@Req() req: RequestWithAuthUser) {
    return this.campaigns.listOpenCampaigns(req.user);
  }

  @Post("campaigns/:campaignId/apply")
  apply(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Body() body: CreatorApplyToCampaignDto,
  ) {
    return this.campaigns.applyToCampaign(req.user, campaignId, body);
  }
}
