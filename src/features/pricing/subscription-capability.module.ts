import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { SubscriptionAccessService } from "./services/subscription-access.service";
import { SubscriptionCapabilityService } from "./services/subscription-capability.service";

@Module({
  imports: [PrismaModule],
  providers: [SubscriptionAccessService, SubscriptionCapabilityService],
  exports: [SubscriptionAccessService, SubscriptionCapabilityService],
})
export class SubscriptionCapabilityModule {}
