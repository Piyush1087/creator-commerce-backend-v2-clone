import { describe, expect, it } from "vitest";

import {
  CHAT_CAPABILITY_CATALOG,
  CHAT_FIRST_SLICE_CAPABILITY_IDS,
} from "./chat-capability.catalog";
import type { ChatCapabilityHandler } from "./chat-capability-handler.contract";
import { ChatCapabilityHandlerRegistry } from "./chat-capability-handler.registry";
import { ChatCapabilityRegistry } from "./chat-capability.registry";

const handler = (capabilityId: string): ChatCapabilityHandler => ({
  capabilityId,
  async execute() {
    return {
      capabilityId,
      availability: "AVAILABLE",
      data: {},
      grounding: [],
      authorizedEntityRefs: [],
    };
  },
});

describe("ChatCapabilityHandlerRegistry", () => {
  const descriptors = new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG);

  it("registers exactly one handler for every frozen capability", () => {
    const registry = new ChatCapabilityHandlerRegistry(
      descriptors,
      CHAT_FIRST_SLICE_CAPABILITY_IDS.map(handler),
    );
    expect(registry.list().map((item) => item.capabilityId)).toEqual(
      CHAT_FIRST_SLICE_CAPABILITY_IDS,
    );
  });

  it("fails startup registration for duplicate, missing, or extra handlers", () => {
    expect(
      () =>
        new ChatCapabilityHandlerRegistry(descriptors, [
          handler(CHAT_FIRST_SLICE_CAPABILITY_IDS[0]),
          handler(CHAT_FIRST_SLICE_CAPABILITY_IDS[0]),
        ]),
    ).toThrow(/Duplicate/);
    expect(
      () =>
        new ChatCapabilityHandlerRegistry(
          descriptors,
          CHAT_FIRST_SLICE_CAPABILITY_IDS.slice(1).map(handler),
        ),
    ).toThrow(/do not match/);
    expect(
      () =>
        new ChatCapabilityHandlerRegistry(descriptors, [
          ...CHAT_FIRST_SLICE_CAPABILITY_IDS.map(handler),
          handler("extra.capability"),
        ]),
    ).toThrow(/do not match/);
  });
});
