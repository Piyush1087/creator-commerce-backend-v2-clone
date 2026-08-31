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

import { BrandReturnWebhookService } from "./services/brand-return-webhook.service";

@Controller("api/v1/webhooks/escrow/brand-returns")
export class BrandReturnWebhookController {
  constructor(private readonly webhook: BrandReturnWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, unknown>,
    @Headers("x-razorpay-signature") signature?: string,
  ) {
    this.webhook.verifySignature(req.rawBody, signature);
    await this.webhook.handle(req.rawBody!, payload);
    return { status: "SUCCESS_HANDSHAKE_ACKNOWLEDGED" };
  }
}
