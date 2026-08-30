import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { createHmac } from "crypto";
import { PrismaService } from "../../../prisma/prisma.service";
import { RazorpayClient } from "./razorpay.client";
import { NotificationDispatchService } from "../../notifications/services/notification-dispatch.service";
import { EscrowFundingAttributionService } from "./escrow-funding-attribution.service";

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
    private readonly notifications: NotificationDispatchService,
    private readonly attribution: EscrowFundingAttributionService,
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
    // A failed payment is one attempt against an order, not terminal funding truth.
    if (payload.event === "payment.failed") return;
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
      let load = loadId
        ? await tx.escrowFundingLoad.findUnique({ where: { id: loadId } })
        : await tx.escrowFundingLoad.findUnique({
            where: { providerOrderId: orderId },
          });
      if (!load) return;
      await tx.$queryRaw`SELECT vault_id FROM brand_escrow_vaults WHERE vault_id = ${load.vaultId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM escrow_funding_loads WHERE id = ${load.id} FOR UPDATE`;
      load = await tx.escrowFundingLoad.findUnique({ where: { id: load.id } });
      if (!load) return;
      if (orderId && load.providerOrderId && orderId !== load.providerOrderId)
        return;
      await this.ensureGatewayLedgerFoundation(tx, load);
      const expectedCaptured = load.principalAmount
        .add(load.processingFee)
        .add(load.processingFeeTax);
      const paymentAmount =
        typeof payment?.amount === "number"
          ? new Decimal(payment.amount).div(100)
          : null;
      const paymentCurrency =
        typeof payment?.currency === "string"
          ? payment.currency.toUpperCase()
          : null;
      const paymentCaptured =
        payment?.captured === true || payment?.status === "captured";
      const paymentOrderId =
        typeof payment?.order_id === "string" ? payment.order_id : null;
      const orderCorrelated =
        Boolean(orderId) &&
        Boolean(load.providerOrderId) &&
        orderId === load.providerOrderId &&
        (!paymentOrderId || paymentOrderId === load.providerOrderId);
      const proven = Boolean(
        paymentId &&
        paymentAmount?.equals(expectedCaptured) &&
        paymentCurrency === load.currency.toUpperCase() &&
        paymentCaptured &&
        orderCorrelated,
      );
      const provenanceStatus = proven ? "PROVEN_SOURCE" : "SOURCE_UNRESOLVED";
      const provenanceDiagnostic = proven
        ? { validation: "PAYMENT_CAPTURE_MATCHED" }
        : {
            validation: "SOURCE_UNRESOLVED",
            payment_id_present: Boolean(paymentId),
            amount_matches: paymentAmount?.equals(expectedCaptured) ?? false,
            currency_matches: paymentCurrency === load.currency.toUpperCase(),
            captured: paymentCaptured,
            order_correlated: orderCorrelated,
          };
      const creditedAt = load.creditedAt ?? new Date();
      if (load.state === "CREDITED") {
        const resolvedStatus =
          load.provenanceStatus === "PROVEN_SOURCE"
            ? "PROVEN_SOURCE"
            : provenanceStatus;
        await tx.escrowFundingLoad.update({
          where: { id: load.id },
          data: {
            providerPaymentId: paymentId ?? load.providerPaymentId,
            capturedAmount: paymentAmount ?? load.capturedAmount,
            paymentCurrency: paymentCurrency ?? load.paymentCurrency,
            paymentCaptured: payment ? paymentCaptured : load.paymentCaptured,
            provenanceStatus: resolvedStatus,
          },
        });
        await this.attribution.recordFundingCredit(tx, {
          loadId: load.id,
          vaultId: load.vaultId,
          brandProfileId: load.brandProfileId,
          sourceType: "GATEWAY",
          currency: load.currency,
          requestedPrincipal: load.principalAmount,
          creditedPrincipal: load.creditedPrincipal ?? load.principalAmount,
          capturedAmount: paymentAmount ?? load.capturedAmount,
          providerOrderId: load.providerOrderId ?? orderId,
          providerPaymentId: paymentId ?? load.providerPaymentId,
          providerPaymentCaptured: payment
            ? paymentCaptured
            : load.paymentCaptured,
          provenanceStatus: resolvedStatus,
          provenanceDiagnostic,
          creditedAt,
        });
        return;
      }
      await tx.escrowFundingLoad.update({
        where: { id: load.id },
        data: {
          state: "CREDITED",
          providerPaymentId: paymentId,
          creditedPrincipal: load.principalAmount,
          capturedAmount: paymentAmount,
          paymentCurrency,
          paymentCaptured: payment ? paymentCaptured : null,
          provenanceStatus,
          creditedAt,
          sourceReference: load.sourceReference ?? paymentId ?? orderId,
        },
      });
      await this.attribution.recordFundingCredit(tx, {
        loadId: load.id,
        vaultId: load.vaultId,
        brandProfileId: load.brandProfileId,
        sourceType: "GATEWAY",
        currency: load.currency,
        requestedPrincipal: load.principalAmount,
        creditedPrincipal: load.principalAmount,
        capturedAmount: paymentAmount,
        providerOrderId: load.providerOrderId ?? orderId,
        providerPaymentId: paymentId,
        providerPaymentCaptured: payment ? paymentCaptured : null,
        provenanceStatus,
        provenanceDiagnostic,
        creditedAt,
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
      await this.notifications?.enqueueWithinTransaction(tx, {
        workspaceId: load.brandProfileId,
        eventType: "escrow.funding_credited",
        source: {
          sourceType: "escrow_funding_load",
          sourceId: load.id,
          transitionId: "credited",
        },
        payload: { funding_load_id: load.id },
      });
    });
  }

  private async ensureGatewayLedgerFoundation(
    tx: Prisma.TransactionClient,
    load: {
      id: string;
      vaultId: string;
      brandProfileId: string;
      idempotencyKey: string | null;
      principalAmount: Decimal;
      processingFee: Decimal;
      processingFeeTax: Decimal;
      currency: string;
      state: string;
    },
  ): Promise<void> {
    if (!load.idempotencyKey) return;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`escrow-ledger:${load.id}`}))::text`;
    const principal = await tx.escrowTransactionLedger.upsert({
      where: { idempotencyKey: `load:${load.idempotencyKey}` },
      create: {
        vaultId: load.vaultId,
        brandProfileId: load.brandProfileId,
        transactionType: "LOAD",
        amount: load.principalAmount,
        currency: load.currency,
        idempotencyKey: `load:${load.idempotencyKey}`,
        transactionStatus: load.state === "CREDITED" ? "CREDITED" : "PENDING",
      },
      update: {},
    });
    if (
      load.state === "CREDITED" &&
      principal.transactionStatus !== "CREDITED"
    ) {
      await tx.escrowTransactionLedger.update({
        where: { id: principal.id },
        data: { transactionStatus: "CREDITED" },
      });
    }
    if (load.processingFee.add(load.processingFeeTax).greaterThan(0)) {
      const fee = await tx.escrowTransactionLedger.upsert({
        where: { idempotencyKey: `load-fee:${load.idempotencyKey}` },
        create: {
          vaultId: load.vaultId,
          brandProfileId: load.brandProfileId,
          transactionType: "LOAD_FEE",
          amount: load.processingFee.add(load.processingFeeTax),
          currency: load.currency,
          gatewayProcessingSurcharge: load.processingFee,
          gatewaySurchargeGst: load.processingFeeTax,
          idempotencyKey: `load-fee:${load.idempotencyKey}`,
          transactionStatus: load.state === "CREDITED" ? "CREDITED" : "PENDING",
        },
        update: {},
      });
      if (load.state === "CREDITED" && fee.transactionStatus !== "CREDITED") {
        await tx.escrowTransactionLedger.update({
          where: { id: fee.id },
          data: { transactionStatus: "CREDITED" },
        });
      }
    }
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
      await tx.$queryRaw`SELECT vault_id FROM brand_escrow_vaults WHERE vault_id = ${vault.id} FOR UPDATE`;
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
      const load = await tx.escrowFundingLoad.create({
        data: {
          vaultId: vault.id,
          brandProfileId: vault.brandProfileId,
          sourceType: "VIRTUAL_ACCOUNT",
          currency,
          principalAmount: principal,
          creditedPrincipal: principal,
          capturedAmount: principal,
          paymentCurrency: currency,
          paymentCaptured: null,
          provenanceStatus: "PROVEN_SOURCE",
          state: "CREDITED",
          providerPaymentId: paymentId,
          providerCreditId: paymentId,
          sourceReference: paymentId,
          creditedAt: new Date(),
        },
      });
      await this.attribution.recordFundingCredit(tx, {
        loadId: load.id,
        vaultId: vault.id,
        brandProfileId: vault.brandProfileId,
        sourceType: "VIRTUAL_ACCOUNT",
        currency,
        requestedPrincipal: principal,
        creditedPrincipal: principal,
        capturedAmount: principal,
        providerPaymentId: paymentId,
        providerPaymentCaptured: null,
        provenanceStatus: "PROVEN_SOURCE",
        provenanceDiagnostic: {
          validation: "VIRTUAL_ACCOUNT_CREDIT_RECORDED",
          return_provider_capability: "DISABLED",
        },
        creditedAt: load.creditedAt ?? new Date(),
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
      await this.notifications?.enqueueWithinTransaction(tx, {
        workspaceId: vault.brandProfileId,
        eventType: "escrow.funding_credited",
        source: {
          sourceType: "escrow_funding_load",
          sourceId: load.id,
          transitionId: "credited",
        },
        payload: { funding_load_id: load.id },
      });
    });
  }

  private note(
    entity: Record<string, unknown> | undefined,
    key: string,
  ): string | undefined {
    const notes = entity?.notes as Record<string, unknown> | undefined;
    return typeof notes?.[key] === "string" ? notes[key] : undefined;
  }
}
