import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { RouteReconciliationService } from "./route-reconciliation.service";
import { RouteWebhookEventParser } from "./route-webhook-event.parser";

@Injectable()
export class RouteWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly parser: RouteWebhookEventParser,
    private readonly reconciliation: RouteReconciliationService,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature?: string): void {
    const secret = this.config.get<string>("RAZORPAY_ROUTE_WEBHOOK_SECRET", "");
    if (!secret)
      throw new BadRequestException("Route webhook is not configured");
    if (!rawBody?.length || !signature)
      throw new BadRequestException("Missing Route webhook signature material");
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, "hex");
    } catch {
      throw new BadRequestException("Invalid Route webhook signature");
    }
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    )
      throw new BadRequestException("Invalid Route webhook signature");
  }

  async handle(rawBody: Buffer, raw: unknown): Promise<void> {
    const event = this.parser.parse(raw);
    if (event.kind === "UNKNOWN") return;
    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const eventIdentity = createHash("sha256")
      .update(
        JSON.stringify([
          event.rawEventType,
          event.objectId,
          event.providerState,
          payloadHash,
        ]),
      )
      .digest("hex");
    try {
      await this.prisma.routeWebhookReceipt.create({
        data: {
          eventIdentity,
          eventType: event.rawEventType,
          payloadHash,
          providerObjectId: event.objectId,
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
      if (event.kind === "TRANSFER") {
        await this.reconciliation.reconcileTransfer({
          transferId: event.objectId,
          providerState: event.providerState,
          onHold: event.onHold,
          onHoldUntil: event.onHoldUntil,
        });
      } else if (event.kind === "SETTLEMENT") {
        await this.reconciliation.confirmSettlement({
          settlementId: event.objectId,
          transferId: event.transferId,
          providerState: event.providerState,
        });
      } else {
        await this.reconciliation.reconcileReversal({
          reversalId: event.objectId,
          providerState: event.providerState,
        });
      }
    } catch (error) {
      await this.prisma.routeWebhookReceipt.delete({
        where: { eventIdentity },
      });
      throw error;
    }
  }
}
