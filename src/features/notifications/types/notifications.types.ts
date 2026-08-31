import type {
  NotificationEmailPolicy,
  NotificationInAppPolicy,
  NotificationUrgencyLevel,
  SettingsNotificationCategory,
} from "@prisma/client";

export type NotificationEventType =
  | "billing.subscription_payment_failed"
  | "billing.subscription_payment_recovered"
  | "billing.trial_expired"
  | "billing.subscription_halted"
  | "billing.cancellation_scheduled"
  | "billing.cancellation_effective"
  | "billing.cancellation_reactivated"
  | "billing.invoice_ready"
  | "escrow.funding_credited"
  | "escrow.collaboration_awaiting_funds"
  | "escrow.collaboration_refunded"
  | "escrow.creator_payout_action_required"
  | "escrow.creator_payout_settled"
  | "escrow.creator_payout_reversed"
  | "escrow.brand_return_action_required"
  | "escrow.brand_return_partial"
  | "escrow.brand_return_completed"
  | "campaigns.application_received"
  | "collaborations.media_submitted_for_review"
  | "intelligence.execution_completed"
  | "intelligence.execution_failed"
  | "team.member_access_revoked"
  | "integration.instagram_token_expired";

export type NotificationRecipientPolicy =
  | "OWNER_FINANCE"
  | "OWNER_CAMPAIGN_MANAGERS"
  | "OWNER_FINANCE_PLUS_ACTIVE_TRIGGERING_CM"
  | "AFFECTED_USER_EMAIL_ONLY";
export type NotificationPayload = Record<string, unknown>;
export type NotificationSourceIdentity = {
  sourceType: string;
  sourceId: string;
  transitionId: string;
};

export type NotificationDispatchInput = {
  workspaceId: string;
  eventType: NotificationEventType;
  source: NotificationSourceIdentity;
  payload: NotificationPayload;
  triggerUserId?: string | null;
  affectedUserId?: string | null;
  actorName?: string | null;
};

export type NotificationEventDefinition = {
  eventType: NotificationEventType;
  category: SettingsNotificationCategory;
  urgencyLevel: NotificationUrgencyLevel;
  actionable: boolean;
  inAppPolicy: NotificationInAppPolicy;
  emailPolicy: NotificationEmailPolicy;
  recipientPolicy: NotificationRecipientPolicy;
  deepLinkPath: string;
  title: string;
  semanticIdentityContract: "SOURCE_TYPE_SOURCE_ID_TRANSITION_ID";
  aggregatable: false;
};

export type NotificationRealtimePayload = {
  id: string;
  event_type: string;
  category: SettingsNotificationCategory | null;
  urgency_level: NotificationUrgencyLevel;
  actionable: boolean | null;
  payload: NotificationPayload;
  created_at: string;
};

export type ClaimedNotificationJob = {
  id: string;
  workspaceId: string;
  eventType: string;
  semanticEventKey: string;
  claimToken: string;
  triggerUserId: string | null;
  payload: NotificationPayload;
  actorName: string | null;
  attempts: number;
  maxAttempts: number;
};
