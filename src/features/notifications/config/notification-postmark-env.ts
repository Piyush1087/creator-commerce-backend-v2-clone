import { NOTIFICATION_EVENT_REGISTRY } from "./notification-event-registry";

/**
 * Converts a notification event type to its Postmark template env var name.
 * Example: `escrow.low_balance` → `POSTMARK_TEMPLATE_ESCROW_LOW_BALANCE`
 */
export function eventTypeToPostmarkEnvKey(eventType: string): string {
  return `POSTMARK_TEMPLATE_${eventType.toUpperCase().replace(/\./g, "_")}`;
}

/** Event types that send transactional email per product routing matrix. */
export const NOTIFICATION_EMAIL_EVENT_TYPES = Object.values(
  NOTIFICATION_EVENT_REGISTRY,
)
  .filter((definition) => definition.email)
  .map((definition) => definition.eventType);

/** Env var names for per-event Postmark template IDs (deploy + local). */
export const NOTIFICATION_POSTMARK_TEMPLATE_ENV_KEYS =
  NOTIFICATION_EMAIL_EVENT_TYPES.map(eventTypeToPostmarkEnvKey);

export type NotificationPostmarkTemplateEnvKey =
  (typeof NOTIFICATION_POSTMARK_TEMPLATE_ENV_KEYS)[number];

/**
 * Resolves Postmark template ID for a notification event.
 * Per-event env → default notification template → OTP template.
 */
export function resolveNotificationTemplateIdFromEnv(eventType: string): number {
  const envKey = eventTypeToPostmarkEnvKey(eventType);
  const specific = process.env[envKey]?.trim();
  const fallback =
    process.env.POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID?.trim() ??
    process.env.POSTMARK_OTP_TEMPLATE_ID?.trim();

  const raw =
    specific && specific.length > 0 ? specific : fallback;

  if (!raw) {
    throw new Error(
      `No Postmark template configured for ${eventType}. Set ${envKey} or POSTMARK_NOTIFICATION_DEFAULT_TEMPLATE_ID`,
    );
  }

  const templateId = parseInt(raw, 10);
  if (Number.isNaN(templateId)) {
    throw new Error(`Invalid Postmark template id for ${envKey}: ${raw}`);
  }

  return templateId;
}

/**
 * Builds `{ POSTMARK_TEMPLATE_*: value }` for SST / process env wiring.
 * Empty string when unset so deploy can inject real IDs later.
 */
export function buildNotificationPostmarkTemplateEnv(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return Object.fromEntries(
    NOTIFICATION_POSTMARK_TEMPLATE_ENV_KEYS.map((key) => [
      key,
      env[key]?.trim() ?? "",
    ]),
  );
}
