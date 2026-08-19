import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { CanonicalCampaignCreateService } from "./services/canonical-campaign-create.service";
import { CanonicalCampaignDraftReadService } from "./services/canonical-campaign-draft-read.service";
import { CanonicalCampaignReadinessService } from "./services/canonical-campaign-readiness.service";

@Controller("api/v1/brand-uce")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CanonicalCampaignCreateController {
  constructor(
    private readonly auth: BrandCentreAuthService,
    private readonly canonicalCreate: CanonicalCampaignCreateService,
    private readonly canonicalDraftRead: CanonicalCampaignDraftReadService,
    private readonly canonicalReadiness: CanonicalCampaignReadinessService,
  ) {}

  /** Transitional atomic endpoint retained for clients that do not yet use draft runtime. */
  @Post("campaigns/canonical-wizard")
  async createCanonicalCampaign(
    @Req() req: RequestWithAuthUser,
    @Body() body: unknown,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalCreate.createManual(brandProfileId, body);
  }

  @Post("campaigns/canonical-drafts")
  async createCanonicalDraft(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalCreate.createDraft(brandProfileId);
  }

  @Get("campaigns/canonical-drafts/:campaignId")
  async getCanonicalDraft(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalDraftRead.getDraft(brandProfileId, campaignId);
  }

  @Get("campaigns/canonical-drafts/:campaignId/readiness")
  async getCanonicalDraftReadiness(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalReadiness.getReadiness(brandProfileId, campaignId);
  }

  @Patch("campaigns/canonical-drafts/:campaignId/field")
  async autosaveCanonicalDraftField(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: unknown,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalCreate.autosaveField(brandProfileId, campaignId, body);
  }

  @Post("campaigns/canonical-drafts/:campaignId/publish")
  async publishCanonicalDraft(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId") campaignId: string,
    @Body() body: unknown,
  ) {
    const brandProfileId = await this.auth.resolveBrandProfileId(req.user);
    return this.canonicalCreate.publishDraft(brandProfileId, campaignId, body);
  }
}
