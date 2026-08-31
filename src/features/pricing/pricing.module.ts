import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { BrandSettingsModule } from "../brand-settings/brand-settings.module";
import { PricingController } from "./pricing.controller";
import { PricingWebhookController } from "./pricing-webhook.controller";
import { SubscriptionLifecycleReconciliationScheduler } from "./schedulers/subscription-lifecycle-reconciliation.scheduler";
import { EntitlementService } from "./services/entitlement.service";
import { GeoRoutingService } from "./services/geo-routing.service";
import { PlanCatalogService } from "./services/plan-catalog.service";
import { PricingInvoiceService } from "./services/pricing-invoice.service";
import { PricingRazorpayClient } from "./services/pricing-razorpay.client";
import { PricingWebhookService } from "./services/pricing-webhook.service";
import { RazorpayPlanProvisioningService } from "./services/razorpay-plan-provisioning.service";
import { SubscriptionLifecycleService } from "./services/subscription-lifecycle.service";
import { SubscriptionAccessService } from "./services/subscription-access.service";
import { SubscriptionCapabilityModule } from "./subscription-capability.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BrandCentreModule,
    BrandSettingsModule,
    SubscriptionCapabilityModule,
    NotificationsModule,
  ],
  controllers: [PricingController, PricingWebhookController],
  providers: [
    GeoRoutingService,
    PlanCatalogService,
    SubscriptionLifecycleService,
    SubscriptionAccessService,
    EntitlementService,
    PricingRazorpayClient,
    RazorpayPlanProvisioningService,
    PricingInvoiceService,
    PricingWebhookService,
    SubscriptionLifecycleReconciliationScheduler,
  ],
  exports: [
    SubscriptionCapabilityModule,
    EntitlementService,
    PlanCatalogService,
    SubscriptionLifecycleService,
    SubscriptionAccessService,
    GeoRoutingService,
  ],
})
export class PricingModule {}
