import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../auth/types/auth-user";
import type { BrandConsumerService } from "../brand-centre/consumer/brand-consumer.service";
import type { ProductConsumerService } from "../brand-centre/consumer/product-consumer.service";
import { BrandIntelligenceConsumerAdapter } from "./adapters/brand-intelligence-consumer.adapter";
import { ProductIntelligenceConsumerAdapter } from "./adapters/product-intelligence-consumer.adapter";
import type { EngineConsumerRegistration } from "./intelligence-consumer.contract";
import { IntelligenceConsumerRegistry } from "./intelligence-consumer.registry";

const actor: AuthUser = {
  id: "user-1",
  email: "actor@example.test",
  name: null,
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

function registrations() {
  const brand = new BrandIntelligenceConsumerAdapter({
    read: vi.fn(),
  } as unknown as BrandConsumerService);
  const product = new ProductIntelligenceConsumerAdapter({
    read: vi.fn(),
  } as unknown as ProductConsumerService);
  return { brand, product };
}

describe("Intelligence engine registry", () => {
  it("registers only the two domain engines with exact subject and object ownership", () => {
    const { brand, product } = registrations();
    const registry = new IntelligenceConsumerRegistry([brand, product]);

    expect(registry.list().map((entry) => entry.engineId)).toEqual([
      "brand_intelligence",
      "product_intelligence",
    ]);
    expect(registry.get("brand_intelligence")).toMatchObject({
      registrationVersion: "1.0",
      supportedSubjectTypes: ["BRAND"],
      objectIds: expect.arrayContaining(["brand_description"]),
    });
    expect(registry.get("brand_intelligence").objectIds).toHaveLength(10);
    expect(registry.get("product_intelligence")).toMatchObject({
      registrationVersion: "1.0",
      supportedSubjectTypes: ["OFFERING"],
      objectIds: [
        "offering_factual_profile",
        "offering_creator_communication_profile",
        "offering_actionability_profile",
      ],
    });
  });

  it("rejects duplicate and unknown engine registrations", () => {
    const { brand } = registrations();
    expect(() => new IntelligenceConsumerRegistry([brand, brand])).toThrow(
      "Duplicate Intelligence engine registration",
    );
    const registry = new IntelligenceConsumerRegistry([brand]);
    expect(() => registry.get("universal_intelligence")).toThrow(
      "Unknown Intelligence engine",
    );
  });

  it.each([
    ["brand_intelligence", { type: "OFFERING" as const, id: "offering-1" }],
    ["product_intelligence", { type: "BRAND" as const, id: "brand-1" }],
  ])(
    "rejects unsupported subject routing for %s",
    async (engineId, subject) => {
      const { brand, product } = registrations();
      const registry = new IntelligenceConsumerRegistry([brand, product]);
      await expect(registry.read(actor, engineId, subject)).rejects.toThrow(
        "does not support",
      );
    },
  );

  it("dispatches an exact actor and subject without fuzzy engine selection", async () => {
    const subject = { type: "BRAND" as const, id: "brand-1" };
    const read = vi.fn().mockResolvedValue({ engine: "brand" });
    const registration = {
      registrationVersion: "1.0",
      engineId: "brand_intelligence",
      supportedSubjectTypes: ["BRAND"],
      objectIds: ["brand_description"],
      domainPayloadVersion: "1.0",
      read,
      resolveAvailability: vi.fn(),
    } as unknown as EngineConsumerRegistration;
    const registry = new IntelligenceConsumerRegistry([registration]);

    await registry.read(actor, "brand_intelligence", subject);
    expect(read).toHaveBeenCalledWith(actor, subject);
  });
});
