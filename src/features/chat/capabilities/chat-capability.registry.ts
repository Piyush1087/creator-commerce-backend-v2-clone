import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import type {
  ChatCapabilityDescriptor,
  ChatCapabilitySnapshot,
} from "./chat-capability.contract";
import {
  CHAT_CAPABILITY_AVAILABILITY,
  CHAT_CAPABILITY_CLASSES,
  CHAT_CAPABILITY_RISKS,
  CHAT_CONFIRMATION_POLICIES,
} from "./chat-capability.contract";
import { CHAT_CAPABILITY_DESCRIPTORS } from "./chat-capability.tokens";

@Injectable()
export class ChatCapabilityRegistry {
  private readonly descriptors: ReadonlyMap<string, ChatCapabilityDescriptor>;

  constructor(
    @Inject(CHAT_CAPABILITY_DESCRIPTORS)
    descriptors: readonly ChatCapabilityDescriptor[],
  ) {
    const entries = new Map<string, ChatCapabilityDescriptor>();
    for (const descriptor of descriptors) {
      this.assertDescriptor(descriptor);
      if (entries.has(descriptor.id)) {
        throw new Error(`Duplicate Chat capability id: ${descriptor.id}`);
      }
      entries.set(descriptor.id, descriptor);
    }
    this.descriptors = entries;
  }

  list(): readonly ChatCapabilityDescriptor[] {
    return [...this.descriptors.values()];
  }

  discover(): readonly ChatCapabilitySnapshot[] {
    return this.list().map((descriptor) => ({
      capabilityId: descriptor.id,
      availability: descriptor.availability,
    }));
  }

  get(capabilityId: string): ChatCapabilityDescriptor {
    const descriptor = this.descriptors.get(capabilityId);
    if (!descriptor) {
      throw new BadRequestException(`Unknown Chat capability: ${capabilityId}`);
    }
    return descriptor;
  }

  validateInput(capabilityId: string, input: unknown): Record<string, unknown> {
    return this.get(capabilityId).inputSchema.parse(input);
  }

  private assertDescriptor(descriptor: ChatCapabilityDescriptor): void {
    if (
      !descriptor.id.trim() ||
      !descriptor.owner.trim() ||
      !descriptor.domain.trim() ||
      !CHAT_CAPABILITY_CLASSES.includes(descriptor.class) ||
      !CHAT_CAPABILITY_RISKS.includes(descriptor.risk) ||
      !CHAT_CONFIRMATION_POLICIES.includes(descriptor.confirmation) ||
      !CHAT_CAPABILITY_AVAILABILITY.includes(descriptor.availability) ||
      !["NOT_IMPLEMENTED", "IMPLEMENTED"].includes(
        descriptor.implementationState,
      ) ||
      typeof descriptor.inputSchema?.parse !== "function" ||
      (descriptor.implementationState === "NOT_IMPLEMENTED" &&
        descriptor.availability !== "NOT_IMPLEMENTED")
    ) {
      throw new Error("Invalid Chat capability descriptor");
    }
  }
}
