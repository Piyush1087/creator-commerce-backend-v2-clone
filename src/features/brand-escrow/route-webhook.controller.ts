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

import { RouteWebhookService } from "./services/route-webhook.service";

@Controller("api/v1/webhooks/escrow/route")
export class RouteWebhookController {
  constructor(private readonly webhook: RouteWebhookService) {}

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
