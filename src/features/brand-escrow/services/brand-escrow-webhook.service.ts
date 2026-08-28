import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Decimal } from "@prisma/client/runtime/library";
import { createHmac } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RazorpayClient } from "./razorpay.client";

interface Payload {
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

  verifySignature(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): void {
    if (!signature)
      throw new BadRequestException("Missing Razorpay webhook signature");
    const secret = this.config.get<string>("RAZORPAY_WEBHOOK_SECRET", "");
    if (!secret)
      throw new BadRequestException("Webhook secret is not configured");
    if (!rawBody?.length)
      throw new BadRequestException("Missing Razorpay webhook body");
    if (
      createHmac("sha256", secret).update(rawBody).digest("hex") !== signature
    )
      throw new BadRequestException("Invalid Razorpay webhook signature");
  }

  async handleWebhook(raw: unknown): Promise<void> {
    const payload = raw as Payload;
    if (payload.event === "virtual_account.credited")
      return this.creditVirtualAccount(payload);
    if (payload.event === "order.paid" || payload.event === "payment.captured")
      return this.creditGateway(payload);
    if (payload.event === "payment.failed") return this.failGateway(payload);
    if (payload.event === "payment.authorized")
      return this.captureAuthorized(payload);
  }

  private async captureAuthorized(payload: Payload): Promise<void> {
    const payment = payload.payload.payment?.entity;
    if (!payment || payment.captured === true || payment.status === "captured")
      return this.creditGateway(payload);
    if (typeof payment.id !== "string" || typeof payment.amount !== "number")
      return;
    try {
      await this.razorpay.capturePayment(payment.id, payment.amount);
    } catch (error) {
      this.logger.warn(
        `Auto-capture failed for payment ${payment.id}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  private async creditGateway(payload: Payload): Promise<void> {
    const order = payload.payload.order?.entity;
    const payment = payload.payload.payment?.entity;
    if (
      payload.event === "payment.captured" &&
      payment?.captured !== true &&
      payment?.status !== "captured"
    )
      return;
    const loadId =
      typeof order?.receipt === "string"
        ? order.receipt
        : this.note(payment, "funding_load_id");
    const orderId =
      typeof order?.id === "string"
        ? order.id
        : typeof payment?.order_id === "string"
          ? payment.order_id
          : undefined;
    const paymentId = typeof payment?.id === "string" ? payment.id : undefined;
    if (!loadId && !orderId) return;
    await this.prisma.$transaction(async (tx) => {
      const load = loadId
        ? await tx.escrowFundingLoad.findUnique({ where: { id: loadId } })
        : await tx.escrowFundingLoad.findUnique({
            where: { providerOrderId: orderId },
          });
      if (!load || load.state === "CREDITED" || load.state === "FAILED") return;
      if (orderId && load.providerOrderId && orderId !== load.providerOrderId)
        return;
      await tx.escrowFundingLoad.update({
        where: { id: load.id },
        data: {
          state: "CREDITED",
          providerPaymentId: paymentId,
          creditedAt: new Date(),
          sourceReference: paymentId ?? orderId,
        },
      });
      await tx.escrowTransactionLedger.update({
        where: { idempotencyKey: `load:${load.idempotencyKey}` },
        data: {
          transactionStatus: "CREDITED",
          gatewayReferenceId: orderId ?? paymentId,
        },
      });
      if (load.processingFee.greaterThan(0))
        await tx.escrowTransactionLedger.update({
          where: { idempotencyKey: `load-fee:${load.idempotencyKey}` },
          data: { transactionStatus: "CREDITED" },
        });
      await tx.brandEscrowVault.update({
        where: { id: load.vaultId },
        data: {
          totalPooledBalance: { increment: load.principalAmount },
          availableBalance: { increment: load.principalAmount },
        },
      });
    });
  }

  private async creditVirtualAccount(payload: Payload): Promise<void> {
    const payment = payload.payload.payment?.entity;
    const account = payload.payload.virtual_account?.entity;
    if (
      typeof payment?.id !== "string" ||
      typeof payment.amount !== "number" ||
      typeof account?.id !== "string"
    )
      return;
    const paymentId = payment.id;
    const amount = payment.amount;
    const accountId = account.id;
    await this.prisma.$transaction(async (tx) => {
      const vault = await tx.brandEscrowVault.findUnique({
        where: { razorpayVirtualAccountId: accountId },
      });
      if (!vault?.virtualAccountEnabled || vault.currency !== "INR") return;
      const existing = await tx.escrowFundingLoad.findUnique({
        where: { providerCreditId: paymentId },
      });
      if (existing) return;
      const principal = new Decimal(amount).div(100);
      const currency =
        typeof payment.currency === "string"
          ? payment.currency
          : vault.currency;
      if (currency !== vault.currency) return;
      await tx.escrowFundingLoad.create({
        data: {
          vaultId: vault.id,
          brandProfileId: vault.brandProfileId,
          sourceType: "VIRTUAL_ACCOUNT",
          currency,
          principalAmount: principal,
          state: "CREDITED",
          providerPaymentId: paymentId,
          providerCreditId: paymentId,
          sourceReference: paymentId,
          creditedAt: new Date(),
        },
      });
      await tx.escrowTransactionLedger.create({
        data: {
          vaultId: vault.id,
          brandProfileId: vault.brandProfileId,
          transactionType: "LOAD",
          amount: principal,
          currency,
          idempotencyKey: `va:${paymentId}`,
          gatewayReferenceId: paymentId,
          transactionStatus: "CREDITED",
        },
      });
      await tx.brandEscrowVault.update({
        where: { id: vault.id },
        data: {
          totalPooledBalance: { increment: principal },
          availableBalance: { increment: principal },
        },
      });
    });
  }

  private async failGateway(payload: Payload): Promise<void> {
    const payment = payload.payload.payment?.entity;
    const loadId = this.note(payment, "funding_load_id");
    const orderId =
      typeof payment?.order_id === "string" ? payment.order_id : undefined;
    if (!loadId && !orderId) return;
    const load = loadId
      ? await this.prisma.escrowFundingLoad.findUnique({
          where: { id: loadId },
        })
      : await this.prisma.escrowFundingLoad.findUnique({
          where: { providerOrderId: orderId },
        });
    if (!load || load.state === "CREDITED") return;
    await this.prisma.$transaction([
      this.prisma.escrowFundingLoad.update({
        where: { id: load.id },
        data: {
          state: "FAILED",
          failedAt: new Date(),
          providerPaymentId:
            typeof payment?.id === "string" ? payment.id : undefined,
        },
      }),
      this.prisma.escrowTransactionLedger.update({
        where: { idempotencyKey: `load:${load.idempotencyKey}` },
        data: { transactionStatus: "FAILED" },
      }),
    ]);
  }

  private note(
    entity: Record<string, unknown> | undefined,
    key: string,
  ): string | undefined {
    const notes = entity?.notes as Record<string, unknown> | undefined;
    return typeof notes?.[key] === "string" ? notes[key] : undefined;
  }
}
