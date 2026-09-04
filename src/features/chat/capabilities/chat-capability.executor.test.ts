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

  it.each([
    {
      capabilityId: "workspace.readiness.read",
      data: {
        contractVersion: "1.0",
        brandId: "brand-1",
        observedAt: new Date(0).toISOString(),
        workspace: { state: "READY", reasonCodes: [] },
        subscription: {
          state: "FULL_ACCESS",
          lifecycleStatus: "ACTIVE",
          requiredAction: "NONE",
        },
        applicationCapabilities: [],
        billing: {
          state: "READY",
          missingFieldCodes: [],
          recoveryDestinationId: null,
        },
        setupItems: [],
        limitations: [],
      },
    },
    {
      capabilityId: "provider.readiness.read",
      data: {
        contractVersion: "1.0",
        brandId: "brand-1",
        observedAt: new Date(0).toISOString(),
        providers: [
          {
            provider: "INSTAGRAM",
            state: "READY",
            reasonCode: "INSTAGRAM_READY",
            affectedProductCapabilities: [],
            humanActionRequired: false,
            recoveryDestinationId: null,
            freshness: "CURRENT",
          },
        ],
        limitations: [],
      },
    },
    {
      capabilityId: "campaign.list",
      data: [
        {
          campaign_id: "campaign-1",
          campaign_name: "Summer Launch",
          current_status: "LIVE",
          core_objective: null,
          product_count: 1,
          brief_count: 1,
          prospects_count: 0,
          applicants_count: 0,
          active_collabs_count: 1,
          total_spend_to_date: 0,
          total_impressions: "0",
          budget_pool: 100,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString(),
        },
      ],
    },
    {
      capabilityId: "collaboration.list",
      data: {
        collaborations: [
          {
            collaborationId: "collaboration-1",
            campaign: { id: "campaign-1", name: "Summer Launch" },
            brief: { id: "brief-1", title: "Launch brief" },
            campaignProduct: null,
            creator: { displayName: "Creator", instagramHandle: null },
            lifecycle: {
              stage: "STAGE_1_NEGOTIATION",
              status: "ACTIVE_WORKFLOW",
              phase: "INBOUND_INVITE",
              paused: false,
              terminated: false,
            },
            attention: {
              health: "ON_TRACK",
              actionRequiredBy: "NONE",
              reasonCodes: [],
              dueAt: new Date(0).toISOString(),
            },
            unreadCount: 0,
            lastMessageSnippet: null,
            lastMessageAt: null,
            stageUpdatedAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
        ],
      },
    },
  ])(
    "adds one stable opaque result ref to available $capabilityId data",
    async ({ capabilityId, data }) => {
      const test = executor(async () => ({
        capabilityId,
        availability: "AVAILABLE",
        data,
        grounding: [
          {
            sourceType: "CANONICAL",
            capabilityId,
            entityRefs: [{ type: "BRAND", id: "brand-1" }],
          },
        ],
        authorizedEntityRefs: [{ type: "BRAND", id: "brand-1" }],
      }));

      const first = await test.executor.execute(context, capabilityId, {});
      const second = await test.executor.execute(context, capabilityId, {});
      const firstRef = first.grounding[0]?.resultRefs?.[0];
      expect(firstRef).toMatch(
        new RegExp(`^canonical:${capabilityId}:[a-f0-9]{64}$`, "u"),
      );
      expect(firstRef?.length).toBeLessThanOrEqual(128);
      expect(second.grounding[0]?.resultRefs).toEqual([firstRef]);
    },
  );

  it("preserves existing Intelligence semantic result refs exactly", async () => {
    const semanticRef = "result:brand-1:differentiation_and_proof";
    const test = executor(async () => ({
      capabilityId: "brand_intelligence.current.read",
      availability: "AVAILABLE",
      data: {
        contractVersion: "1.0",
        engineId: "brand_intelligence",
        subject: { type: "BRAND", id: "brand-1" },
        objects: [
          {
            objectId: "object-1",
            objectState: "CURRENT",
            current: { kind: "VALUE", resultRef: semanticRef },
            readiness: "READY",
            resultReadiness: "READY",
            freshness: "CURRENT",
            changedAt: new Date(0).toISOString(),
            authority: "creator_shop",
          },
        ],
        capabilityAvailability: { status: "AVAILABLE" },
        domainPayloadVersion: "1.0",
        domainPayload: {},
      },
      grounding: [
        {
          sourceType: "INTELLIGENCE",
          capabilityId: "brand_intelligence.current.read",
          entityRefs: [{ type: "BRAND", id: "brand-1" }],
          resultRefs: [semanticRef],
        },
      ],
      authorizedEntityRefs: [{ type: "BRAND", id: "brand-1" }],
    }));

    const result = await test.executor.execute(
      context,
      "brand_intelligence.current.read",
      {},
    );
    expect(result.grounding[0]?.resultRefs).toEqual([semanticRef]);
  });

  it("does not create fallback result refs for NAVIGATE capabilities", async () => {
    const test = executor(async () => ({
      capabilityId: "app.navigate",
      availability: "AVAILABLE",
      data: { destinationId: "SETTINGS" },
      grounding: [],
      authorizedEntityRefs: [],
      navigation: { destinationId: "SETTINGS" },
    }));

    const result = await test.executor.execute(context, "app.navigate", {
      destinationId: "SETTINGS",
    });
    expect(result.grounding).toEqual([]);
  });
});
