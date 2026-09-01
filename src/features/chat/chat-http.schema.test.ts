import { describe, expect, it } from "vitest";

import {
  ChatCreateConversationSchema,
  ChatPatchConversationSchema,
  ChatTurnRequestSchema,
} from "./chat-http.schema";

describe("permanent Chat HTTP schemas", () => {
  it("accepts only bounded conversation metadata", () => {
    expect(ChatCreateConversationSchema.parse({ title: "My chat" })).toEqual({
      title: "My chat",
    });
    expect(
      ChatPatchConversationSchema.parse({ title: "Renamed", archived: false }),
    ).toEqual({ title: "Renamed", archived: false });
    expect(() => ChatPatchConversationSchema.parse({})).toThrow();
    expect(() =>
      ChatCreateConversationSchema.parse({ title: "x", userId: "attacker" }),
    ).toThrow();
  });

  it.each([
    "userId",
    "brandId",
    "brandProfileId",
    "organizationId",
    "role",
    "membershipRole",
    "allowedCapabilityIds",
    "authorizedEntityRefs",
    "providerToken",
    "accessToken",
    "apiKey",
    "capabilityResults",
    "grounding",
  ])("rejects client authority field %s", (field) => {
    expect(() =>
      ChatTurnRequestSchema.parse({ message: "hello", [field]: "attack" }),
    ).toThrow();
  });

  it("keeps route and selected entity values as bounded hints", () => {
    expect(
      ChatTurnRequestSchema.parse({
        message: "Open it",
        surface: "MODULE",
        routePath: "/campaigns/hint",
        selectedEntity: { type: "CAMPAIGN", id: "hint" },
      }),
    ).toMatchObject({ selectedEntity: { id: "hint" } });
  });
});
