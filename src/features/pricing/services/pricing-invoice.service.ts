import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import type { RazorpayInvoiceEntity } from "../types/razorpay-invoice.types";
import type { BillingInvoiceView } from "../types/pricing-invoice.types";
import { PricingRazorpayClient } from "./pricing-razorpay.client";

@Injectable()
export class PricingInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: PricingRazorpayClient,
  ) {}

  async listInvoicesForBrand(brandProfileId: string): Promise<BillingInvoiceView[]> {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });

    if (!subscription?.razorpaySubscriptionId) {
      return [];
    }

    const invoices = await this.razorpay.listSubscriptionInvoices(
      subscription.razorpaySubscriptionId,
    );

    return invoices
      .map((invoice) =>
        this.mapRazorpayInvoice(invoice, subscription.currency),
      )
      .sort((left, right) => {
        const leftTime = left.paidAt ?? left.issuedAt ?? "";
        const rightTime = right.paidAt ?? right.issuedAt ?? "";
        return rightTime.localeCompare(leftTime);
      });
  }

  async getInvoiceForBrand(
    brandProfileId: string,
    razorpayInvoiceId: string,
  ): Promise<BillingInvoiceView> {
    const subscription = await this.requireRazorpayBackedSubscription(brandProfileId);
    const invoice = await this.razorpay.fetchInvoice(razorpayInvoiceId);

    if (invoice.subscription_id !== subscription.razorpaySubscriptionId) {
      throw new NotFoundException("Invoice not found for this brand");
    }

    return this.mapRazorpayInvoice(invoice, subscription.currency);
  }

  async resolveInvoiceViewUrl(
    brandProfileId: string,
    razorpayInvoiceId: string,
  ): Promise<string> {
    const invoice = await this.getInvoiceForBrand(brandProfileId, razorpayInvoiceId);
    if (!invoice.shortUrl) {
      throw new NotFoundException("Invoice view link is not available from Razorpay");
    }
    return invoice.shortUrl;
  }

  async upsertFromRazorpayInvoiceId(
    brandProfileId: string,
    brandSubscriptionId: string,
    razorpaySubscriptionId: string,
    razorpayInvoiceId: string,
    razorpayPaymentId?: string | null,
    fallbackCurrency?: string,
  ) {
    const invoice = await this.razorpay.fetchInvoice(razorpayInvoiceId);

    if (invoice.subscription_id && invoice.subscription_id !== razorpaySubscriptionId) {
      throw new BadRequestException(
        "Invoice subscription id does not match the active brand subscription",
      );
    }

    return this.upsertFromRazorpayEntity({
      brandProfileId,
      brandSubscriptionId,
      razorpaySubscriptionId,
      razorpayPaymentId: razorpayPaymentId ?? invoice.payment_id ?? null,
      invoice,
      fallbackCurrency,
    });
  }

  async upsertFromRazorpayEntity(input: {
    brandProfileId: string;
    brandSubscriptionId: string;
    razorpaySubscriptionId: string;
    razorpayPaymentId?: string | null;
    invoice: RazorpayInvoiceEntity;
    fallbackCurrency?: string;
  }) {
    const { invoice } = input;
    const currency =
      invoice.currency && invoice.currency.length > 0
        ? invoice.currency
        : input.fallbackCurrency ?? "USD";

    return this.prisma.brandBillingInvoice.upsert({
      where: { razorpayInvoiceId: invoice.id },
      create: {
        brandProfileId: input.brandProfileId,
        brandSubscriptionId: input.brandSubscriptionId,
        razorpayInvoiceId: invoice.id,
        razorpaySubscriptionId: input.razorpaySubscriptionId,
        razorpayPaymentId: input.razorpayPaymentId ?? invoice.payment_id ?? null,
        shortUrl: invoice.short_url ?? null,
        status: invoice.status ?? "issued",
        amount: invoice.amount ?? 0,
        amountPaid: invoice.amount_paid ?? 0,
        currency,
        invoiceNumber: invoice.invoice_number ?? null,
        paidAt: this.epochToDate(invoice.paid_at),
        billingPeriodStart: this.epochToDate(invoice.billing_start),
        billingPeriodEnd: this.epochToDate(invoice.billing_end),
        issuedAt: this.epochToDate(invoice.issued_at),
      },
      update: {
        razorpayPaymentId: input.razorpayPaymentId ?? invoice.payment_id ?? null,
        shortUrl: invoice.short_url ?? null,
        status: invoice.status ?? "issued",
        amount: invoice.amount ?? 0,
        amountPaid: invoice.amount_paid ?? 0,
        currency,
        invoiceNumber: invoice.invoice_number ?? null,
        paidAt: this.epochToDate(invoice.paid_at),
        billingPeriodStart: this.epochToDate(invoice.billing_start),
        billingPeriodEnd: this.epochToDate(invoice.billing_end),
        issuedAt: this.epochToDate(invoice.issued_at),
      },
    });
  }

  private async requireRazorpayBackedSubscription(brandProfileId: string) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { brandProfileId },
    });

    if (!subscription?.razorpaySubscriptionId) {
      throw new NotFoundException(
        "No Razorpay subscription is linked for this brand",
      );
    }

    return subscription;
  }

  private mapRazorpayInvoice(
    invoice: RazorpayInvoiceEntity,
    fallbackCurrency: string,
  ): BillingInvoiceView {
    const currency =
      invoice.currency && invoice.currency.length > 0
        ? invoice.currency
        : fallbackCurrency;

    return {
      id: invoice.id,
      razorpayInvoiceId: invoice.id,
      razorpayPaymentId: invoice.payment_id ?? null,
      status: invoice.status ?? "issued",
      amount: invoice.amount ?? 0,
      amountPaid: invoice.amount_paid ?? 0,
      currency,
      invoiceNumber: invoice.invoice_number ?? null,
      shortUrl: invoice.short_url ?? null,
      paidAt: this.epochToIso(invoice.paid_at),
      issuedAt: this.epochToIso(invoice.issued_at),
      billingPeriodStart: this.epochToIso(invoice.billing_start),
      billingPeriodEnd: this.epochToIso(invoice.billing_end),
      lineItems: (invoice.line_items ?? []).map((item) => ({
        name: item.name ?? "Subscription charge",
        amount: item.amount ?? 0,
        currency: item.currency && item.currency.length > 0 ? item.currency : currency,
      })),
    };
  }

  private epochToDate(epoch: number | null | undefined): Date | null {
    if (!epoch) {
      return null;
    }
    return new Date(epoch * 1000);
  }

  private epochToIso(epoch: number | null | undefined): string | null {
    const date = this.epochToDate(epoch);
    return date ? date.toISOString() : null;
  }
}
