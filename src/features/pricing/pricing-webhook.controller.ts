import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";

import { PricingWebhookService } from "./services/pricing-webhook.service";

@Controller("api/v1/webhooks/subscription")
export class PricingWebhookController {
  constructor(private readonly webhook: PricingWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleSubscriptionWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() rawPayload: Record<string, unknown>,
    @Headers("x-razorpay-signature") signature?: string,
  ) {
    this.webhook.verifySignature(req.rawBody, signature);
    await this.webhook.handleWebhook(rawPayload);
    return { status: "EVENT_PROCESSED" };
  }
}
