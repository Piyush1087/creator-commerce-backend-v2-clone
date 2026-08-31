import { Prisma } from "@prisma/client";
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { BrandReturnWebhookEventParser } from "./brand-return-webhook-event.parser";
import { BrandReturnWebhookService } from "./brand-return-webhook.service";

const mapping = JSON.stringify({
  eventTypePath: "kind",
  events: {
    verified_success_event: {
      outcome: "SUCCEEDED",
      refundIdPath: "object.refundReference",
      providerStatePath: "object.state",
    },
  },
});

function config(values: Record<string, string>) {
  return {
    get: vi.fn((key: string, fallback: string) => values[key] ?? fallback),
  };
}

describe("BS04 configurable refund webhook seam", () => {
  it("fails closed when no verified event mapping is configured", () => {
    const parser = new BrandReturnWebhookEventParser(
      config({ RAZORPAY_BRAND_RETURN_WEBHOOK_EVENT_MAP: "{}" }) as never,
    );
    expect(parser.parse({ kind: "anything" })).toEqual({ kind: "UNKNOWN" });
  });

  it("normalizes only explicitly configured paths and event names", () => {
    const parser = new BrandReturnWebhookEventParser(
      config({ RAZORPAY_BRAND_RETURN_WEBHOOK_EVENT_MAP: mapping }) as never,
    );
    expect(
      parser.parse({
        kind: "verified_success_event",
        object: { refundReference: "refund-1", state: "provider-confirmed" },
      }),
    ).toEqual({
      kind: "SUCCEEDED",
      rawEventType: "verified_success_event",
      providerRefundId: "refund-1",
      providerState: "provider-confirmed",
    });
    expect(parser.parse({ kind: "unverified_event" })).toEqual({
      kind: "UNKNOWN",
    });
  });

  it("uses a dedicated secret and suppresses exact webhook replay", async () => {
    const secret = "brand-return-test-secret";
    const values = {
      RAZORPAY_BRAND_RETURN_WEBHOOK_SECRET: secret,
      RAZORPAY_BRAND_RETURN_WEBHOOK_EVENT_MAP: mapping,
    };
    const cfg = config(values);
    const parser = new BrandReturnWebhookEventParser(cfg as never);
    const replay = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
    });
    const receiptCreate = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(replay);
    const reconcileProviderRefund = vi.fn().mockResolvedValue(undefined);
    const service = new BrandReturnWebhookService(
      {
        brandReturnWebhookReceipt: {
          create: receiptCreate,
          delete: vi.fn(),
        },
      } as never,
      cfg as never,
      parser,
      { reconcileProviderRefund } as never,
    );
    const raw = Buffer.from(
      JSON.stringify({
        kind: "verified_success_event",
        object: { refundReference: "refund-1", state: "confirmed" },
      }),
    );
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    service.verifySignature(raw, signature);
    const payload = JSON.parse(raw.toString()) as Record<string, unknown>;
    await service.handle(raw, payload);
    await service.handle(raw, payload);
    expect(reconcileProviderRefund).toHaveBeenCalledTimes(1);
  });
});
