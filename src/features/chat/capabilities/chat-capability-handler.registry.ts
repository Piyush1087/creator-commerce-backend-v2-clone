import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { CHAT_FIRST_SLICE_CAPABILITY_IDS } from "./chat-capability.catalog";
import type { ChatCapabilityHandler } from "./chat-capability-handler.contract";
import { CHAT_CAPABILITY_HANDLERS } from "./chat-capability-handler.tokens";
import { ChatCapabilityRegistry } from "./chat-capability.registry";

@Injectable()
export class ChatCapabilityHandlerRegistry {
  private readonly handlers: ReadonlyMap<string, ChatCapabilityHandler>;

  constructor(
    descriptors: ChatCapabilityRegistry,
    @Inject(CHAT_CAPABILITY_HANDLERS)
    handlers: readonly ChatCapabilityHandler[],
  ) {
    const entries = new Map<string, ChatCapabilityHandler>();
    for (const handler of handlers) {
      if (!handler.capabilityId.trim() || entries.has(handler.capabilityId)) {
        throw new Error(
          entries.has(handler.capabilityId)
            ? `Duplicate Chat capability handler: ${handler.capabilityId}`
            : "Invalid Chat capability handler",
        );
      }
      entries.set(handler.capabilityId, handler);
    }

    const implementedIds = descriptors
      .list()
      .filter((descriptor) => descriptor.implementationState === "IMPLEMENTED")
      .map((descriptor) => descriptor.id);
    if (
      implementedIds.length !== CHAT_FIRST_SLICE_CAPABILITY_IDS.length ||
      implementedIds.some((id) => !entries.has(id)) ||
      [...entries.keys()].some((id) => !implementedIds.includes(id))
    ) {
      throw new Error(
        "Chat capability descriptors and implemented handlers do not match",
      );
    }
    this.handlers = entries;
  }

  list(): readonly ChatCapabilityHandler[] {
    return [...this.handlers.values()];
  }

  get(capabilityId: string): ChatCapabilityHandler {
    const handler = this.handlers.get(capabilityId);
    if (!handler) {
      throw new BadRequestException(
        `Chat capability is not executable: ${capabilityId}`,
      );
    }
    return handler;
  }
}
