import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { BrandReturnService } from "./brand-return.service";
import { BrandReturnWebhookEventParser } from "./brand-return-webhook-event.parser";

@Injectable()
export class BrandReturnWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly parser: BrandReturnWebhookEventParser,
    private readonly brandReturns: BrandReturnService,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature?: string): void {
    const secret = this.config.get<string>(
      "RAZORPAY_BRAND_RETURN_WEBHOOK_SECRET",
      "",
    );
    if (!secret)
      throw new BadRequestException(
        "Brand Return refund webhook is not configured",
      );
    if (!rawBody?.length || !signature)
      throw new BadRequestException(
        "Missing Brand Return refund webhook signature material",
      );
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    const supplied = Buffer.from(signature, "hex");
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      throw new BadRequestException(
        "Invalid Brand Return refund webhook signature",
      );
    }
  }

  async handle(rawBody: Buffer, raw: unknown): Promise<void> {
    const event = this.parser.parse(raw);
    if (event.kind === "UNKNOWN") return;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const eventIdentity = createHash("sha256")
      .update(
        JSON.stringify([
          event.rawEventType,
          event.providerRefundId,
          event.providerState,
          payloadHash,
        ]),
      )
      .digest("hex");
    try {
      await this.prisma.brandReturnWebhookReceipt.create({
        data: {
          eventIdentity,
          eventType: event.rawEventType,
          payloadHash,
          providerRefundId: event.providerRefundId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return;
      throw error;
    }
    try {
      await this.brandReturns.reconcileProviderRefund(
        event.providerRefundId,
        event.kind === "SUCCEEDED"
          ? {
              kind: "SUCCEEDED",
              providerRefundId: event.providerRefundId,
              providerState: event.providerState,
            }
          : event.kind === "TERMINAL_REJECTION"
            ? {
                kind: "TERMINAL_REJECTION",
                providerState: event.providerState,
              }
            : event.kind === "RETRYABLE_FAILURE"
              ? {
                  kind: "RETRYABLE_FAILURE",
                  providerState: event.providerState,
                }
              : {
                  kind: "AMBIGUOUS",
                  providerRefundId: event.providerRefundId,
                  providerState: event.providerState,
                },
      );
    } catch (error) {
      await this.prisma.brandReturnWebhookReceipt.delete({
        where: { eventIdentity },
      });
      throw error;
    }
  }
}
