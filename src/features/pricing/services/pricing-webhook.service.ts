import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SubscriptionStatus, SubscriptionTier } from "@prisma/client";
import { createHmac } from "crypto";

import { PrismaService } from "../../../prisma/prisma.service";
import { CYCLIC_FEATURE_KEYS } from "../constants/subscription.constants";
import type { RazorpaySubscriptionNotes } from "../types/razorpay-plan.types";
import { PricingInvoiceService } from "./pricing-invoice.service";
import { PricingRazorpayClient } from "./pricing-razorpay.client";
import { RazorpayPlanProvisioningService } from "./razorpay-plan-provisioning.service";

interface RazorpaySubscriptionWebhookPayload {
  event: string;
  payload: {
    subscription?: {
      entity: {
        id: string;
        current_start?: number;
        current_end?: number;
        plan_id?: string;
        status?: string;
        created_at?: number;
        notes?: RazorpaySubscriptionNotes;
      };
    };
    payment?: {
      entity: {
        id: string;
        invoice_id?: string | null;
        created_at?: number;
      };
    };
    invoice?: {
      entity: {
        id: string;
        subscription_id?: string | null;
        created_at?: number;
      };
    };
  };
}

@Injectable()
export class PricingWebhookService {
  private readonly logger = new Logger(PricingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invoices: PricingInvoiceService,
    private readonly razorpay: PricingRazorpayClient,
    private readonly planProvisioning: RazorpayPlanProvisioningService,
  ) {}

  verifySignature(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): void {
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
    const payload = rawPayload as RazorpaySubscriptionWebhookPayload;

    switch (payload.event) {
      case "subscription.authenticated": {
        const subscriptionId = payload.payload?.subscription?.entity?.id;
        if (!subscriptionId) {
          return;
        }
        await this.prisma.brandSubscription.updateMany({
          where: { razorpaySubscriptionId: subscriptionId },
          data: { providerStatus: "authenticated" },
        });
        return;
      }
      case "subscription.charged": {
        const entityData = payload.payload?.subscription?.entity;
        if (!entityData?.id) {
          this.logger.warn(
            `Ignored subscription webhook event: ${payload.event}`,
          );
          return;
        }
        await this.processCyclePaymentSuccess(
          entityData.id,
          entityData,
          payload,
        );
        return;
      }
      case "invoice.paid": {
        await this.processInvoicePaid(payload);
        return;
      }
      case "subscription.activated": {
        const entityData = payload.payload?.subscription?.entity;
        if (!entityData?.id) {
          return;
        }
        await this.finalizeSubscriptionBilling(entityData.id, entityData);
        return;
      }
      case "subscription.updated": {
        const entityData = payload.payload?.subscription?.entity;
        if (!entityData?.id) {
          return;
        }
        if (entityData.plan_id || entityData.status) {
          await this.prisma.brandSubscription.updateMany({
            where: { razorpaySubscriptionId: entityData.id },
            data: {
              razorpayPlanId: entityData.plan_id,
              providerStatus: entityData.status,
            },
          });
        }
        return;
      }
      case "subscription.pending": {
        const subscriptionId = payload.payload?.subscription?.entity?.id;
        if (!subscriptionId) {
          return;
        }
        await this.prisma.brandSubscription.updateMany({
          where: { razorpaySubscriptionId: subscriptionId },
          data: { providerStatus: "pending" },
        });
        return;
      }
      case "subscription.halted": {
        const subscriptionId = payload.payload?.subscription?.entity?.id;
        if (!subscriptionId) {
          return;
        }
        await this.processProviderHalted(subscriptionId, payload);
        return;
      }
      case "payment.failed":
      case "invoice.payment_failed": {
        await this.processPaymentFailure(payload);
        return;
      }
      case "subscription.cancelled": {
        const subscriptionId = payload.payload?.subscription?.entity?.id;
        if (!subscriptionId) {
          return;
        }
        await this.processSubscriptionCancelled(subscriptionId);
        return;
      }
      default:
        this.logger.debug(`Unhandled subscription webhook: ${payload.event}`);
    }
  }

