import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { PricingModule } from "../pricing/pricing.module";
import { SubscriptionCapabilityModule } from "../pricing/subscription-capability.module";
import { BrandEscrowController } from "./brand-escrow.controller";
import {
  BrandEscrowEngineController,
  BrandEscrowHardenedController,
  BrandEscrowInterlockController,
} from "./brand-escrow.controller";
import { BrandEscrowWebhookController } from "./brand-escrow-webhook.controller";
import { RouteWebhookController } from "./route-webhook.controller";
import { BrandEscrowAccessService } from "./services/brand-escrow-access.service";
import { BrandEscrowComputationService } from "./services/brand-escrow-computation.service";
import { BrandEscrowHardenedService } from "./services/brand-escrow-hardened.service";
import { BrandEscrowInterlockService } from "./services/brand-escrow-interlock.service";
import { BrandEscrowService } from "./services/brand-escrow.service";
import { BrandEscrowWebhookService } from "./services/brand-escrow-webhook.service";
import { EscrowComputationEngine } from "./services/escrow-computation.engine";
import { EscrowSubscriptionContextService } from "./services/escrow-subscription-context.service";
import { IdempotencyManager } from "./services/idempotency.manager";
import { RazorpayClient } from "./services/razorpay.client";
import { NotificationsModule } from "../notifications/notifications.module";
import { CreatorPayoutObligationService } from "./services/creator-payout-obligation.service";
import { CreatorPayoutProfileService } from "./services/creator-payout-profile.service";
import { RazorpayRouteAdapter } from "./services/razorpay-route.adapter";
import { RouteReconciliationService } from "./services/route-reconciliation.service";
import { RouteTransferService } from "./services/route-transfer.service";
import { RouteWebhookEventParser } from "./services/route-webhook-event.parser";
import { RouteWebhookService } from "./services/route-webhook.service";
import { EscrowFinancialAllocationService } from "./services/escrow-financial-allocation.service";
import { CollaborationRefundInstructionService } from "./services/collaboration-refund-instruction.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandCentreModule,
    PricingModule,
    SubscriptionCapabilityModule,
    NotificationsModule,
  ],
  controllers: [
    BrandEscrowController,
    BrandEscrowEngineController,
    BrandEscrowInterlockController,
    BrandEscrowHardenedController,
    BrandEscrowWebhookController,
    RouteWebhookController,
  ],
  providers: [
    BrandEscrowAccessService,
    BrandEscrowService,
    BrandEscrowComputationService,
    BrandEscrowInterlockService,
    BrandEscrowHardenedService,
    BrandEscrowWebhookService,
    EscrowComputationEngine,
    EscrowSubscriptionContextService,
    IdempotencyManager,
    RazorpayClient,
    CreatorPayoutProfileService,
    EscrowFinancialAllocationService,
    CreatorPayoutObligationService,
    CollaborationRefundInstructionService,
    RazorpayRouteAdapter,
    RouteTransferService,
    RouteReconciliationService,
    RouteWebhookEventParser,
    RouteWebhookService,
  ],
  exports: [
    BrandEscrowService,
    BrandEscrowComputationService,
    BrandEscrowInterlockService,
    BrandEscrowHardenedService,
    CreatorPayoutProfileService,
    CreatorPayoutObligationService,
    CollaborationRefundInstructionService,
    RouteTransferService,
    RouteReconciliationService,
  ],
})
export class BrandEscrowModule {}
