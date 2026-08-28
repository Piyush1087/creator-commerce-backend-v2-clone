import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { RequestWithAuthUser } from "../auth/auth.controller";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BrandCentreAuthService } from "../brand-centre/brand-centre-auth.service";
import { BrandSettingsAccessService } from "../brand-settings/services/brand-settings-access.service";
import { ChangeTierDto } from "./dto/pricing.dto";
import { EntitlementService } from "./services/entitlement.service";
import { GeoRoutingService } from "./services/geo-routing.service";
import { PlanCatalogService } from "./services/plan-catalog.service";
import { PricingInvoiceService } from "./services/pricing-invoice.service";
import { SubscriptionLifecycleService } from "./services/subscription-lifecycle.service";

@Controller("api/v1/pricing")
@UseGuards(ThrottlerGuard, JwtAuthGuard)
export class PricingController {
  constructor(
    private readonly brandAuth: BrandCentreAuthService,
    private readonly brandSettingsAccess: BrandSettingsAccessService,
    private readonly planCatalog: PlanCatalogService,
    private readonly lifecycle: SubscriptionLifecycleService,
    private readonly entitlement: EntitlementService,
    private readonly geoRouting: GeoRoutingService,
    private readonly invoices: PricingInvoiceService,
  ) {}

  @Get("plans")
  async getVisiblePlans(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    const plans = await this.planCatalog.getVisiblePlans(brandProfileId);
    return { plans };
  }

  @Public()
  @Get("plans/public")
  async getPublicPlans() {
    const plans = await this.planCatalog.getVisiblePlans(null);
    return { plans };
  }

  @Get("subscription")
  async getSubscription(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    const subscription = await this.lifecycle.getSubscription(brandProfileId);
    return { subscription };
  }

  @Get("usage")
  async getUsage(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    const usage = await this.entitlement.getUsageSnapshot(brandProfileId);
    return { usage };
  }

  @Get("invoices")
  async listInvoices(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    const invoices = await this.invoices.listInvoicesForBrand(brandProfileId);
    return { invoices };
  }

  @Get("invoices/:razorpayInvoiceId")
  async getInvoice(
    @Req() req: RequestWithAuthUser,
    @Param("razorpayInvoiceId") razorpayInvoiceId: string,
  ) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    const invoice = await this.invoices.getInvoiceForBrand(
      brandProfileId,
      razorpayInvoiceId,
    );
    return { invoice };
  }

  @Get("invoices/:razorpayInvoiceId/view")
  async viewInvoice(
    @Req() req: RequestWithAuthUser,
    @Param("razorpayInvoiceId") razorpayInvoiceId: string,
    @Res() res: Response,
  ) {
    const brandProfileId = await this.brandAuth.resolveBrandProfileId(req.user);
    const viewUrl = await this.invoices.resolveInvoiceViewUrl(
      brandProfileId,
      razorpayInvoiceId,
    );
    return res.redirect(HttpStatus.FOUND, viewUrl);
  }

  @Get("geo-context")
  async getGeoContext(@Req() req: RequestWithAuthUser) {
    const profile = await this.brandAuth.resolveBrandProfile(req.user);
    const geoContext = this.geoRouting.resolveGeoContext(profile.countryCode);
    return { geoContext };
  }

  @Post("trial/bootstrap")
  @HttpCode(HttpStatus.CREATED)
  async bootstrapLocalTrial(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    const subscription =
      await this.lifecycle.bootstrapLocalTrial(brandProfileId);
    return { subscription };
  }

  @Post("trial/restore")
  @HttpCode(HttpStatus.OK)
  async restoreFoundersTrial(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    const subscription =
      await this.lifecycle.restoreFoundersTrialAfterAbandonedCheckout(
        brandProfileId,
      );
    return { subscription };
  }

  @Post("trial/razorpay")
  @HttpCode(HttpStatus.CREATED)
  async initializeRazorpayTrial(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    return this.lifecycle.startPaidConversion(brandProfileId);
  }

  @Post("tier/change")
  @HttpCode(HttpStatus.OK)
  async changeTier(
    @Req() req: RequestWithAuthUser,
    @Body() body: ChangeTierDto,
  ) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    return this.lifecycle.upgradeOrDowngradeTier(
      brandProfileId,
      body.target_tier,
    );
  }

  @Post("paid-conversion/start")
  @HttpCode(HttpStatus.CREATED)
  async startPaidConversion(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    return this.lifecycle.startPaidConversion(brandProfileId);
  }

  @Post("cancel")
  @HttpCode(HttpStatus.OK)
  async cancelSubscription(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    const subscription =
      await this.lifecycle.cancelSubscription(brandProfileId);
    return { subscription };
  }

  @Post("reactivate")
  @HttpCode(HttpStatus.OK)
  async reactivateSubscription(@Req() req: RequestWithAuthUser) {
    const brandProfileId = await this.resolveMutationBrandId(req);
    return this.lifecycle.reactivateSubscription(brandProfileId);
  }

  private async resolveMutationBrandId(
    req: RequestWithAuthUser,
  ): Promise<string> {
    const context = await this.brandSettingsAccess.resolveBrandContext(
      req.user,
    );
    this.brandSettingsAccess.assertFinancialMutation(context.membership.role);
    return context.brandProfileId;
  }
}
