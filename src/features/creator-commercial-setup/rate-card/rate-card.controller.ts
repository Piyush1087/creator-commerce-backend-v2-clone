import {
  Body,
  Controller,
  Get,
  Put,
  Header,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestWithAuthUser } from "../../auth/auth.controller";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { RateCardService } from "./rate-card.service";
@Controller("api/v1/creator/commercial-setup/rate-card")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class RateCardController {
  constructor(private readonly rates: RateCardService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser) {
    return this.rates.read(request.user);
  }
  @Put()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  mutate(@Req() request: RequestWithAuthUser, @Body() input: unknown) {
    return this.rates.mutate(request.user, input);
  }
}
