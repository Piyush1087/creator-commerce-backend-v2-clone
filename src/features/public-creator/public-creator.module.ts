import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { PublicCreatorController } from "./public-creator.controller";
import { PublicCreatorService } from "./public-creator.service";

@Module({
  imports: [PrismaModule],
  controllers: [PublicCreatorController],
  providers: [PublicCreatorService],
  exports: [PublicCreatorService],
})
export class PublicCreatorModule {}
