import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { SubscriptionCapabilityModule } from "../pricing/subscription-capability.module";
import { BrandWorkspaceReadinessConsumerService } from "./brand-workspace-readiness-consumer.service";

@Module({
  imports: [PrismaModule, BrandCentreModule, SubscriptionCapabilityModule],
  providers: [BrandWorkspaceReadinessConsumerService],
  exports: [BrandWorkspaceReadinessConsumerService],
})
export class BrandWorkspaceReadinessModule {}
