import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorCampaignsWorkspaceService } from "./services/creator-campaigns-workspace.service";

/**
 * Command center + history for creator campaign collaborations.
 */
@Controller("api/v1/creator/campaigns")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorCampaignsController {
  constructor(private readonly workspace: CreatorCampaignsWorkspaceService) {}

  @Get("workspace")
  getWorkspace(@Req() req: RequestWithAuthUser) {
    return this.workspace.getWorkspace(req.user);
  }

  @Get("history")
  getHistory(@Req() req: RequestWithAuthUser) {
    return this.workspace.getHistory(req.user);
  }
}
