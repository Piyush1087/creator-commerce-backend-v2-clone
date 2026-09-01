import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  CHAT_CAPABILITY_CATALOG,
  CHAT_FIRST_SLICE_CAPABILITY_IDS,
} from "./chat-capability.catalog";
import type {
  ChatCapabilityExecutionContext,
  ChatCapabilityHandler,
} from "./chat-capability-handler.contract";
import { ChatCapabilityHandlerRegistry } from "./chat-capability-handler.registry";
import { ChatCapabilityExecutor } from "./chat-capability.executor";
import { ChatCapabilityRegistry } from "./chat-capability.registry";

const context: ChatCapabilityExecutionContext = {
  actor: {
    id: "user-1",
    email: "user@example.test",
    name: "User",
    role: UserRole.BRAND,
    organizationId: "organization-1",
  },
  chatContext: {
    actor: { userId: "user-1", role: UserRole.BRAND },
    workspace: { brandProfileId: "brand-1", membershipRole: "BRAND_OWNER" },
    conversation: { id: null },
    surface: { kind: "HOME" },
    requestHints: {},
    capabilities: [],
    canonicalRefs: [{ type: "BRAND", id: "brand-1" }],
    intelligenceRefs: [],
    providerReadiness: [],
    turnStartedAt: new Date(0).toISOString(),
  },
  authorizedEntityRefs: [{ type: "BRAND", id: "brand-1" }],
};

function executor(execute: ChatCapabilityHandler["execute"]) {
  const descriptors = new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG);
  const handlers = CHAT_FIRST_SLICE_CAPABILITY_IDS.map(
    (capabilityId): ChatCapabilityHandler => ({ capabilityId, execute }),
  );
  return {
    executor: new ChatCapabilityExecutor(
      descriptors,
      new ChatCapabilityHandlerRegistry(descriptors, handlers),
    ),
    execute,
  };
}

describe("ChatCapabilityExecutor", () => {
  it("validates strict inputs before handler execution", async () => {
    const execute = vi.fn();
    const test = executor(execute);
    await expect(
      test.executor.execute(context, "workspace.context.read", {
        brandProfileId: "foreign",
      }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects handler output that does not satisfy the registered strict schema", async () => {
    const test = executor(async () => ({
      capabilityId: "workspace.context.read",
      availability: "AVAILABLE",
      data: { injected: true },
      grounding: [],
      authorizedEntityRefs: [],
    }));
    await expect(
      test.executor.execute(context, "workspace.context.read", {}),
    ).rejects.toThrow();
  });
});
