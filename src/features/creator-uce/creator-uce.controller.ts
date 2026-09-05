import {
  Controller,
  Get,
  GoneException,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorPlatformAccessGuard } from "../creator-entry/creator-platform-access.guard";
import { CreatorUceCampaignsService } from "./services/creator-uce-campaigns.service";

@Controller("api/v1/creator-uce")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorUceController {
  constructor(private readonly campaigns: CreatorUceCampaignsService) {}

  @Get("campaigns")
  @UseGuards(CreatorPlatformAccessGuard)
  listCampaigns(@Req() req: RequestWithAuthUser) {
    return this.campaigns.listOpenCampaigns(req.user);
  }

  @Post("campaigns/:campaignId/apply")
  apply() {
    throw new GoneException({ code: "LEGACY_APPLICATION_ENDPOINT_RETIRED" });
  }
}
