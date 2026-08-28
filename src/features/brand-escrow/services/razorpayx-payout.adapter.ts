import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type RazorpayXPayout = { id: string; status: string };

@Injectable()
export class RazorpayXPayoutAdapter {
  constructor(private readonly config: ConfigService) {}

  assertConfigured(): void {
    if (
      !this.config.get<string>("RAZORPAY_API_KEY_ID", "") ||
      !this.config.get<string>("RAZORPAY_API_KEY_SECRET", "") ||
      !this.config.get<string>("RAZORPAYX_DEBIT_ACCOUNT_NUMBER", "")
    )
      throw new ServiceUnavailableException(
        "RazorpayX payout configuration is incomplete",
      );
  }

  async createContact(input: { name: string; referenceId: string }) {
    return this.post<{ id: string }>("contacts", {
      name: input.name,
      type: "vendor",
      reference_id: input.referenceId,
    });
  }

  async createFundAccount(input: {
    contactId: string;
    name: string;
    accountNumber: string;
    ifsc: string;
  }) {
    return this.post<{ id: string }>("fund_accounts", {
      contact_id: input.contactId,
      account_type: "bank_account",
      bank_account: {
        name: input.name,
        account_number: input.accountNumber,
        ifsc: input.ifsc,
      },
    });
  }

  async createPayout(input: {
    fundAccountId: string;
    amountPaise: number;
    idempotencyKey: string;
    referenceId: string;
  }): Promise<RazorpayXPayout> {
    const accountNumber = this.config.get<string>(
      "RAZORPAYX_DEBIT_ACCOUNT_NUMBER",
      "",
    );
    if (!accountNumber)
      throw new ServiceUnavailableException(
        "RazorpayX debit account is not configured",
      );
    const mode = this.config.get<string>("RAZORPAYX_PAYOUT_MODE", "IMPS");
    return this.post<RazorpayXPayout>(
      "payouts",
      {
        account_number: accountNumber,
        fund_account_id: input.fundAccountId,
        amount: input.amountPaise,
        currency: "INR",
        mode,
        purpose: "payout",
        queue_if_low_balance: false,
        reference_id: input.referenceId,
        narration: "Creator Shop collaboration payout",
      },
      input.idempotencyKey,
    );
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    payoutIdempotency?: string,
  ): Promise<T> {
    const key = this.config.get<string>("RAZORPAY_API_KEY_ID", "");
    const secret = this.config.get<string>("RAZORPAY_API_KEY_SECRET", "");
    if (!key || !secret)
      throw new ServiceUnavailableException(
        "RazorpayX credentials are not configured",
      );
    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
          "Content-Type": "application/json",
          ...(payoutIdempotency
            ? { "X-Payout-Idempotency": payoutIdempotency }
            : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as T & {
        error?: { description?: string };
      };
      if (!response.ok)
        throw new BadRequestException(
          payload.error?.description ??
            `RazorpayX request failed (${response.status})`,
        );
      return payload;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException(
        "RazorpayX request was inconclusive",
      );
    }
  }
}
