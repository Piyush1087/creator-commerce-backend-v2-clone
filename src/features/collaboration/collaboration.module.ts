import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationGateway } from "./collaboration.gateway";
import { CollaborationAccessService } from "./services/collaboration-access.service";
import { CollaborationCreatorProfileService } from "./services/collaboration-creator-profile.service";
import { CollaborationProvisionService } from "./services/collaboration-provision.service";
import { CollaborationRealtimeService } from "./services/collaboration-realtime.service";
import { CollaborationService } from "./services/collaboration.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationProcessorService } from "../notifications/services/notification-processor.service";
import { SubscriptionCapabilityModule } from "../pricing/subscription-capability.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandCentreModule,
    NotificationsModule,
    SubscriptionCapabilityModule,
  ],
  controllers: [CollaborationController],
  providers: [
    CollaborationGateway,
    CollaborationAccessService,
    CollaborationProvisionService,
    CollaborationRealtimeService,
    CollaborationService,
    CollaborationCreatorProfileService,
  ],
  exports: [CollaborationProvisionService, CollaborationService],
})
export class CollaborationModule {}
