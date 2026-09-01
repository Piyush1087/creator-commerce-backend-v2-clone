import type { ChatCapabilityDescriptor } from "./chat-capability.contract";
import {
  CampaignChatCapabilityInputSchema,
  EmptyChatCapabilityInputSchema,
  NavigateChatCapabilityInputSchema,
  OfferingChatCapabilityInputSchema,
} from "./chat-capability.schema";

export const CHAT_FIRST_SLICE_CAPABILITY_IDS = [
  "workspace.context.read",
  "brand.current.read",
  "offering.list",
  "offering.read",
  "brand_intelligence.current.read",
  "product_intelligence.current.read",
  "campaign.list",
  "campaign.read",
  "app.navigate",
] as const;

const planned = (
  id: (typeof CHAT_FIRST_SLICE_CAPABILITY_IDS)[number],
  capabilityClass: "READ" | "NAVIGATE",
  domain: string,
  inputSchema: ChatCapabilityDescriptor["inputSchema"],
): ChatCapabilityDescriptor => ({
  id,
  class: capabilityClass,
  owner: "chat-home",
  domain,
  risk: "NON_CONSEQUENTIAL",
  confirmation: "NOT_REQUIRED",
  inputSchema,
  implementationState: "NOT_IMPLEMENTED",
  availability: "NOT_IMPLEMENTED",
});

export const CHAT_CAPABILITY_CATALOG: readonly ChatCapabilityDescriptor[] = [
  planned(
    "workspace.context.read",
    "READ",
    "workspace",
    EmptyChatCapabilityInputSchema,
  ),
  planned(
    "brand.current.read",
    "READ",
    "brand",
    EmptyChatCapabilityInputSchema,
  ),
  planned("offering.list", "READ", "offering", EmptyChatCapabilityInputSchema),
  planned(
    "offering.read",
    "READ",
    "offering",
    OfferingChatCapabilityInputSchema,
  ),
  planned(
    "brand_intelligence.current.read",
    "READ",
    "brand-intelligence",
    EmptyChatCapabilityInputSchema,
  ),
  planned(
    "product_intelligence.current.read",
    "READ",
    "product-intelligence",
    OfferingChatCapabilityInputSchema,
  ),
  planned("campaign.list", "READ", "campaign", EmptyChatCapabilityInputSchema),
  planned(
    "campaign.read",
    "READ",
    "campaign",
    CampaignChatCapabilityInputSchema,
  ),
  planned(
    "app.navigate",
    "NAVIGATE",
    "navigation",
    NavigateChatCapabilityInputSchema,
  ),
];
