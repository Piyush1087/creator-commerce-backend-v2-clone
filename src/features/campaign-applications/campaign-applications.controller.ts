import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApplicationSubmitService } from "./application-submit.service";
import { ApplicationTerminalService } from "./application-terminal.service";
import { ApplicationHistoryService } from "./application-history.service";

@Controller("api/v1/creator")
@UseGuards(JwtAuthGuard)
export class CampaignApplicationsController {
  constructor(
    private readonly submits: ApplicationSubmitService,
    private readonly terminals: ApplicationTerminalService,
    private readonly history: ApplicationHistoryService,
  ) {}

  @Post("campaigns/:campaignId/applications")
  @HttpCode(200)
  submit(
    @Req() req: RequestWithAuthUser,
    @Param("campaignId", ParseUUIDPipe) campaignId: string,
    @Body() body: unknown,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.submits.submit(req.user, campaignId, body, key);
  }

  @Get("applications")
  collection(
    @Req() req: RequestWithAuthUser,
    @Query("cursor") cursor?: string,
  ) {
    return this.history.collection(req.user, cursor);
  }

  @Get("applications/:applicationId")
  detail(
    @Req() req: RequestWithAuthUser,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
  ) {
    return this.history.detail(req.user, applicationId);
  }

  @Post("applications/:applicationId/withdraw")
  @HttpCode(200)
  withdraw(
    @Req() req: RequestWithAuthUser,
    @Param("applicationId", ParseUUIDPipe) applicationId: string,
    @Headers("idempotency-key") key?: string,
  ) {
    return this.terminals.withdraw(req.user, applicationId, key);
  }
}
