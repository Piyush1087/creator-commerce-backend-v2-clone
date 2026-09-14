import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreatorContentService } from "./creator-content.service";

@Controller("api/v1/creator/insights/content")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorContentController {
  constructor(private readonly content: CreatorContentService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  @Header("Vary", "Authorization, Cookie")
  read(@Req() request: RequestWithAuthUser) {
    return this.content.read(request.user);
  }
}
