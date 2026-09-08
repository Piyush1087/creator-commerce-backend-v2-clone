import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { Response } from "express";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorPayoutsPageQueryDto } from "./dto/creator-payouts-query.dto";
import { CreatorPayoutsAuthorizationService } from "./services/creator-payouts-authorization.service";
import { CreatorPayoutsQueryService } from "./services/creator-payouts-query.service";

@Controller("api/v1/creator/payouts")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorPayoutsController {
  constructor(
    private readonly authorization: CreatorPayoutsAuthorizationService,
    private readonly payouts: CreatorPayoutsQueryService,
  ) {}

  @Get()
  async getOverview(
    @Req() req: RequestWithAuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateNoStore(response);
    return this.payouts.readOverview({
      authorization: await this.authorization.resolve(req.user),
      asOf: new Date(),
    });
  }

  @Get("obligations")
  async listObligations(
    @Req() req: RequestWithAuthUser,
    @Query() query: CreatorPayoutsPageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateNoStore(response);
    return this.payouts.listObligations({
      authorization: await this.authorization.resolve(req.user),
      asOf: new Date(),
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get("obligations/:obligationId")
  async readObligation(
    @Req() req: RequestWithAuthUser,
    @Param("obligationId") obligationId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateNoStore(response);
    return this.payouts.readObligation({
      authorization: await this.authorization.resolve(req.user),
      asOf: new Date(),
      resourceId: obligationId,
    });
  }

  @Get("history")
  async listHistory(
    @Req() req: RequestWithAuthUser,
    @Query() query: CreatorPayoutsPageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateNoStore(response);
    return this.payouts.listHistory({
      authorization: await this.authorization.resolve(req.user),
      asOf: new Date(),
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  @Get("history/:historyId")
  async readHistory(
    @Req() req: RequestWithAuthUser,
    @Param("historyId") historyId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateNoStore(response);
    return this.payouts.readHistory({
      authorization: await this.authorization.resolve(req.user),
      asOf: new Date(),
      resourceId: historyId,
    });
  }

  @Get("payout-method")
  async readPayoutMethod(
    @Req() req: RequestWithAuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    privateNoStore(response);
    return this.payouts.readPayoutMethod({
      authorization: await this.authorization.resolve(req.user),
      asOf: new Date(),
    });
  }
}

function privateNoStore(response: Response): void {
  response.setHeader("Cache-Control", "private, no-store");
}
