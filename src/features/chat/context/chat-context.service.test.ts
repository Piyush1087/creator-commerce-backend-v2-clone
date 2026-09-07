import { NotFoundException } from "@nestjs/common";
import { BrandRole, UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../auth/types/auth-user";
import type { BrandWorkspaceAuthorizationService } from "../../brand-centre/brand-workspace-authorization.service";
import { CHAT_CAPABILITY_CATALOG } from "../capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import type { ChatConversationService } from "../conversation/chat-conversation.service";
import { ChatContextService } from "./chat-context.service";

describe("ChatContextService", () => {
  const actor: AuthUser = {
    id: "user-a",
    email: "a@example.test",
    name: "A",
    role: UserRole.BRAND,
    organizationId: "org-a",
  };

  function fixture(conversation: object | null = { id: "thread-a" }) {
    const resolveBrandContext = vi.fn().mockResolvedValue({
      brandProfileId: "brand-a",
      membership: { role: BrandRole.CAMPAIGN_MANAGER },
    });
    const getConversationForScope = vi.fn().mockResolvedValue(conversation);
    const service = new ChatContextService(
      { resolveBrandContext } as unknown as BrandWorkspaceAuthorizationService,
      { getConversationForScope } as unknown as ChatConversationService,
      new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG),
    );
    return { service, resolveBrandContext, getConversationForScope };
  }

  it("derives actor/workspace server-side and contains untrusted route/entity hints", async () => {
    const { service, resolveBrandContext } = fixture();
    const before = Date.now();
    const context = await service.assemble(actor, {
      surface: "MODULE",
      routePath: "/campaigns/foreign",
      selectedEntity: { type: "CAMPAIGN", id: "client-hint" },
    });
    expect(resolveBrandContext).toHaveBeenCalledWith(actor);
    expect(context.actor).toEqual({ userId: actor.id, role: UserRole.BRAND });
    expect(context.workspace).toEqual({
      brandProfileId: "brand-a",
      membershipRole: BrandRole.CAMPAIGN_MANAGER,
    });
    expect(context.requestHints.selectedEntity).toEqual({
      type: "CAMPAIGN",
      id: "client-hint",
    });
    expect(context.canonicalRefs).toEqual([{ type: "BRAND", id: "brand-a" }]);
    expect(context.canonicalRefs).not.toContainEqual({
      type: "CAMPAIGN",
      id: "client-hint",
    });
    expect(context.intelligenceRefs).toEqual([]);
    expect(context.providerReadiness).toEqual([]);
    expect(context.capabilities).toHaveLength(13);
    expect(
      context.capabilities.every(
        (capability) => capability.availability === "AVAILABLE",
      ),
    ).toBe(true);
    expect(Date.parse(context.turnStartedAt)).toBeGreaterThanOrEqual(before);
  });

  it("verifies a supplied conversation against both actor and Brand", async () => {
    const id = "0198f719-8b92-7000-8000-000000000001";
    const { service, getConversationForScope } = fixture({ id });
    await expect(
      service.assemble(actor, { conversationId: id, surface: "HOME" }),
    ).resolves.toMatchObject({ conversation: { id } });
    expect(getConversationForScope).toHaveBeenCalledWith(
      { brandProfileId: "brand-a", userId: "user-a" },
      id,
      { includeArchived: true },
    );

    const denied = fixture(null).service;
    await expect(
      denied.assemble(actor, { conversationId: id, surface: "HOME" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
