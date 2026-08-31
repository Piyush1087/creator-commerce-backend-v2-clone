import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { RazorpayPlanDefinition } from "../constants/subscription.constants";
import type {
  RazorpayInvoiceCollection,
  RazorpayInvoiceEntity,
} from "../types/razorpay-invoice.types";
import type {
  RazorpayPlanCollection,
  RazorpayPlanEntity,
  RazorpaySubscriptionNotes,
} from "../types/razorpay-plan.types";

interface RazorpaySubscriptionResponse {
  id: string;
  plan_id?: string;
  customer_id?: string;
  status?: string;
  current_start?: number;
  current_end?: number;
}

export type RazorpaySubscriptionEntity = RazorpaySubscriptionResponse & {
  status: string;
  notes?: RazorpaySubscriptionNotes;
};

@Injectable()
export class PricingRazorpayClient {
  private readonly apiKeyId: string;
  private readonly apiKeySecret: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKeyId = this.config.get<string>("RAZORPAY_API_KEY_ID", "");
    this.apiKeySecret = this.config.get<string>("RAZORPAY_API_KEY_SECRET", "");
    this.timeoutMs = this.config.get<number>("EXTERNAL_API_TIMEOUT_MS", 10_000);
  }

  private get authHeader(): string {
    if (!this.apiKeyId || !this.apiKeySecret) {
      throw new ServiceUnavailableException(
        "Razorpay API credentials are not configured",
      );
    }
    return `Basic ${Buffer.from(`${this.apiKeyId}:${this.apiKeySecret}`).toString("base64")}`;
  }

  private async getJsonOptional<T>(
    path: string,
  ): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
        },
        signal: controller.signal,
      });

      const payload = (await response.json()) as T & {
        error?: { description?: string };
      };

      if (!response.ok) {
        return { ok: false, status: response.status };
      }

      return { ok: true, data: payload };
    } catch {
      return { ok: false, status: 0 };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: "GET",
        headers: {
          Authorization: this.authHeader,
        },
        signal: controller.signal,
      });

      const payload = (await response.json()) as T & {
        error?: { description?: string };
      };

      if (!response.ok) {
        throw new BadRequestException(
          payload.error?.description ??
            `Razorpay request failed with status ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        "Payment gateway handshake failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(
    method: "POST" | "PATCH",
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = (await response.json()) as T & {
        error?: { description?: string };
      };

      if (!response.ok) {
        throw new BadRequestException(
          payload.error?.description ??
            `Razorpay request failed with status ${response.status}`,
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        "Payment gateway handshake failed",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async planExists(planId: string): Promise<boolean> {
    const result = await this.getJsonOptional<RazorpayPlanEntity>(`plans/${planId}`);
    return result.ok;
  }

  async findPlanByBillingSignature(
    definition: RazorpayPlanDefinition,
  ): Promise<string | null> {
    const collection = await this.getJson<RazorpayPlanCollection>("plans?count=100");
    const match = (collection.items ?? []).find(
      (plan) =>
        plan.item?.name === definition.name &&
        plan.item?.currency === definition.currency &&
        plan.item?.amount === definition.amountMinor,
    );
    return match?.id ?? null;
  }

  async createSubscriptionPlan(
    definition: RazorpayPlanDefinition,
  ): Promise<RazorpayPlanEntity> {
    return this.request<RazorpayPlanEntity>("POST", "plans", {
      period: "monthly",
      interval: 1,
      item: {
        name: definition.name,
        amount: definition.amountMinor,
        currency: definition.currency,
        description: definition.description,
      },
    });
  }

  async fetchSubscription(
    razorpaySubscriptionId: string,
  ): Promise<RazorpaySubscriptionEntity> {
    return this.getJson<RazorpaySubscriptionEntity>(
      `subscriptions/${razorpaySubscriptionId}`,
    );
  }

  async createDeferredTrialSubscription(
    planId: string,
    startAtEpochSeconds: number,
  ): Promise<RazorpaySubscriptionResponse> {
    return this.createFutureSubscription(planId, startAtEpochSeconds);
  }

  async createFutureSubscription(
    planId: string,
    startAtEpochSeconds: number,
    notes?: RazorpaySubscriptionNotes,
  ): Promise<RazorpaySubscriptionResponse> {
    return this.request<RazorpaySubscriptionResponse>("POST", "subscriptions", {
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      start_at: startAtEpochSeconds,
      customer_notify: 1,
      ...(notes ? { notes } : {}),
    });
  }

  async createImmediateSubscription(
    planId: string,
    notes?: RazorpaySubscriptionNotes,
  ): Promise<RazorpaySubscriptionResponse> {
    return this.request<RazorpaySubscriptionResponse>("POST", "subscriptions", {
      plan_id: planId,
      total_count: 120,
      quantity: 1,
      customer_notify: 1,
      ...(notes ? { notes } : {}),
    });
  }

  async resumeSubscription(
    razorpaySubscriptionId: string,
  ): Promise<RazorpaySubscriptionResponse> {
    return this.request<RazorpaySubscriptionResponse>(
      "POST",
      `subscriptions/${razorpaySubscriptionId}/resume`,
      {},
    );
  }

  async changeSubscriptionPlan(
    razorpaySubscriptionId: string,
    planId: string,
  ): Promise<RazorpaySubscriptionResponse> {
    return this.request<RazorpaySubscriptionResponse>(
      "PATCH",
      `subscriptions/${razorpaySubscriptionId}`,
      {
        plan_id: planId,
        schedule_change_at: "now",
      },
    );
  }

  async cancelSubscription(
    razorpaySubscriptionId: string,
    cancelAtCycleEnd = false,
  ): Promise<RazorpaySubscriptionResponse> {
    return this.request<RazorpaySubscriptionResponse>(
      "POST",
      `subscriptions/${razorpaySubscriptionId}/cancel`,
      {
        cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
      },
    );
  }

  async fetchInvoice(razorpayInvoiceId: string): Promise<RazorpayInvoiceEntity> {
    return this.getJson<RazorpayInvoiceEntity>(`invoices/${razorpayInvoiceId}`);
  }

  async listSubscriptionInvoices(
    razorpaySubscriptionId: string,
  ): Promise<RazorpayInvoiceEntity[]> {
    const collection = await this.getJson<RazorpayInvoiceCollection>(
      `invoices?subscription_id=${encodeURIComponent(razorpaySubscriptionId)}`,
    );
    return collection.items ?? [];
  }
}
