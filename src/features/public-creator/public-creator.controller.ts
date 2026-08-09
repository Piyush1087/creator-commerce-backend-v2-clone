import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import { PublicCreatorService } from "./public-creator.service";

@Controller("api/v1/public/creators")
@UseGuards(ThrottlerGuard)
export class PublicCreatorController {
  constructor(private readonly publicCreator: PublicCreatorService) {}

  @Get(":slug/media-kit")
  getMediaKit(@Param("slug") slug: string) {
    return this.publicCreator.getPublicMediaKit(slug);
  }
}
