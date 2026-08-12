import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { CanonicalCampaignCreateService } from "./services/canonical-campaign-create.service";

@Controller("api/v1/brand-uce")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CanonicalCampaignCreateController {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly canonicalCreate: CanonicalCampaignCreateService,
  ) {}

  @Post("campaigns/canonical-wizard")
  async createCanonicalCampaign(
    @Req() req: RequestWithAuthUser,
    @Body() body: unknown,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalCreate.createManual(brandProfileId, body);
  }
}
