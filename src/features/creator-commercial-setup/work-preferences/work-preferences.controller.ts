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
import { WorkPreferencesService } from "./work-preferences.service";
@Controller("api/v1/creator/commercial-setup/work-preferences")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class WorkPreferencesController {
  constructor(private readonly preferences: WorkPreferencesService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser) {
    return this.preferences.read(request.user);
  }
  @Put()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  mutate(@Req() request: RequestWithAuthUser, @Body() input: unknown) {
    return this.preferences.mutate(request.user, input);
  }
}
