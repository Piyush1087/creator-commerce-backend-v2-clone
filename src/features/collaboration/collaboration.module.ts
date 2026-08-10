import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationGateway } from "./collaboration.gateway";
import { CollaborationAccessService } from "./services/collaboration-access.service";
import { CollaborationCreatorProfileService } from "./services/collaboration-creator-profile.service";
import { CollaborationExceptionService } from "./services/collaboration-exception.service";
import { CollaborationFulfillmentService } from "./services/collaboration-fulfillment.service";
import { CollaborationProvisionService } from "./services/collaboration-provision.service";
import { CollaborationProductionService } from "./services/collaboration-production.service";
import { CollaborationPublishingService } from "./services/collaboration-publishing.service";
import {
  CollaborationFundingGateway,
  DeferredCollaborationFundingGateway,
} from "./services/collaboration-funding.gateway";
import { CollaborationNegotiationService } from "./services/collaboration-negotiation.service";
import { CollaborationPaymentCapabilityService } from "./services/collaboration-payment-capability.service";
import { CollaborationRealtimeService } from "./services/collaboration-realtime.service";
import { CollaborationQueryService } from "./services/collaboration-query.service";
import { CollaborationService } from "./services/collaboration.service";
import { CollaborationSecurementService } from "./services/collaboration-securement.service";
import {
  CollaborationSettlementGateway,
  DeferredCollaborationSettlementGateway,
} from "./services/collaboration-settlement.gateway";
import { CollaborationSettlementService } from "./services/collaboration-settlement.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationProcessorService } from "../notifications/services/notification-processor.service";
import { BrandEscrowModule } from "../brand-escrow/brand-escrow.module";
import { PricingModule } from "../pricing/pricing.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandCentreModule,
    NotificationsModule,
    BrandEscrowModule,
    PricingModule,
  ],
  controllers: [CollaborationController],
  providers: [
    CollaborationGateway,
    CollaborationAccessService,
    CollaborationExceptionService,
    CollaborationProvisionService,
    CollaborationNegotiationService,
    CollaborationPaymentCapabilityService,
    CollaborationSecurementService,
    CollaborationFulfillmentService,
    CollaborationProductionService,
    CollaborationPublishingService,
    CollaborationSettlementService,
    {
      provide: CollaborationSettlementGateway,
      useClass: DeferredCollaborationSettlementGateway,
    },
    {
      provide: CollaborationFundingGateway,
      useClass: DeferredCollaborationFundingGateway,
    },
    CollaborationRealtimeService,
    CollaborationQueryService,
    CollaborationService,
    CollaborationCreatorProfileService,
  ],
  exports: [
    CollaborationProvisionService,
    CollaborationExceptionService,
    CollaborationProductionService,
    CollaborationPublishingService,
    CollaborationSettlementService,
    CollaborationService,
  ],
})
export class CollaborationModule {}
