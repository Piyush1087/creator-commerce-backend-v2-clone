import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CreatorMarketplaceModule } from "../creator-marketplace/creator-marketplace.module";
import { CreatorUceController } from "./creator-uce.controller";
import { CreatorUceCampaignsService } from "./services/creator-uce-campaigns.service";

@Module({
  imports: [PrismaModule, AuthModule, CreatorMarketplaceModule],
  controllers: [CreatorUceController],
  providers: [CreatorUceCampaignsService],
})
export class CreatorUceModule {}
