import { describe, expect, it } from "vitest";
import { BulkNotificationSettingsSchema } from "../brand-settings/schemas/brand-settings.schema";
import { NOTIFICATION_EVENT_REGISTRY } from "./config/notification-event-registry";
import {
  markNotificationReadSchema,
  testEmitNotificationSchema,
} from "./schemas/notifications.schema";

const categories = new Set([
  "BILLING_SUBSCRIPTION",
  "ESCROW_PAYOUTS",
  "CAMPAIGNS_APPLICATIONS",
  "COLLABORATIONS",
  "BRAND_INTELLIGENCE",
  "TEAM_ACCOUNT_INTEGRATIONS",
]);

describe("BS-05 canonical notification policy", () => {
  it("registers only complete immutable canonical policies", () => {
    expect(Object.keys(NOTIFICATION_EVENT_REGISTRY)).toHaveLength(27);
    for (const definition of Object.values(NOTIFICATION_EVENT_REGISTRY)) {
      expect(categories.has(definition.category)).toBe(true);
      expect(["CRITICAL", "ACTION_REQUIRED", "INFORMATIONAL"]).toContain(
        definition.urgencyLevel,
      );
      expect(["MANDATORY", "OPTIONAL", "NONE"]).toContain(
        definition.emailPolicy,
      );
      expect(["REQUIRED", "YES", "NONE"]).toContain(definition.inAppPolicy);
      expect(definition.aggregatable).toBe(false);
      expect(definition.semanticIdentityContract).toBe(
        "SOURCE_TYPE_SOURCE_ID_TRANSITION_ID",
      );
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });

  it("binds launch-path Payouts notices to scoped, redacted policies and safe links", () => {
    expect(
      NOTIFICATION_EVENT_REGISTRY["payouts.reserve_approval_required"],
    ).toMatchObject({
      recipientPolicy: "OWNER_FINANCE",
      inAppPolicy: "REQUIRED",
      emailPolicy: "OPTIONAL",
      deepLinkPath: "/brand/payouts",
    });
    for (const eventType of [
      "payouts.creator_setup_blocking",
      "payouts.provider_action_required",
      "payouts.transfer_failed_or_reconciliation_required",
    ] as const) {
      expect(NOTIFICATION_EVENT_REGISTRY[eventType]).toMatchObject({
        recipientPolicy: "OWNER_FINANCE_PLUS_ACTIVE_TRIGGERING_CM",
        inAppPolicy: "REQUIRED",
        emailPolicy: "OPTIONAL",
        deepLinkPath:
          "/brand/payouts?obligation=payout-obligation:{obligation_id}",
      });
    }
    for (const eventType of [
      "escrow.funding_credited",
      "escrow.brand_return_action_required",
      "escrow.brand_return_partial",
      "escrow.brand_return_completed",
    ] as const) {
      expect(NOTIFICATION_EVENT_REGISTRY[eventType].deepLinkPath).toContain(
        "/brand/payouts",
      );
      expect(NOTIFICATION_EVENT_REGISTRY[eventType].recipientPolicy).toBe(
        "OWNER_FINANCE",
      );
    }
  });

  it("freezes the account revocation email-only exception", () => {
    expect(
      NOTIFICATION_EVENT_REGISTRY["team.member_access_revoked"],
    ).toMatchObject({
      inAppPolicy: "NONE",
      emailPolicy: "MANDATORY",
      recipientPolicy: "AFFECTED_USER_EMAIL_ONLY",
    });
  });

  it("accepts only personal optional-email settings", () => {
    expect(
      BulkNotificationSettingsSchema.parse({
        settings: [{ category: "COLLABORATIONS", optionalEmailEnabled: false }],
      }),
    ).toBeTruthy();
    for (const input of [
      { category: "TAX_COMPLIANCE_ALERT", optionalEmailEnabled: false },
      {
        category: "COLLABORATIONS",
        channel: "IN_APP",
        optionalEmailEnabled: false,
      },
      {
        category: "COLLABORATIONS",
        channel: "SLACK_WEBHOOK",
        optionalEmailEnabled: false,
      },
      {
        category: "COLLABORATIONS",
        optionalEmailEnabled: false,
        userId: crypto.randomUUID(),
      },
    ])
      expect(
        BulkNotificationSettingsSchema.safeParse({ settings: [input] }).success,
      ).toBe(false);
  });

  it("removes unread and identity override inputs", () => {
    expect(markNotificationReadSchema.safeParse({}).success).toBe(true);
    expect(
      markNotificationReadSchema.safeParse({ is_read: false }).success,
    ).toBe(false);
    const valid = {
      event_type: "billing.invoice_ready",
      payload: {},
      source_type: "invoice",
      source_id: "i-1",
      transition_id: "ready",
    };
    expect(testEmitNotificationSchema.safeParse(valid).success).toBe(true);
    expect(
      testEmitNotificationSchema.safeParse({
        ...valid,
        workspace_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      testEmitNotificationSchema.safeParse({
        ...valid,
        trigger_user_id: crypto.randomUUID(),
      }).success,
    ).toBe(false);
  });
});
