import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { RouteWebhookService } from "./route-webhook.service";

describe("Route webhook security", () => {
  const secret = "synthetic-route-webhook-secret";
  const body = Buffer.from('{"event":"synthetic"}');
  const service = new RouteWebhookService(
    {} as never,
    new ConfigService({ RAZORPAY_ROUTE_WEBHOOK_SECRET: secret }),
    {} as never,
    {} as never,
  );

  it("accepts only the HMAC of the exact raw body", () => {
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(() => service.verifySignature(body, signature)).not.toThrow();
    expect(() =>
      service.verifySignature(Buffer.from("changed"), signature),
    ).toThrow(BadRequestException);
  });

  it("fails closed when the Route-specific secret is absent", () => {
    const unconfigured = new RouteWebhookService(
      {} as never,
      new ConfigService({}),
      {} as never,
      {} as never,
    );
    expect(() => unconfigured.verifySignature(body, "00")).toThrow(
      "Route webhook is not configured",
    );
  });
});
