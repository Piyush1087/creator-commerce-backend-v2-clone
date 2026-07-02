import type {
  NotificationUrgencyLevel,
  SettingsNotificationCategory,
} from "@prisma/client";

export type NotificationEventType =
  | "integration.meta_token_expired"
  | "team.invite_pending"
  | "workspace.seat_capacity_bounded"
  | "escrow.low_balance"
  | "billing.invoice_payment_failed"
  | "billing.tax_invoice_compiled"
  | "pricing.trial_expiring"
  | "pricing.subscription_renewed"
  | "pricing.usage_cap_approaching"
  | "planner.competitive_scan_complete"
  | "outreach.creator_accepted"
  | "outreach.milestone_counter_offer"
  | "outreach.offer_expired"
  | "workflow.asset_draft_submitted"
  | "workflow.post_cleared_automated_check"
  | "workflow.milestone_overdue_creator"
  | "workflow.brand_review_overdue"
  | "workflow.compliance_failure";

export type NotificationPayload = Record<string, unknown>;

export type NotificationDispatchInput = {
  workspaceId: string;
  eventType: NotificationEventType;
  urgencyLevel: NotificationUrgencyLevel;
  payload: NotificationPayload;
  triggerUserId?: string | null;
  actorName?: string | null;
};

export type NotificationEventDefinition = {
  eventType: NotificationEventType;
  urgencyLevel: NotificationUrgencyLevel;
  inApp: boolean;
  email: boolean;
  deepLinkPath: string;
  title: string;
  settingsCategory?: SettingsNotificationCategory;
  aggregatable: boolean;
};

export type NotificationRealtimePayload = {
  id: string;
  event_type: NotificationEventType;
  urgency_level: NotificationUrgencyLevel;
  payload: NotificationPayload;
  created_at: string;
  is_aggregated?: boolean;
};

export type ClaimedNotificationJob = {
  id: string;
  workspaceId: string;
  eventType: string;
  urgencyLevel: NotificationUrgencyLevel;
  triggerUserId: string | null;
  payload: NotificationPayload;
  actorName: string | null;
  attempts: number;
  maxAttempts: number;
};
