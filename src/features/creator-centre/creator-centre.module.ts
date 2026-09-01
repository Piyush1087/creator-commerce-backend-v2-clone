import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { CreatorEntryModule } from "../creator-entry/creator-entry.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { CreatorCentreController } from "./creator-centre.controller";
import { CreatorCentreService } from "./creator-centre.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CreatorSettingsModule,
    CreatorEntryModule,
  ],
  controllers: [CreatorCentreController],
  providers: [CreatorCentreService],
  exports: [CreatorCentreService],
})
export class CreatorCentreModule {}
