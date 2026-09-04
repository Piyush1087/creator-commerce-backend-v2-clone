import { BadRequestException } from "@nestjs/common";
import { SchemaType } from "@google/generative-ai";
import { describe, expect, it, vi } from "vitest";

import type { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { CHAT_CAPABILITY_CATALOG } from "../capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import { ChatModelGateway } from "./chat-model.gateway";
import { ChatCapabilityPlanSchema } from "./chat-model.schema";
import { ChatAuthorizedEntityCandidateSchema } from "./chat-model.schema";

describe("ChatModelGateway", () => {
  const planningContext = {
    clientContextHints: {},
    conversationExcerpt: [],
    serverContext: {
      planningPass: 1 as const,
      authorizedEntityCandidates: [],
      alreadyInvokedCapabilities: [],
    },
  };

  function fixture(...results: unknown[]) {
    const generateJson = vi.fn();
    for (const result of results) {
      generateJson.mockResolvedValueOnce(result);
    }
    const gateway = new ChatModelGateway(
      { generateJson } as unknown as GeminiJsonClient,
      new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG),
    );
    return { gateway, generateJson };
  }

  it("adds only Collaboration to materializable candidate vocabulary", () => {
    expect(
      ChatAuthorizedEntityCandidateSchema.parse({
        type: "COLLABORATION",
        id: "workflow-collaboration-1",
      }),
    ).toEqual({
      type: "COLLABORATION",
      id: "workflow-collaboration-1",
    });
    for (const type of ["SETTINGS", "PROVIDER"]) {
      expect(
        ChatAuthorizedEntityCandidateSchema.safeParse({ type, id: "x" })
          .success,
      ).toBe(false);
    }
  });

  it("filters Stage A to capabilities materializable from current server authority", async () => {
    const { gateway, generateJson } = fixture({ capabilityIds: [] });
    const allowedCapabilityIds = [
      "workspace.context.read",
      "offering.list",
      "offering.read",
      "product_intelligence.current.read",
      "campaign.list",
      "campaign.read",
      "app.navigate",
    ];

    await expect(
      gateway.planCapabilities({
        userRequest: "Inspect my workspace",
        allowedCapabilityIds,
        ...planningContext,
      }),
    ).resolves.toEqual({ requests: [] });

    expect(generateJson).toHaveBeenCalledTimes(1);
    const call = generateJson.mock.calls[0][0];
    expect(call.responseSchema).toEqual({
      type: SchemaType.OBJECT,
      properties: {
        capabilityIds: {
          type: SchemaType.ARRAY,
          maxItems: 10,
          items: {
            type: SchemaType.STRING,
            enum: [
              "workspace.context.read",
              "offering.list",
              "campaign.list",
              "app.navigate",
            ],
          },
        },
      },
      required: ["capabilityIds"],
    });
    expect(JSON.parse(call.userText).selectableCapabilityIds).toEqual([
      "workspace.context.read",
      "offering.list",
      "campaign.list",
      "app.navigate",
    ]);
    expect(call).not.toHaveProperty("apiKey");
    expect(call.systemInstruction).not.toContain("GEMINI_API_KEY");
    expect(call.systemInstruction).toContain(
      "app.navigate may omit an entity only for a generic destination request",
    );
  });

  it("returns an empty plan without a provider call when nothing is selectable", async () => {
    const { gateway, generateJson } = fixture();

    await expect(
      gateway.planCapabilities({
        userRequest: "Read an unavailable entity",
        allowedCapabilityIds: ["offering.read", "campaign.read"],
        ...planningContext,
      }),
    ).resolves.toEqual({ requests: [] });
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("uses required offering input schemas and authorized offering enums on pass two", async () => {
    const { gateway, generateJson } = fixture(
      {
        capabilityIds: ["offering.read", "product_intelligence.current.read"],
      },
      { offeringId: "o-1" },
      { offeringId: "o-1" },
    );
    const serverContext = {
      planningPass: 2 as const,
      authorizedEntityCandidates: [
        { type: "OFFERING" as const, id: "o-1", label: "Creator Shop" },
      ],
      alreadyInvokedCapabilities: [
        { capabilityId: "offering.list", input: {} },
      ],
    };

    await expect(
      gateway.planCapabilities({
        userRequest: "What do you know about my products?",
        allowedCapabilityIds: [
          "offering.read",
          "product_intelligence.current.read",
        ],
        clientContextHints: {},
        conversationExcerpt: [],
        serverContext,
      }),
    ).resolves.toEqual({
      requests: [
        { capabilityId: "offering.read", input: { offeringId: "o-1" } },
        {
          capabilityId: "product_intelligence.current.read",
          input: { offeringId: "o-1" },
        },
      ],
    });

    expect(generateJson).toHaveBeenCalledTimes(3);
    for (const callIndex of [1, 2]) {
      const responseSchema =
        generateJson.mock.calls[callIndex][0].responseSchema;
      expect(responseSchema.type).toBe(SchemaType.OBJECT);
      expect(responseSchema.required).toEqual(["offeringId"]);
      expect(responseSchema.properties.offeringId.enum).toEqual(["o-1"]);
    }
    expect(JSON.parse(generateJson.mock.calls[1][0].userText)).toEqual({
      userRequest: "What do you know about my products?",
      capabilityId: "offering.read",
      clientContextHints: {},
      conversationExcerpt: [],
      serverContext,
      alreadyMaterializedRequests: [],
    });
    expect(
      JSON.parse(generateJson.mock.calls[2][0].userText)
        .alreadyMaterializedRequests,
    ).toEqual([
      { capabilityId: "offering.read", input: { offeringId: "o-1" } },
    ]);
  });

  it("makes campaign.read selectable and constrains its required campaignId", async () => {
    const { gateway, generateJson } = fixture(
      { capabilityIds: ["campaign.read"] },
      { campaignId: "c-1" },
    );

    await expect(
      gateway.planCapabilities({
        userRequest: "Read the campaign",
        allowedCapabilityIds: ["campaign.read"],
        clientContextHints: {},
        conversationExcerpt: [],
        serverContext: {
          planningPass: 2,
          authorizedEntityCandidates: [
            { type: "CAMPAIGN", id: "c-1", label: "Summer Launch" },
          ],
          alreadyInvokedCapabilities: [],
        },
      }),
    ).resolves.toEqual({
      requests: [
        { capabilityId: "campaign.read", input: { campaignId: "c-1" } },
      ],
    });

    const selectionEnum =
      generateJson.mock.calls[0][0].responseSchema.properties.capabilityIds
        .items.enum;
    expect(selectionEnum).toEqual(["campaign.read"]);
    const responseSchema = generateJson.mock.calls[1][0].responseSchema;
    expect(responseSchema.required).toEqual(["campaignId"]);
    expect(responseSchema.properties.campaignId.enum).toEqual(["c-1"]);
  });

  it("keeps Collaboration exact reads off pass one while list and readiness reads remain selectable", async () => {
    const { gateway, generateJson } = fixture({ capabilityIds: [] });
    await gateway.planCapabilities({
      userRequest: "Check collaborations and readiness",
      allowedCapabilityIds: [
        "collaboration.list",
        "collaboration.read",
        "workspace.readiness.read",
        "provider.readiness.read",
      ],
      ...planningContext,
    });
    expect(
      generateJson.mock.calls[0][0].responseSchema.properties.capabilityIds
        .items.enum,
    ).toEqual([
      "collaboration.list",
      "workspace.readiness.read",
      "provider.readiness.read",
    ]);
  });

  it("materializes collaboration.read only from authorized workflow IDs on pass two", async () => {
    const { gateway, generateJson } = fixture(
      { capabilityIds: ["collaboration.read"] },
      { collaborationId: "workflow-collaboration-1" },
    );
    const serverContext = {
      planningPass: 2 as const,
      authorizedEntityCandidates: [
        {
          type: "COLLABORATION" as const,
          id: "workflow-collaboration-1",
          label: "Summer Launch — Creator — Launch brief",
        },
        { type: "CAMPAIGN" as const, id: "campaign-1" },
      ],
      alreadyInvokedCapabilities: [
        { capabilityId: "collaboration.list", input: {} },
      ],
    };
    await expect(
      gateway.planCapabilities({
        userRequest: "Read the Creator collaboration",
        allowedCapabilityIds: ["collaboration.read"],
        clientContextHints: {},
        conversationExcerpt: [],
        serverContext,
      }),
    ).resolves.toEqual({
      requests: [
        {
          capabilityId: "collaboration.read",
          input: { collaborationId: "workflow-collaboration-1" },
        },
      ],
    });
    const responseSchema = generateJson.mock.calls[1][0].responseSchema;
    expect(responseSchema.required).toEqual(["collaborationId"]);
    expect(responseSchema.properties.collaborationId.enum).toEqual([
      "workflow-collaboration-1",
    ]);
  });

  it("supports generic Settings and authorized named Collaboration navigation", async () => {
    const generic = fixture(
      { capabilityIds: ["app.navigate"] },
      { destinationId: "SETTINGS" },
    );
    await expect(
      generic.gateway.planCapabilities({
        userRequest: "Open settings",
        allowedCapabilityIds: ["app.navigate"],
        ...planningContext,
      }),
    ).resolves.toEqual({
      requests: [
        { capabilityId: "app.navigate", input: { destinationId: "SETTINGS" } },
      ],
    });

    const named = fixture(
      { capabilityIds: ["app.navigate"] },
      {
        destinationId: "COLLABORATIONS",
        entity: {
          type: "COLLABORATION",
          id: "workflow-collaboration-1",
        },
      },
    );
    await expect(
      named.gateway.planCapabilities({
        userRequest: "Open the Creator collaboration",
        allowedCapabilityIds: ["app.navigate"],
        clientContextHints: {},
        conversationExcerpt: [],
        serverContext: {
          planningPass: 2,
          authorizedEntityCandidates: [
            { type: "COLLABORATION", id: "workflow-collaboration-1" },
          ],
          alreadyInvokedCapabilities: [],
        },
      }),
    ).resolves.toMatchObject({
      requests: [
        {
          capabilityId: "app.navigate",
          input: {
            destinationId: "COLLABORATIONS",
            entity: {
              type: "COLLABORATION",
              id: "workflow-collaboration-1",
            },
          },
        },
      ],
    });
    expect(
      named.generateJson.mock.calls[1][0].responseSchema.properties.entity
        .properties.id.enum,
    ).toEqual(["workflow-collaboration-1"]);
  });

  it("skips materialization calls for valid empty capability inputs", async () => {
    const capabilityIds = [
      "workspace.context.read",
      "brand.current.read",
      "campaign.list",
    ];
    const { gateway, generateJson } = fixture({ capabilityIds });

    const plan = await gateway.planCapabilities({
      userRequest: "Summarize my workspace",
      allowedCapabilityIds: capabilityIds,
      ...planningContext,
    });

    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(plan).toEqual({
      requests: capabilityIds.map((capabilityId) => ({
        capabilityId,
        input: {},
      })),
    });
    expect(ChatCapabilityPlanSchema.parse(plan)).toEqual(plan);
  });

  it("preserves duplicate selections and supplies prior materializations", async () => {
    const { gateway, generateJson } = fixture(
      { capabilityIds: ["offering.read", "offering.read"] },
      { offeringId: "o-1" },
      { offeringId: "o-2" },
    );

    await expect(
      gateway.planCapabilities({
        userRequest: "Compare both products",
        allowedCapabilityIds: ["offering.read"],
        clientContextHints: {},
        conversationExcerpt: [],
        serverContext: {
          planningPass: 2,
          authorizedEntityCandidates: [
            { type: "OFFERING", id: "o-1" },
            { type: "OFFERING", id: "o-2" },
          ],
          alreadyInvokedCapabilities: [],
        },
      }),
    ).resolves.toEqual({
      requests: [
        { capabilityId: "offering.read", input: { offeringId: "o-1" } },
        { capabilityId: "offering.read", input: { offeringId: "o-2" } },
      ],
    });
    expect(generateJson).toHaveBeenCalledTimes(3);
    expect(
      JSON.parse(generateJson.mock.calls[2][0].userText)
        .alreadyMaterializedRequests,
    ).toEqual([
      { capabilityId: "offering.read", input: { offeringId: "o-1" } },
    ]);
  });

  it("materializes navigation with required destination and optional constrained entity", async () => {
    const { gateway, generateJson } = fixture(
      { capabilityIds: ["app.navigate"] },
      {
        destinationId: "CAMPAIGNS",
        entity: { type: "CAMPAIGN", id: "c-1" },
      },
    );

    await expect(
      gateway.planCapabilities({
        userRequest: "Open the campaign",
        allowedCapabilityIds: ["app.navigate"],
        clientContextHints: {},
        conversationExcerpt: [],
        serverContext: {
          planningPass: 2,
          authorizedEntityCandidates: [
            { type: "BRAND", id: "b-1" },
            { type: "CAMPAIGN", id: "c-1" },
          ],
          alreadyInvokedCapabilities: [],
        },
      }),
    ).resolves.toEqual({
      requests: [
        {
          capabilityId: "app.navigate",
          input: {
            destinationId: "CAMPAIGNS",
            entity: { type: "CAMPAIGN", id: "c-1" },
          },
        },
      ],
    });

    const responseSchema = generateJson.mock.calls[1][0].responseSchema;
    expect(responseSchema.required).toEqual(["destinationId"]);
    expect(responseSchema.required).not.toContain("entity");
    expect(responseSchema.properties.entity.required).toEqual(["type", "id"]);
    expect(responseSchema.properties.entity.properties.id.enum).toEqual([
      "b-1",
      "c-1",
    ]);
    expect(generateJson.mock.calls[1][0].systemInstruction).toContain(
      "include its optional entity when the user names a specific entity",
    );
  });

  it("rejects malformed and authority-injected materialized inputs", async () => {
    const context = {
      userRequest: "Read the offering",
      allowedCapabilityIds: ["offering.read"],
      clientContextHints: {},
      conversationExcerpt: [],
      serverContext: {
        planningPass: 2 as const,
        authorizedEntityCandidates: [{ type: "OFFERING" as const, id: "o-1" }],
        alreadyInvokedCapabilities: [],
      },
    };

    const missing = fixture({ capabilityIds: ["offering.read"] }, {}).gateway;
    await expect(missing.planCapabilities(context)).rejects.toThrow();

    const injected = fixture(
      { capabilityIds: ["offering.read"] },
      { offeringId: "o-1", userId: "attacker" },
    ).gateway;
    await expect(injected.planCapabilities(context)).rejects.toThrow();
  });

  it("rejects invalid or non-strict Stage A selections", async () => {
    const invalid = fixture({
      capabilityIds: ["campaign.list"],
    }).gateway;
    await expect(
      invalid.planCapabilities({
        userRequest: "Read",
        allowedCapabilityIds: ["brand.current.read"],
        ...planningContext,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const rationale = fixture({
      capabilityIds: [],
      rationale: "hidden",
    }).gateway;
    await expect(
      rationale.planCapabilities({
        userRequest: "Read",
        allowedCapabilityIds: ["brand.current.read"],
        ...planningContext,
      }),
    ).rejects.toThrow();

    const tooMany = fixture({
      capabilityIds: Array.from({ length: 11 }, () => "brand.current.read"),
    }).gateway;
    await expect(
      tooMany.planCapabilities({
        userRequest: "Read",
        allowedCapabilityIds: ["brand.current.read"],
        ...planningContext,
      }),
    ).rejects.toThrow();
  });

  it("rejects user-controlled authority hints before selection", async () => {
    const { gateway, generateJson } = fixture({ capabilityIds: [] });

    await expect(
      gateway.planCapabilities({
        userRequest: "Read",
        allowedCapabilityIds: ["brand.current.read"],
        ...planningContext,
        clientContextHints: {
          userId: "attacker",
          brandProfileId: "foreign",
        },
      }),
    ).rejects.toThrow();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("returns a bounded synthesis draft without accepting grounding authority", async () => {
    const { gateway, generateJson } = fixture({
      answer: "Grounded answer",
      freshnessNotes: [],
      limitations: ["No current campaign"],
    });
    await expect(
      gateway.synthesize({
        userRequest: "What is current?",
        authorizedCapabilityResults: [
          { capabilityId: "brand.current.read", value: {} },
        ],
        sanitizedConversationContext: { recentMessages: [] },
        responseConstraints: { maxLength: 2000 },
      }),
    ).resolves.toMatchObject({ answer: "Grounded answer" });
    expect(JSON.parse(generateJson.mock.calls[0][0].userText)).toEqual({
      userRequest: "What is current?",
      authorizedCapabilityResults: [
        { capabilityId: "brand.current.read", value: {} },
      ],
      sanitizedConversationContext: { recentMessages: [] },
      responseConstraints: { maxLength: 2000 },
    });
    const responseSchema = generateJson.mock.calls[0][0].responseSchema;
    expect(responseSchema.type).toBe(SchemaType.OBJECT);
    expect(Object.keys(responseSchema.properties).sort()).toEqual([
      "answer",
      "freshnessNotes",
      "limitations",
      "recommendation",
    ]);
    expect(responseSchema.properties.recommendation.properties).toMatchObject({
      basisRefs: { type: SchemaType.ARRAY },
      nonMutating: { type: SchemaType.BOOLEAN },
    });
    expect(generateJson.mock.calls[0][0].systemInstruction).toContain(
      "basisRefs must contain at least one exact resultRef",
    );
    expect(generateJson.mock.calls[0][0].systemInstruction).toContain(
      "Never claim that you updated",
    );

    const invented = fixture({
      answer: "draft",
      freshnessNotes: [],
      limitations: [],
      grounding: [{ capabilityId: "fake" }],
    }).gateway;
    await expect(
      invented.synthesize({
        userRequest: "x",
        authorizedCapabilityResults: [],
        sanitizedConversationContext: {},
        responseConstraints: {},
      }),
    ).rejects.toThrow();
  });

  it("rejects a synthesized recommendation with an empty basis", async () => {
    const { gateway } = fixture({
      answer: "Review workspace readiness.",
      freshnessNotes: [],
      limitations: [],
      recommendation: {
        text: "Review workspace readiness.",
        basisRefs: [],
        nonMutating: true,
      },
    });

    await expect(
      gateway.synthesize({
        userRequest: "What should I focus on?",
        authorizedCapabilityResults: [
          {
            capabilityId: "workspace.readiness.read",
            resultRefs: ["canonical:workspace.readiness.read:hash"],
            data: {},
          },
        ],
        sanitizedConversationContext: { recentMessages: [] },
        responseConstraints: { useOnlyAuthorizedResults: true },
      }),
    ).rejects.toThrow();
  });
});
