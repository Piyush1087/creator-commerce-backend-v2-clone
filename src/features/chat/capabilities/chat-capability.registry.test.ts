import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import {
  CHAT_CAPABILITY_CATALOG,
  CHAT_FIRST_SLICE_CAPABILITY_IDS,
} from "./chat-capability.catalog";
import type { ChatCapabilityDescriptor } from "./chat-capability.contract";
import { ChatCapabilityRegistry } from "./chat-capability.registry";

describe("ChatCapabilityRegistry", () => {
  const registry = new ChatCapabilityRegistry(CHAT_CAPABILITY_CATALOG);

  it("freezes exactly nine available implemented first-slice capabilities", () => {
    expect(registry.list().map((descriptor) => descriptor.id)).toEqual(
      CHAT_FIRST_SLICE_CAPABILITY_IDS,
    );
    expect(registry.list()).toHaveLength(9);
    expect(
      registry
        .list()
        .every(
          (descriptor) =>
            descriptor.implementationState === "IMPLEMENTED" &&
            descriptor.availability === "AVAILABLE" &&
            descriptor.risk === "NON_CONSEQUENTIAL" &&
            descriptor.confirmation === "NOT_REQUIRED" &&
            typeof descriptor.outputSchema?.parse === "function",
        ),
    ).toBe(true);
    expect(
      registry.list().filter((descriptor) => descriptor.class === "EXECUTE"),
    ).toEqual([]);
  });

  it("rejects duplicate and invalid descriptors", () => {
    expect(
      () =>
        new ChatCapabilityRegistry([
          CHAT_CAPABILITY_CATALOG[0],
          CHAT_CAPABILITY_CATALOG[0],
        ]),
    ).toThrow(/Duplicate Chat capability id/);
    expect(
      () =>
        new ChatCapabilityRegistry([
          {
            ...CHAT_CAPABILITY_CATALOG[0],
            id: "",
          } as ChatCapabilityDescriptor,
        ]),
    ).toThrow(/Invalid Chat capability descriptor/);
  });

  it("fails closed for unknown IDs, invalid inputs, and authority injection", () => {
    expect(() => registry.get("offering.lsit")).toThrow(BadRequestException);
    expect(() => registry.validateInput("offering.read", {})).toThrow();
    expect(() =>
      registry.validateInput("offering.read", {
        offeringId: "offering-1",
        userId: "attacker",
      }),
    ).toThrow();
    expect(() =>
      registry.validateInput("workspace.context.read", {
        brandId: "foreign",
      }),
    ).toThrow();
    expect(
      registry.validateInput("campaign.read", { campaignId: "c-1" }),
    ).toEqual({
      campaignId: "c-1",
    });
  });
});
