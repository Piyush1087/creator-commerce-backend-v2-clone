import { Module } from "@nestjs/common";

import { PrismaModule } from "../../../prisma/prisma.module";
import { BrandCampaignConsumerService } from "./brand-campaign-consumer.service";

@Module({
  imports: [PrismaModule],
  providers: [BrandCampaignConsumerService],
  exports: [BrandCampaignConsumerService],
})
export class BrandCampaignConsumerModule {}
