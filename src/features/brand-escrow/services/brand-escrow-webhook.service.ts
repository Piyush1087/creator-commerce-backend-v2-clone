import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Decimal } from "@prisma/client/runtime/library";
import { createHmac, randomUUID } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { RazorpayClient } from "./razorpay.client";

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: Record<string, unknown> };
    order?: { entity: Record<string, unknown> };
    virtual_account?: { entity: Record<string, unknown> };
  };
}

@Injectable()
export class BrandEscrowWebhookService {
  private readonly logger = new Logger(BrandEscrowWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly razorpay: RazorpayClient,
  ) {}

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    if (!signature) {
      throw new BadRequestException("Missing Razorpay webhook signature");
    }

    const secret = this.config.get<string>("RAZORPAY_WEBHOOK_SECRET", "");
    if (!secret) {
      throw new BadRequestException("Webhook secret is not configured");
    }

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException("Missing Razorpay webhook body");
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      throw new BadRequestException("Invalid Razorpay webhook signature");
    }
  }

  async handleWebhook(rawPayload: unknown): Promise<void> {
    const payload = rawPayload as RazorpayWebhookPayload;
    switch (payload.event) {
      case "virtual_account.credited":
        await this.handleVirtualAccountCredited(payload);
        return;
      case "order.paid":
        await this.handleOrderPaid(payload);
        return;
      case "payment.captured":
        await this.handleCardTopUpFromPayment(payload, { requireCaptured: true });
        return;
      case "payment.authorized":
        await this.handlePaymentAuthorized(payload);
        return;
      case "payment.failed":
        await this.handlePaymentFailed(payload);
        return;
      default:
        return;
    }
  }

  private async handleVirtualAccountCredited(
    rawPayload: RazorpayWebhookPayload,
  ): Promise<void> {
    const paymentDetails = rawPayload.payload.payment?.entity;
    const virtualAccount = rawPayload.payload.virtual_account?.entity;

    if (!paymentDetails || !virtualAccount) {
      return;
    }

    const rzpVirtualAccountId = String(virtualAccount.id);
    const paymentId = String(paymentDetails.id);
    const creditAmount = new Decimal(Number(paymentDetails.amount)).div(100);
    const currency = String(paymentDetails.currency);

    await this.prisma.$transaction(async (tx) => {
      const vault = await tx.brandEscrowVault.findUnique({
        where: { razorpayVirtualAccountId: rzpVirtualAccountId },
      });

      if (!vault) {
        return;
      }

      const existingLedgerLog = await tx.escrowTransactionLedger.findUnique({
        where: { gatewayReferenceId: paymentId },
      });

      if (existingLedgerLog) {
        return;
      }

      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: vault.brandProfileId,
          transactionType: "VBA_TOPUP_WIRE",
          amount: creditAmount,
          currency,
          idempotencyKey: randomUUID(),
          gatewayReferenceId: paymentId,
          transactionStatus: "CLEARED",
        },
      });

      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          totalPooledBalance: { increment: creditAmount },
          availableBalance: { increment: creditAmount },
        },
      });
    });
  }

  private async handleOrderPaid(rawPayload: RazorpayWebhookPayload): Promise<void> {
    const orderDetails = rawPayload.payload.order?.entity;
    if (!orderDetails?.receipt) {
      return;
    }

    const internalTxId = String(orderDetails.receipt);
    const gatewayReferenceId = String(orderDetails.id);
    await this.clearCardTopUpLedger(internalTxId, gatewayReferenceId);
  }

  private async handlePaymentAuthorized(
    rawPayload: RazorpayWebhookPayload,
  ): Promise<void> {
    const payment = rawPayload.payload.payment?.entity;
    if (!payment) {
      return;
    }

    if (payment.captured === true || payment.status === "captured") {
      await this.handleCardTopUpFromPayment(rawPayload, { requireCaptured: true });
      return;
    }

    const paymentId = typeof payment.id === "string" ? payment.id : null;
    const amount = typeof payment.amount === "number" ? payment.amount : null;

    if (!paymentId || amount === null) {
      return;
    }

    try {
      await this.razorpay.capturePayment(paymentId, amount);
    } catch (error) {
      this.logger.warn(
        `Auto-capture failed for payment ${paymentId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  private async handleCardTopUpFromPayment(
    rawPayload: RazorpayWebhookPayload,
    options: { requireCaptured: boolean },
  ): Promise<void> {
    const payment = rawPayload.payload.payment?.entity;
    if (!payment) {
      return;
    }

    if (options.requireCaptured) {
      const captured = payment.captured === true || payment.status === "captured";
      if (!captured) {
        return;
      }
    }

    const internalTxId = await this.resolveCardTopUpInternalTxId(rawPayload);
    if (!internalTxId) {
      return;
    }

    const orderId =
      typeof payment.order_id === "string" ? payment.order_id : undefined;
    const paymentId = typeof payment.id === "string" ? payment.id : undefined;
    const gatewayReferenceId = orderId ?? paymentId;

    if (!gatewayReferenceId) {
      return;
    }

    await this.clearCardTopUpLedger(internalTxId, gatewayReferenceId);
  }

  private async resolveCardTopUpInternalTxId(
    rawPayload: RazorpayWebhookPayload,
  ): Promise<string | null> {
    const orderDetails = rawPayload.payload.order?.entity;
    if (orderDetails?.receipt) {
      return String(orderDetails.receipt);
    }

    const payment = rawPayload.payload.payment?.entity;
    if (!payment) {
      return null;
    }

    const notes = payment.notes as Record<string, unknown> | undefined;
    if (typeof notes?.internal_transaction_id === "string") {
      return notes.internal_transaction_id;
    }

    const orderId = typeof payment.order_id === "string" ? payment.order_id : null;
    if (!orderId) {
      return null;
    }

    const ledgerByOrder = await this.prisma.escrowTransactionLedger.findFirst({
      where: {
        gatewayReferenceId: orderId,
        transactionType: "GATEWAY_TOPUP_CARD",
      },
      select: { id: true },
    });

    return ledgerByOrder?.id ?? null;
  }

  private async clearCardTopUpLedger(
    internalTxId: string,
    gatewayReferenceId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const matchingLedgerRow = await tx.escrowTransactionLedger.findUnique({
        where: { id: internalTxId },
      });

      if (!matchingLedgerRow || matchingLedgerRow.transactionStatus === "CLEARED") {
        return;
      }

      await tx.escrowTransactionLedger.update({
        where: { id: internalTxId },
        data: {
          transactionStatus: "CLEARED",
          gatewayReferenceId,
        },
      });

      await tx.brandEscrowVault.update({
        where: { id: matchingLedgerRow.vaultId },
        data: {
          totalPooledBalance: { increment: matchingLedgerRow.amount },
          availableBalance: { increment: matchingLedgerRow.amount },
        },
      });
    });
  }

  private async handlePaymentFailed(
    rawPayload: RazorpayWebhookPayload,
  ): Promise<void> {
    const paymentDetails = rawPayload.payload.payment?.entity;
    if (!paymentDetails) {
      return;
    }

    const notes = paymentDetails.notes as Record<string, unknown> | undefined;
    const internalTxId =
      typeof notes?.internal_transaction_id === "string"
        ? notes.internal_transaction_id
        : typeof notes?.internalTransactionId === "string"
          ? notes.internalTransactionId
          : undefined;

    if (!internalTxId) {
      return;
    }

    await this.prisma.escrowTransactionLedger.update({
      where: { id: internalTxId },
      data: {
        transactionStatus: "FAILED",
        gatewayReferenceId: String(paymentDetails.id),
        errorDiagnosticPayload: {
          message:
            typeof paymentDetails.error_description === "string"
              ? paymentDetails.error_description
              : "Transaction declined by bank",
        },
      },
    });
  }
}
