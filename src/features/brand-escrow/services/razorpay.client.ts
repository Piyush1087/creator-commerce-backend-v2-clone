import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface RazorpayReceiver {
  entity: string;
  account_number?: string;
  ifsc?: string;
  bank_name?: string;
  address?: string;
}

interface RazorpayVirtualAccountResponse {
  id: string;
  receivers?: RazorpayReceiver[];
}

interface RazorpayOrderResponse {
  id: string;
}

@Injectable()
export class RazorpayClient {
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

  private async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: "POST",
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

  async createVirtualAccount(params: {
    description: string;
    customerId?: string;
  }): Promise<RazorpayVirtualAccountResponse> {
    return this.postJson<RazorpayVirtualAccountResponse>("virtual_accounts", {
      receivers: {
        types: ["bank_account", "vpa"],
      },
      description: params.description,
      ...(params.customerId ? { customer_id: params.customerId } : {}),
    });
  }

  async createOrder(params: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<RazorpayOrderResponse> {
    return this.postJson<RazorpayOrderResponse>("orders", {
      amount: params.amountPaise,
      currency: params.currency,
      receipt: params.receipt,
      payment_capture: 1,
      notes: params.notes,
    });
  }

  async capturePayment(paymentId: string, amountPaise: number): Promise<void> {
    await this.postJson(`payments/${paymentId}/capture`, {
      amount: amountPaise,
    });
  }
}

export function extractBankReceiver(
  receivers: RazorpayReceiver[] | undefined,
): RazorpayReceiver {
  const bankAccount = receivers?.find((receiver) => receiver.entity === "bank_account");
  if (!bankAccount?.account_number || !bankAccount.ifsc) {
    throw new BadRequestException(
      "Partner gateway did not return virtual account bank routing details",
    );
  }
  return bankAccount;
}

export function extractVpaReceiver(
  receivers: RazorpayReceiver[] | undefined,
): string | null {
  const vpa = receivers?.find((receiver) => receiver.entity === "vpa");
  return vpa?.address ?? null;
}
