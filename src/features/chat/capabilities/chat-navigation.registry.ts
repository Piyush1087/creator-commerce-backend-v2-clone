import { Injectable } from "@nestjs/common";

import type { ChatEntityRef } from "../response/chat-response.contract";

export const CHAT_NAVIGATION_DESTINATIONS = [
  "HOME",
  "BRAND_CENTRE",
  "OFFERINGS",
  "CAMPAIGNS",
  "COLLABORATIONS",
  "SETTINGS",
  "SETTINGS_INTEGRATIONS",
  "SETTINGS_BILLING",
] as const;

type ChatNavigationDestination = (typeof CHAT_NAVIGATION_DESTINATIONS)[number];

const entityTypesByDestination: Readonly<
  Record<ChatNavigationDestination, readonly ChatEntityRef["type"][]>
> = {
  HOME: [],
  BRAND_CENTRE: ["BRAND"],
  OFFERINGS: ["OFFERING"],
  CAMPAIGNS: ["CAMPAIGN"],
  COLLABORATIONS: ["COLLABORATION"],
  SETTINGS: [],
  SETTINGS_INTEGRATIONS: [],
  SETTINGS_BILLING: [],
};

@Injectable()
export class ChatNavigationRegistry {
  list(): readonly ChatNavigationDestination[] {
    return CHAT_NAVIGATION_DESTINATIONS;
  }

  authorizes(
    destinationId: ChatNavigationDestination,
    entityRef: ChatEntityRef | undefined,
    authorizedEntityRefs: readonly ChatEntityRef[],
  ): boolean {
    if (!entityRef) return true;
    return (
      entityTypesByDestination[destinationId].includes(entityRef.type) &&
      authorizedEntityRefs.some(
        (authorized) =>
          authorized.type === entityRef.type && authorized.id === entityRef.id,
      )
    );
  }
}
