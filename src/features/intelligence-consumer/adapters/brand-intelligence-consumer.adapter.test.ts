import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../auth/types/auth-user";
import type { BrandConsumerService } from "../../brand-centre/consumer/brand-consumer.service";
import type { ConsumerIntelligenceField } from "../../brand-centre/consumer/brand-consumer.types";
import type { BrandProcessorRuntimeProjection } from "../../brand-centre/consumer/processor-runtime-projection.types";
import {
  BrandIntelligenceConsumerAdapter,
  type BrandIntelligenceDomainPayload,
} from "./brand-intelligence-consumer.adapter";

const actor: AuthUser = {
  id: "user-1",
  email: "actor@example.test",
  name: "Actor",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

function field(
  semanticId: string,
  options: Partial<ConsumerIntelligenceField> = {},
): ConsumerIntelligenceField {
  return {
    semanticId,
    current: { kind: "VALUE", value: { semanticId, exact: true } },
    readiness: "READY",
    resultReadiness: "READY",
    freshness: "CURRENT",
    authority: "confirmed",
    editability: "POLICY_PENDING",
    candidate: {
      status: "NONE",
      count: 0,
      currentPreserved: false,
      summaryAvailable: false,
      rawCandidateVisible: false,
    },
    mixedGeneration: false,
    componentMeta: {},
    ...options,
  };
}

function runtime(
  activities: Partial<Record<string, string>> = {},
): BrandProcessorRuntimeProjection {
  const make = (processorId: string) => ({
    processorId,
    activity: activities[processorId] ?? "IDLE",
    readiness: "UNKNOWN" as const,
    latestExecutionStatus: null,
    reasonCode: null,
    hasCurrent: true,
    refreshing: activities[processorId] === "REFRESHING",
    failure: null,
  });
  return {
    brand_communication: make("brand_communication"),
    brand_meaning: make("brand_meaning"),
    brand_character: make("brand_character"),
    audience_persona_synthesis: make("audience_persona_synthesis"),
    brand_differentiation: make("brand_differentiation"),
    visual_style_synthesis: make("visual_style_synthesis"),
    serviceability_synthesis: make("serviceability_synthesis"),
  } as BrandProcessorRuntimeProjection;
}

function brandPayload(brandId = "brand-1"): BrandIntelligenceDomainPayload {
  return {
    brandId,
    processorRuntime: runtime({ brand_meaning: "LEARNING" }),
    brandIdentity: {
      description: field("brand_description"),
      positioning: field("positioning", {
        current: { kind: "NO_CURRENT" },
        readiness: "NOT_READY",
        freshness: "UNKNOWN",
      }),
      valueProposition: field("value_proposition", {
        readiness: "PARTIAL",
        freshness: "STALE",
        candidate: {
          status: "CONFLICT",
          count: 2,
          currentPreserved: true,
          summaryAvailable: true,
          rawCandidateVisible: false,
        },
      }),
      values: field("brand_values", { current: { kind: "EXPLICIT_NULL" } }),
      personality: field("brand_personality"),
      differentiation: field("differentiation_and_proof"),
      communication: field("communication_profile"),
    },
    audience: { state: field("audience_personas"), personas: [] },
    visualIdentity: { style: field("visual_style_profile") },
    serviceability: { state: field("serviceability_profile") },
    brandSpecificProof: { retained: true },
  } as unknown as BrandIntelligenceDomainPayload;
}

function subject() {
  return { type: "BRAND" as const, id: "brand-1" };
}

describe("Brand Intelligence consumer adapter", () => {
  it("preserves the Brand payload and projects exactly ten Brand metadata objects", async () => {
    const payload = brandPayload();
    const read = vi.fn().mockResolvedValue(payload);
    const adapter = new BrandIntelligenceConsumerAdapter({
      read,
    } as unknown as BrandConsumerService);

    const result = await adapter.read(actor, subject());

    expect(read).toHaveBeenCalledWith(actor);
    expect(result).toMatchObject({
      contractVersion: "1.0",
      domainPayloadVersion: "1.0",
      engineId: "brand_intelligence",
      subject: subject(),
      capabilityAvailability: { status: "AVAILABLE" },
    });
    expect(result.domainPayload).toBe(payload);
    expect(result.objects.map((object) => object.objectId)).toEqual([
      "brand_description",
      "positioning",
      "value_proposition",
      "brand_values",
      "brand_personality",
      "differentiation_and_proof",
      "communication_profile",
      "audience_personas",
      "visual_style_profile",
      "serviceability_profile",
    ]);
    expect(result.objects[0]).toMatchObject({
      current: {
        kind: "VALUE",
        resultRef: "domainPayload.brandIdentity.description.current.value",
      },
      runtimeActivity: "LEARNING",
    });
    expect(result.objects[0].current).not.toHaveProperty("value");
    expect(result.objects[1].current).toEqual({ kind: "NO_CURRENT" });
    expect(result.objects[2]).toMatchObject({
      readiness: "PARTIAL",
      freshness: "STALE",
      candidate: { status: "CONFLICT", count: 2, currentPreserved: true },
    });
  });

  it("fails closed when authenticated Brand authority resolves a different Brand", async () => {
    const read = vi.fn().mockResolvedValue(brandPayload("other-brand"));
    const adapter = new BrandIntelligenceConsumerAdapter({
      read,
    } as unknown as BrandConsumerService);

    await expect(adapter.read(actor, subject())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(read).toHaveBeenCalledWith(actor);
  });

  it("rejects an OFFERING subject without invoking the Brand consumer", async () => {
    const read = vi.fn();
    const adapter = new BrandIntelligenceConsumerAdapter({
      read,
    } as unknown as BrandConsumerService);

    await expect(
      adapter.read(actor, { type: "OFFERING", id: "offering-1" }),
    ).rejects.toThrow("supports only BRAND");
    expect(read).not.toHaveBeenCalled();
  });

  it("resolves availability only after the authoritative Brand read succeeds", async () => {
    const read = vi.fn().mockResolvedValue(brandPayload());
    const adapter = new BrandIntelligenceConsumerAdapter({
      read,
    } as unknown as BrandConsumerService);

    await expect(
      adapter.resolveAvailability(actor, subject()),
    ).resolves.toEqual({ status: "AVAILABLE" });
    expect(read).toHaveBeenCalledWith(actor);
  });
});
