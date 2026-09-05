import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/optional-jwt-auth.guard";
import type { AuthUser } from "../auth/types/auth-user";
import { setCreatorCampaignApplyContinuationCookie } from "../creator-entry/creator-campaign-apply-continuation-cookie.util";
import { CampaignOpportunityService } from "./campaign-opportunity.service";

@Controller("api/v1/campaign-opportunities")
export class CampaignOpportunityController {
  constructor(private readonly opportunities: CampaignOpportunityService) {}

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(":campaignId")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  detail(
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Req() request: Request & { user?: AuthUser },
  ) {
    return this.opportunities.detail(campaignId, request.user);
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Post(":campaignId/apply-continuation")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  async continuation(
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Req() request: Request & { user?: AuthUser },
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const issued = await this.opportunities.issue(
      campaignId,
      request.user,
      body,
    );
    setCreatorCampaignApplyContinuationCookie(
      response,
      issued.continuationToken,
      issued.expiresAt,
    );
    return {
      intent: issued.intent,
      expiresAt: issued.expiresAt,
      continuationPresent: true,
    };
  }
}

@Controller("api/v1/creator/campaigns")
@UseGuards(JwtAuthGuard)
export class CreatorOpportunitiesController {
  constructor(private readonly opportunities: CampaignOpportunityService) {}

  @Get("opportunities")
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  collection(
    @Req() request: Request & { user: AuthUser },
    @Query("cursor") cursor?: string,
  ) {
    return this.opportunities.collection(request.user, cursor);
  }
}
