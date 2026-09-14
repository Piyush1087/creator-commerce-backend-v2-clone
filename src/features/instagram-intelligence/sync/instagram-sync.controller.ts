import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { BrandSettingsAccessService } from "../../brand-settings/services/brand-settings-access.service";
import { InstagramSyncCoordinatorRepository } from "./instagram-sync-coordinator.repository";

@Controller("api/v1/brand-centre/instagram")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class InstagramSyncController {
  constructor(
    private readonly access: BrandSettingsAccessService,
    private readonly coordinator: InstagramSyncCoordinatorRepository,
  ) {}

  @Post("refresh")
  @HttpCode(HttpStatus.ACCEPTED)
  async refresh(@Req() req: RequestWithAuthUser) {
    const { brandProfileId, membership } =
      await this.access.resolveBrandContext(req.user);
    this.access.assertInstagramAction(membership.role, "MANUAL_REFRESH");
    return this.coordinator.requestManualRefresh(brandProfileId);
  }
}
