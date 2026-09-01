import { Injectable } from "@nestjs/common";

import type { ChatEntityRef } from "../../response/chat-response.contract";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityExecutionResult,
  ChatCapabilityHandler,
} from "../chat-capability-handler.contract";
import {
  ChatNavigationRegistry,
  type CHAT_NAVIGATION_DESTINATIONS,
} from "../chat-navigation.registry";

type DestinationId = (typeof CHAT_NAVIGATION_DESTINATIONS)[number];

@Injectable()
export class AppNavigateHandler implements ChatCapabilityHandler {
  readonly capabilityId = "app.navigate";

  constructor(private readonly navigation: ChatNavigationRegistry) {}

  async execute(
    context: ChatCapabilityExecutionContext,
    input: Readonly<Record<string, unknown>>,
  ): Promise<ChatCapabilityExecutionResult> {
    const destinationId = input.destinationId as DestinationId;
    const entityRef = input.entity as ChatEntityRef | undefined;
    if (
      !this.navigation.authorizes(
        destinationId,
        entityRef,
        context.authorizedEntityRefs,
      )
    ) {
      return {
        capabilityId: this.capabilityId,
        availability: "NOT_AUTHORIZED",
        grounding: [],
        authorizedEntityRefs: [],
        limitations: ["The requested item is not available in this workspace."],
      };
    }
    const data = {
      destinationId,
      ...(entityRef ? { entityRef } : {}),
    };
    return {
      capabilityId: this.capabilityId,
      availability: "AVAILABLE",
      data,
      grounding: [],
      authorizedEntityRefs: entityRef ? [entityRef] : [],
      navigation: data,
    };
  }
}
