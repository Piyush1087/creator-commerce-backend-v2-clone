import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { BrandConsumerService } from "./brand-consumer.service";

@Controller("api/v1/brand-centre")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class BrandConsumerController {
  constructor(private readonly consumer: BrandConsumerService) {}

  @Get("brand")
  read(@Req() request: RequestWithAuthUser) {
    return this.consumer.read(request.user);
  }
}
