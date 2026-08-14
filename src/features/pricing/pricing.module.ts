import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BrandCentreModule } from "../brand-centre/brand-centre.module";
import { PricingController } from "./pricing.controller";
import { PricingWebhookController } from "./pricing-webhook.controller";
import { EntitlementService } from "./services/entitlement.service";
import { GeoRoutingService } from "./services/geo-routing.service";
import { PlanCatalogService } from "./services/plan-catalog.service";
import { PricingInvoiceService } from "./services/pricing-invoice.service";
import { PricingRazorpayClient } from "./services/pricing-razorpay.client";
import { PricingWebhookService } from "./services/pricing-webhook.service";
import { RazorpayPlanProvisioningService } from "./services/razorpay-plan-provisioning.service";
import { SubscriptionLifecycleService } from "./services/subscription-lifecycle.service";
import { PlanCommercialPolicyService } from "./services/plan-commercial-policy.service";
import { BusinessGeographyFinancialPolicyService } from "./services/business-geography-financial-policy.service";

@Module({
  imports: [PrismaModule, AuthModule, BrandCentreModule],
  controllers: [PricingController, PricingWebhookController],
  providers: [
    GeoRoutingService,
    PlanCatalogService,
    SubscriptionLifecycleService,
    EntitlementService,
    PricingRazorpayClient,
    RazorpayPlanProvisioningService,
    PricingInvoiceService,
    PricingWebhookService,
    PlanCommercialPolicyService,
    BusinessGeographyFinancialPolicyService,
  ],
  exports: [
    EntitlementService,
    PlanCatalogService,
    SubscriptionLifecycleService,
    GeoRoutingService,
    PlanCommercialPolicyService,
    BusinessGeographyFinancialPolicyService,
  ],
})
export class PricingModule {}
