import { describe, expect, it } from "vitest";

import { NOTIFICATION_EVENT_REGISTRY } from "./notification-event-registry";
import {
  buildNotificationEmailCopy,
  notificationPostmarkMetadata,
  notificationPostmarkTag,
} from "./notification-email-copy";
import type { NotificationEventType } from "../types/notifications.types";

describe("notification email copy", () => {
  it("covers every registered event with human copy, not the event type", () => {
    for (const eventType of Object.keys(
      NOTIFICATION_EVENT_REGISTRY,
    ) as NotificationEventType[]) {
      const copy = buildNotificationEmailCopy(eventType);
      expect(copy.title).toBe(NOTIFICATION_EVENT_REGISTRY[eventType].title);
      expect(copy.body.length).toBeGreaterThan(20);
      expect(copy.body).not.toContain(eventType);
      expect(copy.body.toLowerCase()).not.toContain(
        "you have a new notification",
      );
    }
  });

  it("adds payload detail only for known variants", () => {
    expect(
      buildNotificationEmailCopy("intelligence.execution_completed", {
        aggregate_result: "PARTIAL",
      }).body,
    ).toContain("partial results");
    expect(
      buildNotificationEmailCopy("escrow.creator_payout_action_required", {
        reason: "PROVIDER_SETUP_REQUIRED",
      }).body,
    ).toContain("Razorpay");
    expect(
      buildNotificationEmailCopy("escrow.brand_return_partial", {
        unresolved_amount: 250,
      }).body,
    ).toContain("250");
  });

  it("uses the event type as the Postmark tag and metadata", () => {
    expect(notificationPostmarkTag("billing.trial_expired")).toBe(
      "billing.trial_expired",
    );
    expect(notificationPostmarkMetadata("billing.trial_expired")).toEqual({
      event_type: "billing.trial_expired",
    });
  });
});
