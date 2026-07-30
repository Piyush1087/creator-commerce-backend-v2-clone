/**
 * Co-pilot turn quotas (MAX_AI_CHATS / creator monthly cap).
 *
 * Enforced on production only. Local and dev must not block chat.
 *
 * Override: COPILOT_QUOTA_ENFORCED=true|false
 * Default when unset: enforced only when STAGE=prod
 */
export function isCoPilotQuotaEnforced(
  stage: string | undefined = process.env.STAGE,
  explicit: string | undefined = process.env.COPILOT_QUOTA_ENFORCED,
): boolean {
  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }
  return (stage ?? "local").trim().toLowerCase() === "prod";
}
