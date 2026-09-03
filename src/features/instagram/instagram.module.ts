import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { InstagramConnectController } from "./instagram-connect.controller";
import { InstagramConnectService } from "./instagram-connect.service";
import { InstagramProviderClientModule } from "./instagram-provider-client.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CreatorSettingsModule,
    InstagramProviderClientModule,
  ],
  controllers: [InstagramConnectController],
  providers: [InstagramConnectService],
  exports: [InstagramConnectService, InstagramProviderClientModule],
})
export class InstagramModule {}
