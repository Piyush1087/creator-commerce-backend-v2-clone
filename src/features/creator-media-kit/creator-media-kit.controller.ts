import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";
import { z } from "zod";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../creator-onboarding/pipes/zod-validation.pipe";
import {
  CreatorMediaKitEventRequestSchema,
  CreatorMediaKitMutationSchema,
} from "./contracts/creator-media-kit.contract";
import { CreatorMediaKitService } from "./creator-media-kit.service";

const PreviewSchema = z
  .object({ preview: z.enum(["PUBLIC", "VERIFIED"]).default("VERIFIED") })
  .strict();

@Controller("api/v1/creator/media-kit")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorMediaKitCreatorController {
  constructor(private readonly mediaKit: CreatorMediaKitService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  read(
    @Req() request: RequestWithAuthUser,
    @Query(new ZodValidationPipe(PreviewSchema))
    query: z.infer<typeof PreviewSchema>,
  ) {
    return this.mediaKit.readCreator(request.user, query.preview);
  }

  @Patch()
  @Header("Cache-Control", "no-store")
  mutate(
    @Req() request: RequestWithAuthUser,
    @Body(new ZodValidationPipe(CreatorMediaKitMutationSchema))
    body: unknown,
  ) {
    return this.mediaKit.mutate(request.user, body);
  }

  @Post("pdf")
  @Header("Cache-Control", "no-store")
  pdf(@Req() request: RequestWithAuthUser) {
    return this.mediaKit.recordCreatorPdf(request.user);
  }
}

@Controller("api/v1/public/media-kits")
@UseGuards(ThrottlerGuard)
export class CreatorMediaKitPublicController {
  constructor(private readonly mediaKit: CreatorMediaKitService) {}

  @Get(":publicId")
  @Header("Cache-Control", "public, max-age=60")
  @Header("X-Robots-Tag", "noindex, nofollow, noarchive")
  read(@Param("publicId") publicId: string) {
    return this.mediaKit.readPublic(publicId);
  }

  @Get(":publicId/email")
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex, nofollow, noarchive")
  revealEmail(@Param("publicId") publicId: string) {
    return this.mediaKit.revealEmail(publicId);
  }

  @Post(":publicId/events")
  @Header("Cache-Control", "no-store")
  @Header("X-Robots-Tag", "noindex, nofollow, noarchive")
  event(
    @Param("publicId") publicId: string,
    @Body(new ZodValidationPipe(CreatorMediaKitEventRequestSchema))
    body: z.infer<typeof CreatorMediaKitEventRequestSchema>,
  ) {
    return this.mediaKit.recordPublicEvent(publicId, body.eventType);
  }
}

@Controller("api/v1/brand/media-kits")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class CreatorMediaKitBrandController {
  constructor(private readonly mediaKit: CreatorMediaKitService) {}

  @Get(":publicId")
  @Header("Cache-Control", "private, no-store")
  read(
    @Req() request: RequestWithAuthUser,
    @Param("publicId") publicId: string,
  ) {
    return this.mediaKit.readVerified(request.user, publicId);
  }

  @Post(":publicId/pdf")
  @Header("Cache-Control", "private, no-store")
  pdf(
    @Req() request: RequestWithAuthUser,
    @Param("publicId") publicId: string,
  ) {
    return this.mediaKit.recordVerifiedPdf(request.user, publicId);
  }
}
