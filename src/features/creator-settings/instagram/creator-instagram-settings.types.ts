import type {
  ProviderAuthorizationHealth,
  ProviderCapabilityState,
} from "@prisma/client";

export type CreatorInstagramSettingsLifecycleState =
  | "NOT_CONNECTED"
  | "CONNECTED_HEALTHY"
  | "REVALIDATION_REQUIRED"
  | "RECONNECT_REQUIRED"
  | "PROVIDER_BLOCKED_RECOVERABLE"
  | "DISCONNECTED_IDENTITY_RETAINED";

export type CreatorInstagramSettingsReadModel = {
  platform: "INSTAGRAM";
  lifecycleState: CreatorInstagramSettingsLifecycleState;
  identity: {
    retained: boolean;
    handle: string | null;
    displayTitle: string | null;
    avatarUrl: string | null;
  };
  authorization: {
    health: ProviderAuthorizationHealth | "NOT_CONNECTED";
    reasonCode: string | null;
    basicCapability: ProviderCapabilityState | "NOT_CONNECTED";
    insightsCapability: ProviderCapabilityState | "NOT_CONNECTED";
    tokenExpiresAt: string | null;
    lastValidatedAt: string | null;
    lastMetadataSyncAt: string | null;
  };
  allowedActions: {
    initialConnect: boolean;
    revalidate: boolean;
    sameIdReconnect: boolean;
    disconnect: boolean;
  };
  recovery: {
    settingsAvailable: true;
    permanentIdentityRequired: true;
    differentAccountRequiresManualReview: true;
  };
};