  private async updateSubscriptionStatus(
    razorpaySubscriptionId: string,
    targetStatus: SubscriptionStatus,
  ) {
    const existing = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });
    if (!existing) {
      this.logger.debug(
        `Ignored status ${targetStatus} for unknown Razorpay subscription ${razorpaySubscriptionId}`,
      );
      return;
    }

    const updated = await this.prisma.brandSubscription.update({
      where: { razorpaySubscriptionId },
      data: {
        status: targetStatus,
        providerStatus:
          targetStatus === SubscriptionStatus.CANCELED
            ? "cancelled"
            : undefined,
      },
    });

    await this.prisma.brandProfile.update({
      where: { id: updated.brandProfileId },
      data: { subscriptionStatus: targetStatus },
    });
  }

  private async processProviderHalted(
    razorpaySubscriptionId: string,
    payload: RazorpaySubscriptionWebhookPayload,
  ): Promise<void> {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });
    if (!subscription) {
      return;
    }

    if (
      subscription.status === SubscriptionStatus.CANCEL_SCHEDULED &&
      subscription.cancelEffectiveAt !== null &&
      subscription.cancelEffectiveAt > new Date()
    ) {
      await this.prisma.brandSubscription.update({
        where: { razorpaySubscriptionId },
        data: { providerStatus: "halted" },
      });
      return;
    }

    if (
      subscription.status === SubscriptionStatus.TRIALING ||
      subscription.status === SubscriptionStatus.TRIAL_EXPIRED ||
      subscription.status === SubscriptionStatus.CANCELED ||
      subscription.status === SubscriptionStatus.HALTED
    ) {
      await this.prisma.brandSubscription.update({
        where: { razorpaySubscriptionId },
        data: { providerStatus: "halted" },
      });
      return;
    }

    await this.recordPaymentFailure(
      razorpaySubscriptionId,
      this.resolveEventTime(payload),
      "halted",
    );
  }

  private async processSubscriptionCancelled(razorpaySubscriptionId: string) {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });
    if (!subscription) {
      this.logger.debug(
        `Ignored subscription.cancelled for unknown Razorpay subscription ${razorpaySubscriptionId}`,
      );
      return;
    }

    if (
      subscription.status === SubscriptionStatus.CANCEL_SCHEDULED &&
      subscription.cancelEffectiveAt !== null &&
      subscription.cancelEffectiveAt > new Date()
    ) {
      await this.prisma.brandSubscription.update({
        where: { razorpaySubscriptionId },
        data: { providerStatus: "cancelled" },
      });
      return;
    }

    const foundersTrialStillOpen =
      subscription.tier === SubscriptionTier.FOUNDERS_BETA &&
      subscription.trialEndsAt !== null &&
      subscription.trialEndsAt.getTime() > Date.now();

    if (foundersTrialStillOpen) {
      const restored = await this.prisma.brandSubscription.update({
        where: { brandProfileId: subscription.brandProfileId },
        data: {
          status: SubscriptionStatus.TRIALING,
          razorpaySubscriptionId: null,
          razorpayPlanId: null,
          providerStatus: "cancelled",
        },
      });

      await this.prisma.brandProfile.update({
        where: { id: subscription.brandProfileId },
        data: { subscriptionStatus: SubscriptionStatus.TRIALING },
      });

      this.logger.log(
        `Restored Founder's trial after cancelled checkout for brand ${subscription.brandProfileId}`,
      );
      return;
    }

    await this.updateSubscriptionStatus(
      razorpaySubscriptionId,
      SubscriptionStatus.CANCELED,
    );
  }

  private parseTargetTierFromNotes(
    notes?: RazorpaySubscriptionNotes,
  ): SubscriptionTier | null {
    const value = notes?.target_tier;
    if (!value) {
      return null;
    }
    if (Object.values(SubscriptionTier).includes(value as SubscriptionTier)) {
      return value as SubscriptionTier;
    }
    return null;
  }

  private resolveTierFromRazorpayEntity(entityData: {
    plan_id?: string;
    notes?: RazorpaySubscriptionNotes;
  }): SubscriptionTier | null {
    const tierFromNotes = this.parseTargetTierFromNotes(entityData.notes);
    if (tierFromNotes) {
      return tierFromNotes;
    }
    if (!entityData.plan_id) {
      return null;
    }
    return this.planProvisioning.resolveTierForPlanId(entityData.plan_id);
  }

  private async finalizeSubscriptionBilling(
    razorpaySubscriptionId: string,
    entityData: {
      current_start?: number;
      current_end?: number;
      plan_id?: string;
      status?: string;
      notes?: RazorpaySubscriptionNotes;
    },
  ) {
    const existing = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });
    if (!existing) {
      return;
    }

    let resolvedEntity = entityData;
    if (
      !entityData.current_start ||
      !entityData.current_end ||
      (!entityData.notes?.target_tier && !entityData.plan_id)
    ) {
      const fetched = await this.razorpay.fetchSubscription(
        razorpaySubscriptionId,
      );
      resolvedEntity = {
        current_start: entityData.current_start ?? fetched.current_start,
        current_end: entityData.current_end ?? fetched.current_end,
        plan_id: entityData.plan_id ?? fetched.plan_id,
        status: entityData.status ?? fetched.status,
        notes: entityData.notes ?? fetched.notes,
      };
    }

    const resolvedTier =
      this.resolveTierFromRazorpayEntity(resolvedEntity) ?? existing.tier;
    if (resolvedTier !== SubscriptionTier.FOUNDERS_BETA) {
      this.logger.warn(
        `Ignored paid activation for non-MVP tier ${resolvedTier} on ${razorpaySubscriptionId}`,
      );
      return;
    }
    if (
      !resolvedEntity.current_start ||
      !resolvedEntity.current_end ||
      resolvedEntity.current_end <= resolvedEntity.current_start
    ) {
      this.logger.warn(
        `Ignored paid activation without trustworthy billing period for ${razorpaySubscriptionId}`,
      );
      return;
    }

    const periodStart = new Date(resolvedEntity.current_start * 1000);
    const periodEnd = new Date(resolvedEntity.current_end * 1000);
    const cancellationStillScheduled =
      existing.status === SubscriptionStatus.CANCEL_SCHEDULED &&
      existing.cancelEffectiveAt !== null &&
      existing.cancelEffectiveAt > new Date() &&
      existing.providerStatus !== "reactivation_pending";
    const productStatus = cancellationStillScheduled
      ? SubscriptionStatus.CANCEL_SCHEDULED
      : SubscriptionStatus.ACTIVE;

    const subscription = await this.prisma.brandSubscription.update({
      where: { razorpaySubscriptionId },
      data: {
        status: productStatus,
        tier: SubscriptionTier.FOUNDERS_BETA,
        razorpayPlanId: resolvedEntity.plan_id ?? existing.razorpayPlanId,
        providerStatus: resolvedEntity.status ?? "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
        firstPaymentFailureAt: null,
        paymentGraceEndsAt: null,
        cancelScheduledAt: cancellationStillScheduled
          ? existing.cancelScheduledAt
          : null,
        cancelEffectiveAt: cancellationStillScheduled
          ? existing.cancelEffectiveAt
          : null,
      },
    });

    await this.prisma.brandProfile.update({
      where: { id: subscription.brandProfileId },
      data: {
        subscriptionStatus: productStatus,
        planType: this.mapTierToLegacyPlanType(SubscriptionTier.FOUNDERS_BETA),
        trialEndsAt: null,
      },
    });
  }

  private mapTierToLegacyPlanType(
    tier: SubscriptionTier,
  ): "FREE_TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE" {
    const planTypeMap: Record<
      SubscriptionTier,
      "FREE_TRIAL" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
    > = {
      FOUNDERS_BETA: "FREE_TRIAL",
      GROWTH_STARTER: "STARTER",
      PROFESSIONAL: "PROFESSIONAL",
      ENTERPRISE: "ENTERPRISE",
    };
    return planTypeMap[tier];
  }

  private async processCyclePaymentSuccess(
    razorpaySubscriptionId: string,
    entityData: {
      current_start?: number;
      current_end?: number;
      plan_id?: string;
      status?: string;
      notes?: RazorpaySubscriptionNotes;
    },
    payload: RazorpaySubscriptionWebhookPayload,
  ) {
    await this.finalizeSubscriptionBilling(razorpaySubscriptionId, entityData);

    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });
    if (!subscription) {
      return;
    }

    const periodEnd = entityData.current_end
      ? new Date(entityData.current_end * 1000)
      : subscription.currentPeriodEnd;

    await this.prisma.featureUsage.updateMany({
      where: {
        subscriptionId: subscription.id,
        featureKey: { in: [...CYCLIC_FEATURE_KEYS] },
      },
      data: {
        currentUsageCount: 0,
        resetAt: periodEnd,
      },
    });

    const invoiceId =
      payload.payload?.payment?.entity?.invoice_id ??
      payload.payload?.invoice?.entity?.id;

    if (invoiceId) {
      await this.invoices.upsertFromRazorpayInvoiceId(
        subscription.brandProfileId,
        subscription.id,
        razorpaySubscriptionId,
        invoiceId,
        payload.payload?.payment?.entity?.id,
        subscription.currency,
      );
    }
  }

  private async processPaymentFailure(
    payload: RazorpaySubscriptionWebhookPayload,
  ) {
    let subscriptionId =
      payload.payload?.subscription?.entity?.id ??
      payload.payload?.invoice?.entity?.subscription_id ??
      null;

    const invoiceId = payload.payload?.payment?.entity?.invoice_id;
    if (!subscriptionId && invoiceId) {
      const invoice = await this.razorpay.fetchInvoice(invoiceId);
      subscriptionId = invoice.subscription_id ?? null;
    }

    if (!subscriptionId) {
      this.logger.warn(
        `Ignored ${payload.event}: no subscription id on payment failure payload`,
      );
      return;
    }

    await this.recordPaymentFailure(
      subscriptionId,
      this.resolveEventTime(payload),
    );
  }

  private async recordPaymentFailure(
    razorpaySubscriptionId: string,
    failedAt: Date,
    providerStatus = "payment_failed",
  ): Promise<void> {
    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });
    if (!subscription) {
      return;
    }
    if (
      subscription.status === SubscriptionStatus.TRIALING ||
      subscription.status === SubscriptionStatus.TRIAL_EXPIRED ||
      subscription.status === SubscriptionStatus.CANCELED ||
      subscription.status === SubscriptionStatus.HALTED ||
      subscription.status === SubscriptionStatus.CANCEL_SCHEDULED
    ) {
      await this.prisma.brandSubscription.update({
        where: { razorpaySubscriptionId },
        data: { providerStatus },
      });
      return;
    }

    const firstFailureAt = subscription.firstPaymentFailureAt ?? failedAt;
    const graceEndsAt =
      subscription.paymentGraceEndsAt ??
      new Date(firstFailureAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.brandSubscription.update({
      where: { razorpaySubscriptionId },
      data: {
        status: SubscriptionStatus.PAST_DUE,
        providerStatus,
        firstPaymentFailureAt: firstFailureAt,
        paymentGraceEndsAt: graceEndsAt,
      },
    });
    await this.prisma.brandProfile.update({
      where: { id: updated.brandProfileId },
      data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
    });
  }

  private resolveEventTime(payload: RazorpaySubscriptionWebhookPayload): Date {
    const epoch =
      payload.payload?.payment?.entity?.created_at ??
      payload.payload?.invoice?.entity?.created_at ??
      payload.payload?.subscription?.entity?.created_at;
    return epoch ? new Date(epoch * 1000) : new Date();
  }

  private async processInvoicePaid(
    payload: RazorpaySubscriptionWebhookPayload,
  ) {
    const invoiceEntity = payload.payload?.invoice?.entity;
    if (!invoiceEntity?.id) {
      this.logger.warn("invoice.paid webhook missing invoice entity");
      return;
    }

    const razorpaySubscriptionId = invoiceEntity.subscription_id;
    if (!razorpaySubscriptionId) {
      this.logger.warn(
        `invoice.paid ${invoiceEntity.id} has no subscription_id`,
      );
      return;
    }

    const subscription = await this.prisma.brandSubscription.findUnique({
      where: { razorpaySubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `invoice.paid for unknown subscription ${razorpaySubscriptionId}`,
      );
      return;
    }

    const providerSubscription = await this.razorpay.fetchSubscription(
      razorpaySubscriptionId,
    );
    await this.finalizeSubscriptionBilling(
      razorpaySubscriptionId,
      providerSubscription,
    );

    await this.invoices.upsertFromRazorpayInvoiceId(
      subscription.brandProfileId,
      subscription.id,
      razorpaySubscriptionId,
      invoiceEntity.id,
      payload.payload?.payment?.entity?.id,
      subscription.currency,
    );
  }
}
