import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../auth/types/auth-user";
import type { ChatCapabilityExecutionResult } from "../capabilities/chat-capability-handler.contract";
import type { ChatCapabilityExecutor } from "../capabilities/chat-capability.executor";
import { CHAT_CAPABILITY_CATALOG } from "../capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import type { ChatContextService } from "../context/chat-context.service";
import type { ChatConversationService } from "../conversation/chat-conversation.service";
import type { ChatModelGateway } from "../model/chat-model.gateway";
import { ChatResponseValidationService } from "../response/chat-response-validation.service";
import type { ChatTelemetryService } from "../telemetry/chat-telemetry.service";
import {
  CHAT_HISTORY_MAX_MESSAGES,
  CHAT_HISTORY_MAX_TOTAL_CHARS,
  CHAT_MAX_DISTINCT_EXECUTIONS,
  ChatTurnOrchestratorService,
} from "./chat-turn-orchestrator.service";

const actor: AuthUser = {
  id: "user-1",
  email: "user@example.test",
  name: "User",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

const context = {
  actor: { userId: actor.id, role: actor.role },
  workspace: { brandProfileId: "brand-1", membershipRole: "BRAND_OWNER" },
  conversation: { id: "11111111-1111-4111-8111-111111111111" },
  surface: { kind: "HOME" as const },
  requestHints: {
    routePath: "/campaigns/foreign-hint",
    selectedEntity: { type: "CAMPAIGN", id: "foreign-hint" },
  },
  capabilities: CHAT_CAPABILITY_CATALOG.map((capability) => ({
    capabilityId: capability.id,
    availability: capability.availability,
  })),
  canonicalRefs: [{ type: "BRAND" as const, id: "brand-1" }],
  intelligenceRefs: [],
  providerReadiness: [] as const,
  turnStartedAt: new Date(0).toISOString(),
};

const canonicalResult = (
  capabilityId: string,
  type: "BRAND" | "OFFERING" | "CAMPAIGN",
  id: string,
  data: unknown,
): ChatCapabilityExecutionResult => ({
  capabilityId,
  availability: "AVAILABLE",
  data,
  grounding: [
    {
      sourceType: "CANONICAL",
      capabilityId,
      entityRefs: [{ type, id }],
    },
  ],
  authorizedEntityRefs: [{ type, id }],
});

const intelligenceData = (
  engineId: "brand_intelligence" | "product_intelligence",
  subject: { type: "BRAND" | "OFFERING"; id: string },
) => ({
  contractVersion: "1.0",
  engineId,
  subject,
  objects: [
    {
      objectId: "object-1",
      current: { kind: "VALUE", resultRef: `result:${subject.id}` },
      readiness: "READY",
      freshness: "CURRENT",
      authority: "creator_shop",
    },
  ],
  capabilityAvailability: { status: "AVAILABLE" },
  domainPayloadVersion: "1.0",
  domainPayload: {},
});

function fixture(options: {
  plans: readonly { requests: { capabilityId: string; input: object }[] }[];
  history?: readonly { role: string; textContent: string | null }[];
  override?: (
    capabilityId: string,
    input: Record<string, unknown>,
    authorized: readonly { type: string; id: string }[],
  ) => ChatCapabilityExecutionResult | undefined;
}) {
  const planCapabilities = vi.fn();
  for (const plan of options.plans) {
    planCapabilities.mockResolvedValueOnce(plan);
  }
  const synthesize = vi.fn().mockResolvedValue({
    answer: "Grounded answer",
    freshnessNotes: [],
    limitations: [],
  });
  const appendAssistantResponse = vi.fn().mockResolvedValue({ id: "message" });
  const execute = vi.fn(
    async (
      executionContext: {
        authorizedEntityRefs: readonly { type: string; id: string }[];
      },
      capabilityId: string,
      input: Record<string, unknown>,
    ): Promise<ChatCapabilityExecutionResult> => {
      const overridden = options.override?.(
        capabilityId,
        input,
        executionContext.authorizedEntityRefs,
      );
      if (overridden) return overridden;
      if (capabilityId === "brand.current.read") {
        return canonicalResult(capabilityId, "BRAND", "brand-1", {
          brandId: "brand-1",
        });
      }
      if (capabilityId === "brand_intelligence.current.read") {
        const data = intelligenceData("brand_intelligence", {
          type: "BRAND",
          id: "brand-1",
        });
        return {
          capabilityId,
          availability: "AVAILABLE",
          data,
          grounding: [
            {
              sourceType: "INTELLIGENCE",
              capabilityId,
              entityRefs: [{ type: "BRAND", id: "brand-1" }],
              resultRefs: ["result:brand-1"],
            },
          ],
          authorizedEntityRefs: [{ type: "BRAND", id: "brand-1" }],
        };
      }
      if (capabilityId === "offering.list") {
        return canonicalResult(capabilityId, "OFFERING", "offering-1", {
          offerings: [
            {
              offeringId: "offering-1",
              name: "Product One",
              kind: "PRODUCT",
              subtype: null,
              lifecycle: "ACTIVE",
            },
          ],
        });
      }
      if (capabilityId === "product_intelligence.current.read") {
        const offeringId = String(input.offeringId);
        if (
          !executionContext.authorizedEntityRefs.some(
            (ref) => ref.type === "OFFERING" && ref.id === offeringId,
          )
        ) {
          return {
            capabilityId,
            availability: "NOT_AUTHORIZED",
            grounding: [],
            authorizedEntityRefs: [],
            limitations: [
              "The requested item is not available in this workspace.",
            ],
          };
        }
        const data = intelligenceData("product_intelligence", {
          type: "OFFERING",
          id: offeringId,
        });
        return {
          capabilityId,
          availability: "AVAILABLE",
          data,
          grounding: [
            {
              sourceType: "INTELLIGENCE",
              capabilityId,
              entityRefs: [{ type: "OFFERING", id: offeringId }],
              resultRefs: [`result:${offeringId}`],
            },
          ],
          authorizedEntityRefs: [{ type: "OFFERING", id: offeringId }],
        };
      }
      if (capabilityId === "campaign.list") {
        return canonicalResult(capabilityId, "CAMPAIGN", "campaign-1", [
          {
            campaign_id: "campaign-1",
            campaign_name: "Summer Launch",
            current_status: "LIVE",
          },
        ]);
      }
      if (capabilityId === "app.navigate") {
        const entity = input.entity as
          | { type: "BRAND" | "OFFERING" | "CAMPAIGN"; id: string }
          | undefined;
        if (
          entity &&
          !executionContext.authorizedEntityRefs.some(
            (ref) => ref.type === entity.type && ref.id === entity.id,
          )
        ) {
          return {
            capabilityId,
            availability: "NOT_AUTHORIZED",
            grounding: [],
            authorizedEntityRefs: [],
            limitations: [
              "The requested item is not available in this workspace.",
            ],
          };
        }
        const navigation = {
          destinationId: String(input.destinationId),
          ...(entity ? { entityRef: entity } : {}),
        };
        return {
          capabilityId,
          availability: "AVAILABLE",
          data: navigation,
          grounding: [],
          authorizedEntityRefs: entity ? [entity] : [],
          navigation,
        };
      }
      throw new Error(`Unconfigured capability ${capabilityId}`);
    },
  );
  const recordTurn = vi.fn();
  const orchestrator = new ChatTurnOrchestratorService(
    {
      assemble: vi.fn().mockResolvedValue(context),
    } as unknown as ChatContextService,
    {
      appendUserMessage: vi.fn().mockResolvedValue({ id: "user-message" }),
      listMessages: vi.fn().mockResolvedValue(options.history ?? []),
      appendAssistantResponse,
    } as unknown as ChatConversationService,
    new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG),
    { execute } as unknown as ChatCapabilityExecutor,
    { planCapabilities, synthesize } as unknown as ChatModelGateway,
    new ChatResponseValidationService(),
    { recordTurn } as unknown as ChatTelemetryService,
  );
  return {
    orchestrator,
    execute,
    planCapabilities,
    synthesize,
    appendAssistantResponse,
    recordTurn,
  };
}

