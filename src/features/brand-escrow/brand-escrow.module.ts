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
  ],
  exports: [
    BrandEscrowService,
    BrandEscrowComputationService,
    BrandEscrowInterlockService,
    BrandEscrowHardenedService,
  ],
})
export class BrandEscrowModule {}
