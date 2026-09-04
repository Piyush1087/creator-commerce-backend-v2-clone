import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CollaborationConsumerService } from "./services/collaboration-consumer.service";

@Module({
  imports: [PrismaModule, BrandCentreModule],
  providers: [CollaborationConsumerService],
  exports: [CollaborationConsumerService],
})
export class CollaborationConsumerModule {}
