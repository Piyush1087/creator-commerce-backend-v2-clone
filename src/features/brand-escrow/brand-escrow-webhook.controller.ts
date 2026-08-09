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

import { BrandEscrowWebhookService } from "./services/brand-escrow-webhook.service";

@Controller("api/v1/webhooks/escrow")
export class BrandEscrowWebhookController {
  constructor(private readonly webhook: BrandEscrowWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleIncomingEscrowWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() rawPayload: Record<string, unknown>,
    @Headers("x-razorpay-signature") signature?: string,
  ) {
    this.webhook.verifySignature(req.rawBody, signature);
    await this.webhook.handleWebhook(rawPayload);
    return { status: "SUCCESS_HANDSHAKE_ACKNOWLEDGED" };
  }
}
