import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import { RouteWebhookEventParser } from "./route-webhook-event.parser";

describe("Route webhook parser seam", () => {
  it("ignores unconfigured event names", () => {
    const parser = new RouteWebhookEventParser(
      new ConfigService({ RAZORPAY_ROUTE_WEBHOOK_EVENT_MAP: "{}" }),
    );
    expect(parser.parse({ event: "unverified.transfer.event" })).toEqual({
      kind: "UNKNOWN",
      rawEventType: "unverified.transfer.event",
    });
  });

  it("maps a configured synthetic fixture without hard-coded event names", () => {
    const parser = new RouteWebhookEventParser(
      new ConfigService({
        RAZORPAY_ROUTE_WEBHOOK_EVENT_MAP: JSON.stringify({
          "synthetic.transfer.changed": "TRANSFER",
        }),
      }),
    );
    expect(
      parser.parse({
        event: "synthetic.transfer.changed",
        payload: {
          transfer: {
            entity: {
              id: "tr_synthetic",
              status: "processed",
              on_hold: false,
            },
          },
        },
      }),
    ).toMatchObject({
      kind: "TRANSFER",
      objectId: "tr_synthetic",
      providerState: "processed",
      onHold: false,
    });
  });
});
