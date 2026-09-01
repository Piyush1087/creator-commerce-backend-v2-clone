import { ConflictException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../../auth/types/auth-user";
import type { ProductConsumerService } from "../../brand-centre/consumer/product-consumer.service";
import type {
  ProductConsumerResponse,
  ProductIntelligenceObject,
  ProductProcessorRuntime,
} from "../../brand-centre/consumer/product-consumer.schema";
import type {
  ProductObjectSemanticId,
  ProductProcessorId,
} from "../../brand-centre/consumer/product-consumer.types";
import { ProductIntelligenceConsumerAdapter } from "./product-intelligence-consumer.adapter";

const offeringId = "11111111-1111-4111-8111-111111111111";
const actor: AuthUser = {
  id: "user-1",
  email: "actor@example.test",
  name: "Actor",
  role: UserRole.BRAND,
  organizationId: "organization-1",
};

function productObject(
  semanticId: ProductObjectSemanticId,
  options: Partial<ProductIntelligenceObject> = {},
): ProductIntelligenceObject {
  return {
    semanticId,
    current: { kind: "VALUE", value: { semanticId, exact: true } },
    readiness: "READY",
    freshness: "CURRENT",
    authority: "creator_shop",
    candidate: {
      status: "NONE",
      count: 0,
      currentPreserved: false,
      summaryAvailable: false,
      rawCandidateVisible: false,
    },
    lineage: {
      objectContract: { id: `${semanticId}.object`, version: "1.0" },
      outputContract: { id: `${semanticId}.output`, version: "1.0" },
      mixedGeneration: false,
      mixedContractVersion: false,
      components: [],
    },
    ...options,
  };
}

function processorRuntime(
  processorId: ProductProcessorId,
  objectSemanticId: ProductObjectSemanticId,
  activity: ProductProcessorRuntime["activity"],
): ProductProcessorRuntime {
  return {
    processorId,
    objectSemanticId,
    readiness: "READY",
    freshness: "CURRENT",
    activity,
    dependencyReadiness: "UNKNOWN",
    latestExecutionStatus: activity === "LEARNING" ? "RUNNING" : null,
    reasonCode: null,
    hasCurrent: true,
    refreshing: activity === "REFRESHING",
    failure: null,
    candidate: {
      status: "NONE",
      count: 0,
      currentPreserved: false,
      summaryAvailable: false,
      rawCandidateVisible: false,
    },
    currentLineage: null,
  };
}

function productPayload(id = offeringId): ProductConsumerResponse {
  return {
    offering: {
      id,
      kind: "PRODUCT",
      subtype: "SKINCARE",
      lifecycle: { state: "RESOLVED", value: "ACTIVE" },
      name: "Exact Offering",
      description: "Product-specific canonical state",
      customerDestination: "https://example.test/offering",
      primaryMedia: null,
      canonicalPrice: { state: "UNAVAILABLE" },
      offerRefs: [],
      locationRefs: [],
    },
    intelligence: {
      factualProfile: productObject("offering_factual_profile"),
      creatorCommunicationProfile: productObject(
        "offering_creator_communication_profile",
        {
          current: { kind: "NO_CURRENT" },
          readiness: "PARTIAL",
          freshness: "STALE",
          candidate: {
            status: "CONFLICT",
            count: 3,
            currentPreserved: true,
            summaryAvailable: true,
            rawCandidateVisible: false,
          },
        },
      ),
      actionabilityProfile: productObject("offering_actionability_profile", {
        current: { kind: "EXPLICIT_NULL" },
        readiness: "NOT_READY",
        freshness: "UNKNOWN",
      }),
    },
    processorRuntime: {
      offering_factual_synthesis: processorRuntime(
        "offering_factual_synthesis",
        "offering_factual_profile",
        "LEARNING",
      ),
      offering_creator_communication: processorRuntime(
        "offering_creator_communication",
        "offering_creator_communication_profile",
        "REFRESHING",
      ),
      offering_actionability_synthesis: processorRuntime(
        "offering_actionability_synthesis",
        "offering_actionability_profile",
        "TEMPORARILY_UNAVAILABLE",
      ),
    },
  };
}

describe("Product Intelligence consumer adapter", () => {
  it("passes the exact Offering ID, preserves Product payload, and exposes three Product objects", async () => {
    const payload = productPayload();
    const read = vi.fn().mockResolvedValue(payload);
    const adapter = new ProductIntelligenceConsumerAdapter({
      read,
    } as unknown as ProductConsumerService);

    const result = await adapter.read(actor, {
      type: "OFFERING",
      id: offeringId,
    });

    expect(read).toHaveBeenCalledWith(actor, offeringId);
    expect(result).toMatchObject({
      contractVersion: "1.0",
      domainPayloadVersion: "1.0",
      engineId: "product_intelligence",
      subject: { type: "OFFERING", id: offeringId },
      capabilityAvailability: { status: "AVAILABLE" },
    });
    expect(result.domainPayload).toBe(payload);
    expect(result.domainPayload.offering).toEqual(payload.offering);
    expect(result.objects.map((object) => object.objectId)).toEqual([
      "offering_factual_profile",
      "offering_creator_communication_profile",
      "offering_actionability_profile",
    ]);
    expect(result.objects[0]).toMatchObject({
      current: {
        kind: "VALUE",
        resultRef: "domainPayload.intelligence.factualProfile.current.value",
      },
      runtimeActivity: "LEARNING",
    });
    expect(result.objects[0].current).not.toHaveProperty("value");
    expect(result.objects[1]).toMatchObject({
      current: { kind: "NO_CURRENT" },
      readiness: "PARTIAL",
      freshness: "STALE",
      candidate: { status: "CONFLICT", count: 3, currentPreserved: true },
      runtimeActivity: "REFRESHING",
    });
    expect(result.objects[2]).toMatchObject({
      current: { kind: "EXPLICIT_NULL" },
      runtimeActivity: "TEMPORARILY_UNAVAILABLE",
    });
  });

  it("fails closed when the Product consumer returns a different Offering", async () => {
    const read = vi
      .fn()
      .mockResolvedValue(
        productPayload("22222222-2222-4222-8222-222222222222"),
      );
    const adapter = new ProductIntelligenceConsumerAdapter({
      read,
    } as unknown as ProductConsumerService);

    await expect(
      adapter.read(actor, { type: "OFFERING", id: offeringId }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(read).toHaveBeenCalledWith(actor, offeringId);
  });

  it("rejects a BRAND subject without invoking the Product consumer", async () => {
    const read = vi.fn();
    const adapter = new ProductIntelligenceConsumerAdapter({
      read,
    } as unknown as ProductConsumerService);

    await expect(
      adapter.read(actor, { type: "BRAND", id: "brand-1" }),
    ).rejects.toThrow("supports only OFFERING");
    expect(read).not.toHaveBeenCalled();
  });

  it("keeps Product authorization errors from the authoritative consumer intact", async () => {
    const authorizationError = new Error("authoritative Product denial");
    const read = vi.fn().mockRejectedValue(authorizationError);
    const adapter = new ProductIntelligenceConsumerAdapter({
      read,
    } as unknown as ProductConsumerService);

    await expect(
      adapter.resolveAvailability(actor, { type: "OFFERING", id: offeringId }),
    ).rejects.toBe(authorizationError);
  });
});