describe("ChatTurnOrchestratorService", () => {
  it("runs the Brand + Product vertical in two bounded passes using discovered Offering IDs", async () => {
    const test = fixture({
      plans: [
        {
          requests: [
            { capabilityId: "brand.current.read", input: {} },
            { capabilityId: "brand_intelligence.current.read", input: {} },
            { capabilityId: "offering.list", input: {} },
          ],
        },
        {
          requests: [
            {
              capabilityId: "product_intelligence.current.read",
              input: { offeringId: "offering-1" },
            },
          ],
        },
      ],
    });
    const response = await test.orchestrator.runTurn(
      actor,
      context.conversation.id,
      { message: "What do you understand about my Brand and Products?" },
    );
    expect(test.planCapabilities).toHaveBeenCalledTimes(2);
    expect(test.planCapabilities.mock.calls[1][0].serverContext).toMatchObject({
      planningPass: 2,
      authorizedEntityCandidates: expect.arrayContaining([
        {
          type: "OFFERING",
          id: "offering-1",
          label: "Product One",
        },
      ]),
    });
    expect(response.status).toBe("ANSWERED");
    expect(response.entityRefs).toContainEqual({
      type: "OFFERING",
      id: "offering-1",
    });
    expect(
      response.grounding.every((item) =>
        test.execute.mock.calls.some((call) => call[1] === item.capabilityId),
      ),
    ).toBe(true);
    expect(test.appendAssistantResponse).toHaveBeenCalledWith(
      actor,
      context.conversation.id,
      response,
    );
  });

  it("fails closed when pass 2 invents an Offering ID", async () => {
    const test = fixture({
      plans: [
        { requests: [{ capabilityId: "offering.list", input: {} }] },
        {
          requests: [
            {
              capabilityId: "product_intelligence.current.read",
              input: { offeringId: "offering-2" },
            },
          ],
        },
      ],
    });
    const response = await test.orchestrator.runTurn(
      actor,
      context.conversation.id,
      { message: "Tell me about offering 2" },
    );
    expect(response.status).toBe("PARTIAL");
    expect(response.entityRefs).not.toContainEqual({
      type: "OFFERING",
      id: "offering-2",
    });
    expect(response.limitations).toContain(
      "The requested item is not available in this workspace.",
    );
  });

  it("reads Campaigns before authorizing a pass-2 Campaign navigation", async () => {
    const test = fixture({
      plans: [
        { requests: [{ capabilityId: "campaign.list", input: {} }] },
        {
          requests: [
            {
              capabilityId: "app.navigate",
              input: {
                destinationId: "CAMPAIGNS",
                entity: { type: "CAMPAIGN", id: "campaign-1" },
              },
            },
          ],
        },
      ],
    });
    const response = await test.orchestrator.runTurn(
      actor,
      context.conversation.id,
      { message: "Open Campaign Summer Launch" },
    );
    expect(test.execute.mock.calls.map((call) => call[1])).toEqual([
      "campaign.list",
      "app.navigate",
    ]);
    expect(response).toMatchObject({
      status: "NAVIGATION",
      navigation: {
        destinationId: "CAMPAIGNS",
        entityRef: { type: "CAMPAIGN", id: "campaign-1" },
      },
    });
    expect(test.synthesize).not.toHaveBeenCalled();
  });

  it("uses a fresh Campaign list and its real status instead of old conversation text", async () => {
    const test = fixture({
      plans: [
        { requests: [{ capabilityId: "campaign.list", input: {} }] },
        { requests: [] },
      ],
      history: [
        {
          role: "ASSISTANT",
          textContent: "Summer Launch is LIVE",
        },
      ],
      override: (capabilityId) =>
        capabilityId === "campaign.list"
          ? canonicalResult(capabilityId, "CAMPAIGN", "campaign-1", [
              {
                campaign_id: "campaign-1",
                campaign_name: "Summer Launch",
                current_status: "PAUSED",
              },
            ])
          : undefined,
    });
    await test.orchestrator.runTurn(actor, context.conversation.id, {
      message: "What Campaigns do I have?",
    });
    expect(test.execute).toHaveBeenCalledWith(
      expect.anything(),
      "campaign.list",
      {},
    );
    expect(
      test.synthesize.mock.calls[0][0].authorizedCapabilityResults,
    ).toEqual([
      {
        capabilityId: "campaign.list",
        data: [
          {
            campaign_id: "campaign-1",
            campaign_name: "Summer Launch",
            current_status: "PAUSED",
          },
        ],
      },
    ]);
  });

  it("does not turn a route hint, history, or model output into navigation authority", async () => {
    const test = fixture({
      plans: [
        {
          requests: [
            {
              capabilityId: "app.navigate",
              input: {
                destinationId: "CAMPAIGNS",
                entity: { type: "CAMPAIGN", id: "foreign-hint" },
              },
            },
          ],
        },
      ],
      history: [
        {
          role: "ASSISTANT",
          textContent: "foreign-hint is a LIVE Campaign",
        },
      ],
    });
    const response = await test.orchestrator.runTurn(
      actor,
      context.conversation.id,
      {
        message: "Open it",
        routePath: "/campaigns/foreign-hint",
        selectedEntity: { type: "CAMPAIGN", id: "foreign-hint" },
      },
    );
    expect(response.status).toBe("NOT_AUTHORIZED");
    expect(response.navigation).toBeUndefined();
    expect(response.entityRefs).toEqual([{ type: "BRAND", id: "brand-1" }]);
  });

  it.each([
    {
      name: "stale",
      expected: "STALE",
      result: {
        ...canonicalResult(
          "brand_intelligence.current.read",
          "BRAND",
          "brand-1",
          intelligenceData("brand_intelligence", {
            type: "BRAND",
            id: "brand-1",
          }),
        ),
        freshnessNotes: [
          "Some current Intelligence used in this answer is stale.",
        ],
        limitations: ["Some Intelligence has no current value."],
      },
    },
    {
      name: "partial",
      expected: "PARTIAL",
      result: {
        ...canonicalResult(
          "brand_intelligence.current.read",
          "BRAND",
          "brand-1",
          intelligenceData("brand_intelligence", {
            type: "BRAND",
            id: "brand-1",
          }),
        ),
        limitations: ["Some Intelligence has no current value."],
      },
    },
    {
      name: "unavailable",
      expected: "CAPABILITY_UNAVAILABLE",
      result: {
        capabilityId: "brand_intelligence.current.read",
        availability: "UNAVAILABLE" as const,
        grounding: [],
        authorizedEntityRefs: [],
        limitations: ["Brand Intelligence is currently unavailable."],
      },
    },
  ])("classifies $name state server-side", async ({ expected, result }) => {
    const test = fixture({
      plans: [
        {
          requests: [
            { capabilityId: "brand_intelligence.current.read", input: {} },
          ],
        },
      ],
      override: (capabilityId) =>
        capabilityId === "brand_intelligence.current.read"
          ? (result as ChatCapabilityExecutionResult)
          : undefined,
    });
    const response = await test.orchestrator.runTurn(
      actor,
      context.conversation.id,
      { message: "What is current?" },
    );
    expect(response.status).toBe(expected);
    if (expected === "STALE") {
      expect(response.freshnessNotes).not.toEqual([]);
    }
  });

  it("deduplicates requests, caps execution at ten, and bounds history", async () => {
    const offerings = Array.from({ length: 10 }, (_, index) => ({
      offeringId: `offering-${index + 1}`,
      name: `Offering ${index + 1}`,
      kind: "PRODUCT",
      subtype: null,
      lifecycle: "ACTIVE",
    }));
    const history = Array.from({ length: 20 }, (_, index) => ({
      role: index % 2 ? "ASSISTANT" : "USER",
      textContent: "x".repeat(2_000),
    }));
    const test = fixture({
      plans: [
        {
          requests: [
            { capabilityId: "offering.list", input: {} },
            { capabilityId: "offering.list", input: {} },
          ],
        },
        {
          requests: offerings.map((offering) => ({
            capabilityId: "product_intelligence.current.read",
            input: { offeringId: offering.offeringId },
          })),
        },
      ],
      history,
      override: (capabilityId) =>
        capabilityId === "offering.list"
          ? {
              capabilityId,
              availability: "AVAILABLE",
              data: { offerings },
              grounding: [],
              authorizedEntityRefs: offerings.map((offering) => ({
                type: "OFFERING",
                id: offering.offeringId,
              })),
            }
          : undefined,
    });
    await test.orchestrator.runTurn(actor, context.conversation.id, {
      message: "Read all products",
    });
    expect(test.planCapabilities).toHaveBeenCalledTimes(2);
    expect(test.execute).toHaveBeenCalledTimes(CHAT_MAX_DISTINCT_EXECUTIONS);
    const excerpt = test.planCapabilities.mock.calls[0][0]
      .conversationExcerpt as { text: string }[];
    expect(excerpt.length).toBeLessThanOrEqual(CHAT_HISTORY_MAX_MESSAGES);
    expect(
      excerpt.reduce((sum, item) => sum + item.text.length, 0),
    ).toBeLessThanOrEqual(CHAT_HISTORY_MAX_TOTAL_CHARS);
  });
});
