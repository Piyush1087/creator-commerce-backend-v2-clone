import type { ZodType } from "zod";

export const CHAT_CAPABILITY_CLASSES = [
  "READ",
  "NAVIGATE",
  "RECOMMEND",
  "PROPOSE",
  "EXECUTE",
] as const;

export const CHAT_CAPABILITY_AVAILABILITY = [
  "AVAILABLE",
  "DEGRADED",
  "UNAVAILABLE_RECOVERABLE",
  "UNAVAILABLE",
  "NOT_AUTHORIZED",
  "NOT_IMPLEMENTED",
] as const;

export const CHAT_CONFIRMATION_POLICIES = [
  "NOT_REQUIRED",
  "EXPLICIT_REQUIRED",
  "HEIGHTENED_REQUIRED",
] as const;

export const CHAT_CAPABILITY_RISKS = [
  "NON_CONSEQUENTIAL",
  "CONSEQUENTIAL",
  "HEIGHTENED",
] as const;

export type ChatCapabilityClass = (typeof CHAT_CAPABILITY_CLASSES)[number];
export type ChatCapabilityAvailabilityStatus =
  (typeof CHAT_CAPABILITY_AVAILABILITY)[number];
export type ChatConfirmationPolicy =
  (typeof CHAT_CONFIRMATION_POLICIES)[number];
export type ChatCapabilityRisk = (typeof CHAT_CAPABILITY_RISKS)[number];

export type ChatCapabilityDescriptor = {
  id: string;
  class: ChatCapabilityClass;
  owner: string;
  domain: string;
  risk: ChatCapabilityRisk;
  confirmation: ChatConfirmationPolicy;
  inputSchema: ZodType<Record<string, unknown>>;
  outputSchema?: ZodType<unknown>;
  providerDependencies?: readonly string[];
  implementationState: "NOT_IMPLEMENTED" | "IMPLEMENTED";
  availability: ChatCapabilityAvailabilityStatus;
};

export type ChatCapabilitySnapshot = {
  capabilityId: string;
  availability: ChatCapabilityAvailabilityStatus;
};
