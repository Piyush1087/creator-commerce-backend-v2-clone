import {
  Body,
  Controller,
  Get,
  Put,
  Header,
  Req,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PortfolioService } from "./portfolio.service";
@Controller("api/v1/creator/portfolio")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser, @Query() query: unknown) {
    return this.portfolio.read(request.user, query);
  }
  @Put()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  mutate(@Req() request: RequestWithAuthUser, @Body() input: unknown) {
    return this.portfolio.mutate(request.user, input);
  }
}
