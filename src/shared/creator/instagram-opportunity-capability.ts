import type { CreatorSocialIntegration } from "@prisma/client";

export type InstagramOpportunityState =
  | "NOT_CONNECTED"
  | "CONNECTED_HEALTHY"
  | "REVALIDATION_REQUIRED"
  | "RECONNECT_REQUIRED"
  | "PROVIDER_BLOCKED_RECOVERABLE"
  | "DISCONNECTED_IDENTITY_RETAINED";
export type InstagramOpportunityInput = Pick<
  CreatorSocialIntegration,
  | "nativePlatformUserId"
  | "tokenStateCondition"
  | "tokenExpiresAt"
  | "disconnectedAt"
  | "authorizationHealth"
  | "basicAuthorizationCapability"
>;

/** Pure persisted-state projection shared by Creator Entry, Settings and Opportunity reads. */
export function evaluateInstagramOpportunity(
  integration: InstagramOpportunityInput | null | undefined,
  now: Date,
) {
  let lifecycleState: InstagramOpportunityState;
  if (!integration?.nativePlatformUserId.trim())
    lifecycleState = "NOT_CONNECTED";
  else if (
    integration.disconnectedAt ||
    integration.tokenStateCondition === "REVOKED" ||
    integration.authorizationHealth === "DISCONNECTED"
  )
    lifecycleState = "DISCONNECTED_IDENTITY_RETAINED";
  else if (
    integration.tokenStateCondition === "ACTIVE" &&
    (!integration.tokenExpiresAt || integration.tokenExpiresAt > now) &&
    integration.authorizationHealth === "USABLE" &&
    integration.basicAuthorizationCapability === "AVAILABLE"
  )
    lifecycleState = "CONNECTED_HEALTHY";
  else if (integration.authorizationHealth === "PROVIDER_ACCESS_BLOCKED")
    lifecycleState = "PROVIDER_BLOCKED_RECOVERABLE";
  else if (
    integration.tokenStateCondition === "EXPIRED" ||
    (integration.tokenExpiresAt && integration.tokenExpiresAt <= now) ||
    integration.authorizationHealth === "REAUTHORIZATION_REQUIRED" ||
    integration.basicAuthorizationCapability === "UNAVAILABLE"
  )
    lifecycleState = "RECONNECT_REQUIRED";
  else lifecycleState = "REVALIDATION_REQUIRED";
  const recoveryAction =
    lifecycleState === "CONNECTED_HEALTHY"
      ? null
      : lifecycleState === "NOT_CONNECTED"
        ? ("CONNECT_INSTAGRAM" as const)
        : lifecycleState === "RECONNECT_REQUIRED" ||
            lifecycleState === "DISCONNECTED_IDENTITY_RETAINED"
          ? ("RECONNECT_INSTAGRAM" as const)
          : ("REVALIDATE_INSTAGRAM" as const);
  return {
    lifecycleState,
    usableForOpportunity: lifecycleState === "CONNECTED_HEALTHY",
    recoveryAction,
  };
}
