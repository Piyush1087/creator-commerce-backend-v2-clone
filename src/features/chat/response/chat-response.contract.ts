export const CHAT_RESPONSE_STATUSES = [
  "ANSWERED",
  "PARTIAL",
  "STALE",
  "CAPABILITY_UNAVAILABLE",
  "NOT_AUTHORIZED",
  "NAVIGATION",
] as const;

export const CHAT_GROUNDING_SOURCE_TYPES = [
  "CANONICAL",
  "INTELLIGENCE",
] as const;

export const CHAT_ENTITY_TYPES = [
  "BRAND",
  "OFFERING",
  "CAMPAIGN",
  "COLLABORATION",
  "SETTINGS",
  "PROVIDER",
] as const;

export type ChatEntityRef = {
  type: (typeof CHAT_ENTITY_TYPES)[number];
  id: string;
};

export type ChatGroundingRef = {
  sourceType: (typeof CHAT_GROUNDING_SOURCE_TYPES)[number];
  capabilityId: string;
  entityRefs: readonly ChatEntityRef[];
  readiness?: string;
  freshness?: string;
  resultRefs?: readonly string[];
};

export type ChatGroundedResponse = {
  contractVersion: "1.0";
  status: (typeof CHAT_RESPONSE_STATUSES)[number];
  answer: string;
  grounding: readonly ChatGroundingRef[];
  entityRefs: readonly ChatEntityRef[];
  freshnessNotes: readonly string[];
  limitations: readonly string[];
  recommendation?: {
    text: string;
    basisRefs: readonly string[];
    nonMutating: true;
  };
  navigation?: { destinationId: string; entityRef?: ChatEntityRef };
};

declare const validatedChatResponse: unique symbol;
export type ValidatedChatGroundedResponse = ChatGroundedResponse & {
  readonly [validatedChatResponse]: true;
};

export type ChatResponseExecutionEvidence = {
  invokedCapabilityIds: readonly string[];
  authorizedEntityRefs: readonly ChatEntityRef[];
  allowedNavigationDestinationIds: readonly string[];
  executedGroundingResultRefs: readonly Readonly<{
    capabilityId: string;
    resultRefs: readonly string[];
  }>[];
};
