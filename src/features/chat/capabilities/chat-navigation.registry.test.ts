import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { ChatCapabilityExecutionContext } from "./chat-capability-handler.contract";
import { CHAT_CAPABILITY_CATALOG } from "./chat-capability.catalog";
import { ChatCapabilityRegistry } from "./chat-capability.registry";
import { ChatNavigationRegistry } from "./chat-navigation.registry";
import { AppNavigateHandler } from "./handlers/app-navigate.handler";

const context: ChatCapabilityExecutionContext = {
  actor: {
    id: "user-1",
    email: "owner@example.test",
    name: "Owner",
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
  authorizedEntityRefs: [
    { type: "BRAND", id: "brand-1" },
    { type: "COLLABORATION", id: "collaboration-1" },
  ],
};

describe("P5-A bounded Chat navigation", () => {
  const handler = new AppNavigateHandler(new ChatNavigationRegistry());
  const capabilities = new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG);

  it.each([
    "COLLABORATIONS",
    "SETTINGS",
    "SETTINGS_INTEGRATIONS",
    "SETTINGS_BILLING",
  ])("allows the generic %s destination", async (destinationId) => {
    await expect(
      handler.execute(context, { destinationId }),
    ).resolves.toMatchObject({
      availability: "AVAILABLE",
      navigation: { destinationId },
    });
  });

  it("allows only an authorized Collaboration on COLLABORATIONS", async () => {
    await expect(
      handler.execute(context, {
        destinationId: "COLLABORATIONS",
        entity: { type: "COLLABORATION", id: "collaboration-1" },
      }),
    ).resolves.toMatchObject({
      availability: "AVAILABLE",
      navigation: {
        destinationId: "COLLABORATIONS",
        entityRef: { type: "COLLABORATION", id: "collaboration-1" },
      },
    });
    await expect(
      handler.execute(context, {
        destinationId: "COLLABORATIONS",
        entity: { type: "COLLABORATION", id: "foreign" },
      }),
    ).resolves.toMatchObject({ availability: "NOT_AUTHORIZED" });
    await expect(
      handler.execute(context, {
        destinationId: "COLLABORATIONS",
        entity: { type: "BRAND", id: "brand-1" },
      }),
    ).resolves.toMatchObject({ availability: "NOT_AUTHORIZED" });
  });

  it.each(["SETTINGS", "SETTINGS_INTEGRATIONS", "SETTINGS_BILLING"])(
    "rejects entity materialization for %s",
    async (destinationId) => {
      await expect(
        handler.execute(context, {
          destinationId,
          entity: { type: "BRAND", id: "brand-1" },
        }),
      ).resolves.toMatchObject({ availability: "NOT_AUTHORIZED" });
    },
  );

  it("rejects unknown destinations at strict capability validation", () => {
    expect(() =>
      capabilities.validateInput("app.navigate", {
        destinationId: "ARBITRARY_ROUTE",
      }),
    ).toThrow();
  });
});
