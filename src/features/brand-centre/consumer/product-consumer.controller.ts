import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { ProductConsumerService } from "./product-consumer.service";

@Controller("api/v1/brand-centre")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class ProductConsumerController {
  constructor(private readonly consumer: ProductConsumerService) {}

  @Get("offerings/:offeringId/intelligence")
  read(
    @Req() request: RequestWithAuthUser,
    @Param("offeringId", new ParseUUIDPipe({ version: "4" }))
    offeringId: string,
  ) {
    return this.consumer.read(request.user, offeringId);
  }
}
