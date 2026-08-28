import { ServiceUnavailableException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RazorpayXPayoutAdapter } from "./razorpayx-payout.adapter";

describe("RazorpayX payout adapter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses authoritative INR payout fields and mandatory idempotency", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "pout_1", status: "processing" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const config = {
      get: (key: string, fallback: unknown) =>
        ({
          RAZORPAY_API_KEY_ID: "key",
          RAZORPAY_API_KEY_SECRET: "secret",
          RAZORPAYX_DEBIT_ACCOUNT_NUMBER: "123456",
          RAZORPAYX_PAYOUT_MODE: "IMPS",
        })[key] ?? fallback,
    };
    const adapter = new RazorpayXPayoutAdapter(config as never);
    adapter.assertConfigured();

    await adapter.createPayout({
      fundAccountId: "fa_1",
      amountPaise: 2000000,
      idempotencyKey: "attempt-key",
      referenceId: "logical-payout-1",
    });

    const request = fetchMock.mock.calls[0][1];
    expect(request.headers["X-Payout-Idempotency"]).toBe("attempt-key");
    expect(JSON.parse(request.body)).toMatchObject({
      account_number: "123456",
      fund_account_id: "fa_1",
      amount: 2000000,
      currency: "INR",
      mode: "IMPS",
      purpose: "payout",
      queue_if_low_balance: false,
      reference_id: "logical-payout-1",
    });
  });

  it("fails closed before a provider call when payout config is incomplete", () => {
    const adapter = new RazorpayXPayoutAdapter({
      get: (_key: string, fallback: unknown) => fallback,
    } as never);
    expect(() => adapter.assertConfigured()).toThrow(
      ServiceUnavailableException,
    );
  });
});
