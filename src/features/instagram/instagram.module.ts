import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CreatorSettingsModule } from "../creator-settings/creator-settings.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { InstagramConnectController } from "./instagram-connect.controller";
import { InstagramConnectService } from "./instagram-connect.service";
import { InstagramGraphClient } from "./instagram-graph.client";
import { InstagramOAuthClient } from "./instagram-oauth.client";

@Module({
  imports: [PrismaModule, AuthModule, CreatorSettingsModule],
  controllers: [InstagramConnectController],
  providers: [
    InstagramConnectService,
    InstagramOAuthClient,
    InstagramGraphClient,
  ],
  exports: [
    InstagramConnectService,
    InstagramOAuthClient,
    InstagramGraphClient,
  ],
})
export class InstagramModule {}
