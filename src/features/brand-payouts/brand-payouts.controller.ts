import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  NotAcceptableException,
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
import {
  BRAND_PAYOUTS_V2_MEDIA_TYPE,
  negotiateBrandPayoutsRepresentation,
} from "./contracts/brand-payouts-v2.contract";
import {
  BrandPayoutsActivityCsvQueryDto,
  BrandPayoutsActivityQueryDto,
  BrandPayoutsBrandReturnsQueryDto,
  BrandPayoutsObligationsQueryDto,
  BrandPayoutsReserveRequestsQueryDto,
} from "./dto/brand-payouts-query.dto";
import {
  BRAND_PAYOUTS_QUERY_PORT_V2,
  type BrandPayoutsQueryPortV2,
} from "./ports/brand-payouts-read.port";
import { BrandPayoutsAuthorizationService } from "./services/brand-payouts-authorization.service";
import { BrandPayoutsService } from "./services/brand-payouts.service";

@Controller("api/v1/brand/payouts")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandPayoutsController {
  constructor(
    private readonly legacyPayouts: BrandPayoutsService,
    private readonly authorization: BrandPayoutsAuthorizationService,
    @Inject(BRAND_PAYOUTS_QUERY_PORT_V2)
    private readonly payouts: BrandPayoutsQueryPortV2,
  ) {}

  @Get()
  async getPayoutsHub(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    noStore(response);
    const scope = await this.authorization.resolve(req.user);
    if (negotiateBrandPayoutsRepresentation(accept) === "V2") {
      response.type(BRAND_PAYOUTS_V2_MEDIA_TYPE);
      return this.payouts.readOverview({
        authorization: scope,
        asOf: new Date(),
      });
    }
    if (scope.kind !== "FULL_FINANCIAL") {
      throw new ForbiddenException(
        "Campaign Manager legacy financial projection is unavailable",
      );
    }
    return this.legacyPayouts.getPayoutsHub(req.user);
  }

  @Get("obligations")
  async listObligations(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Query() query: BrandPayoutsObligationsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.listObligations({
      authorization,
      asOf: new Date(),
      limit: query.limit,
      cursor: query.cursor,
      lifecycles: query.lifecycles,
      gates: query.gates,
    });
  }

  @Get("obligations/:obligationId")
  async readObligation(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Param("obligationId") obligationId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.readObligation({
      authorization,
      asOf: new Date(),
      resourceId: obligationId,
    });
  }

  @Get("activity")
  async listActivity(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Query() query: BrandPayoutsActivityQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.listActivity({
      authorization,
      asOf: new Date(),
      limit: query.limit,
      cursor: query.cursor,
      categories: query.categories,
      fromInclusive: query.from ? new Date(query.from) : undefined,
      toExclusive: query.to ? new Date(query.to) : undefined,
    });
  }

  @Get("activity.csv")
  async readActivityCsv(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Query() query: BrandPayoutsActivityCsvQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    if (!explicitlyAcceptsCsv(accept)) {
      throw new NotAcceptableException({
        code: "BRAND_PAYOUTS_CSV_REPRESENTATION_REQUIRED",
        message: "Financial activity CSV requires Accept: text/csv",
      });
    }
    noStore(response);
    const authorization = await this.authorization.resolve(req.user);
    if (authorization.kind !== "FULL_FINANCIAL") {
      throw new ForbiddenException("Financial activity export is unavailable");
    }
    const exportFile = await this.payouts.readActivityCsv({
      authorization,
      asOf: new Date(),
      fromInclusive: new Date(query.from),
      toExclusive: new Date(query.to),
      categories: query.categories,
    });
    response.status(200);
    response.setHeader("Content-Type", exportFile.contentType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportFile.filename}"`,
    );
    for await (const chunk of exportFile.body) response.write(chunk);
    response.end();
  }

  @Get("activity/:activityId")
  async readActivity(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Param("activityId") activityId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.readActivity({
      authorization,
      asOf: new Date(),
      resourceId: activityId,
    });
  }

  @Get("brand-returns")
  async listBrandReturns(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Query() query: BrandPayoutsBrandReturnsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.listBrandReturns({
      authorization,
      asOf: new Date(),
      limit: query.limit,
      cursor: query.cursor,
      statuses: query.statuses,
    });
  }

  @Get("brand-returns/:requestId")
  async readBrandReturn(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Param("requestId") requestId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.readBrandReturn({
      authorization,
      asOf: new Date(),
      resourceId: requestId,
    });
  }

  @Get("reserve-requests")
  async listReserveRequests(
    @Req() req: RequestWithAuthUser,
    @Headers("accept") accept: string | undefined,
    @Query() query: BrandPayoutsReserveRequestsQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    requireV2(accept, response);
    const authorization = await this.authorization.resolve(req.user);
    return this.payouts.listReserveRequests({
      authorization,
      asOf: new Date(),
      limit: query.limit,
      cursor: query.cursor,
      statuses: query.statuses,
    });
  }
}

function noStore(response: Response): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Accept");
}

function requireV2(accept: string | undefined, response: Response): void {
  noStore(response);
  if (negotiateBrandPayoutsRepresentation(accept) !== "V2") {
    throw new NotAcceptableException({
      code: "BRAND_PAYOUTS_V2_REPRESENTATION_REQUIRED",
      message: `This resource requires Accept: ${BRAND_PAYOUTS_V2_MEDIA_TYPE}`,
    });
  }
  response.type(BRAND_PAYOUTS_V2_MEDIA_TYPE);
}

function explicitlyAcceptsCsv(accept: string | undefined): boolean {
  return (accept ?? "").split(",").some((range) => {
    const [mediaType, ...parameters] = range
      .split(";")
      .map((part) => part.trim().toLowerCase());
    if (mediaType !== "text/csv") return false;
    const quality = parameters.find((parameter) => parameter.startsWith("q="));
    return !quality || Number(quality.slice(2)) > 0;
  });
}
