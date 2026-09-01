import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { GeminiJsonClient } from "../../brand-onboarding/integrations/gemini/gemini-json.client";
import { CHAT_CAPABILITY_CATALOG } from "../capabilities/chat-capability.catalog";
import { ChatCapabilityRegistry } from "../capabilities/chat-capability.registry";
import { ChatModelGateway } from "./chat-model.gateway";

describe("ChatModelGateway", () => {
  function fixture(result: unknown) {
    const generateJson = vi.fn().mockResolvedValue(result);
    const gateway = new ChatModelGateway(
      { generateJson } as unknown as GeminiJsonClient,
      new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG),
    );
    return { gateway, generateJson };
  }

  it("accepts only a server-allowed capability with registry-valid input", async () => {
    const { gateway, generateJson } = fixture({
      requests: [
        { capabilityId: "offering.read", input: { offeringId: "o-1" } },
      ],
    });
    await expect(
      gateway.planCapabilities({
        userRequest: "Show this offering",
        allowedCapabilityIds: ["offering.read"],
        contextHints: { routePath: "/offerings/o-1" },
      }),
    ).resolves.toEqual({
      requests: [
        { capabilityId: "offering.read", input: { offeringId: "o-1" } },
      ],
    });
    const call = generateJson.mock.calls[0][0];
    expect(JSON.parse(call.userText).allowedCapabilityIds).toEqual([
      "offering.read",
    ]);
    expect(call).not.toHaveProperty("apiKey");
    expect(call.systemInstruction).not.toContain("GEMINI_API_KEY");
  });

  it("rejects disallowed IDs, authority injection, and reasoning fields", async () => {
    const disallowed = fixture({
      requests: [
        { capabilityId: "campaign.read", input: { campaignId: "c-1" } },
      ],
    }).gateway;
    await expect(
      disallowed.planCapabilities({
        userRequest: "read",
        allowedCapabilityIds: ["brand.current.read"],
        contextHints: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const injected = fixture({
      requests: [
        {
          capabilityId: "offering.read",
          input: { offeringId: "o-1", userId: "attacker", role: "ADMIN" },
        },
      ],
    }).gateway;
    await expect(
      injected.planCapabilities({
        userRequest: "read",
        allowedCapabilityIds: ["offering.read"],
        contextHints: {},
      }),
    ).rejects.toThrow();

    const reasoning = fixture({ requests: [], rationale: "hidden" }).gateway;
    await expect(
      reasoning.planCapabilities({
        userRequest: "read",
        allowedCapabilityIds: [],
        contextHints: {},
      }),
    ).rejects.toThrow();

    const authorityHint = fixture({ requests: [] }).gateway;
    await expect(
      authorityHint.planCapabilities({
        userRequest: "read",
        allowedCapabilityIds: [],
        contextHints: { userId: "attacker", brandProfileId: "foreign" },
      }),
    ).rejects.toThrow();
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
});
