import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { PublicCreatorController } from "./public-creator.controller";
import { PublicCreatorService } from "./public-creator.service";
import { CreatorMediaKitModule } from "../creator-media-kit/creator-media-kit.module";

@Module({
  imports: [PrismaModule, CreatorMediaKitModule],
  controllers: [PublicCreatorController],
  providers: [PublicCreatorService],
  exports: [PublicCreatorService],
})
export class PublicCreatorModule {}
