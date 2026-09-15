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
import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorBrandService } from "./creator-brand.service";

@Controller("api/v1/creator/brand")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorBrandController {
  constructor(private readonly brand: CreatorBrandService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser) {
    return this.brand.read(request.user);
  }
  @Put()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  mutate(@Req() request: RequestWithAuthUser, @Body() input: unknown) {
    return this.brand.mutate(request.user, input);
  }
}
