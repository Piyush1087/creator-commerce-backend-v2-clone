import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  emptyProductObject,
  emptyProductRuntime,
} from "./product-consumer.mapper";
import { ProductConsumerResponseSchema } from "./product-consumer.schema";
import {
  PRODUCT_PROCESSOR_IDS,
  PRODUCT_PROCESSOR_OBJECT_OWNERSHIP,
} from "./product-consumer.types";

function noIntelligenceResponse() {
  const objects = Object.fromEntries(
    PRODUCT_PROCESSOR_IDS.map((processorId) => {
      const object = emptyProductObject(
        PRODUCT_PROCESSOR_OBJECT_OWNERSHIP[processorId],
      );
      return [
        processorId,
        { object, runtime: emptyProductRuntime(processorId, object) },
      ];
    }),
  );
  return {
    offering: {
      id: randomUUID(),
      kind: null,
      subtype: null,
      lifecycle: { state: "UNRESOLVED" as const },
      name: "Historical Offering",
      description: null,
      customerDestination: "https://example.test/offering",
      primaryMedia: null,
      canonicalPrice: { state: "UNAVAILABLE" as const },
      offerRefs: [],
      locationRefs: [],
    },
    intelligence: {
      factualProfile: objects.offering_factual_synthesis.object,
      creatorCommunicationProfile:
        objects.offering_creator_communication.object,
      actionabilityProfile: objects.offering_actionability_synthesis.object,
    },
    processorRuntime: {
      offering_factual_synthesis: objects.offering_factual_synthesis.runtime,
      offering_creator_communication:
        objects.offering_creator_communication.runtime,
      offering_actionability_synthesis:
        objects.offering_actionability_synthesis.runtime,
    },
  };
}

describe("Product consumer response contract", () => {
  it("accepts an unresolved historical Offering without inventing lifecycle", () => {
    const parsed = ProductConsumerResponseSchema.parse(
      noIntelligenceResponse(),
    );
    expect(parsed.offering.lifecycle).toEqual({ state: "UNRESOLVED" });
    expect(Object.keys(parsed.processorRuntime)).toEqual(PRODUCT_PROCESSOR_IDS);
    expect(
      Object.values(parsed.processorRuntime).every(
        (runtime) =>
          runtime.readiness === "NOT_READY" && runtime.activity === "IDLE",
      ),
    ).toBe(true);
  });

  it("rejects collapsed/failed readiness, extra processors, and raw Evidence internals", () => {
    const failedReadiness = structuredClone(noIntelligenceResponse());
    failedReadiness.processorRuntime.offering_factual_synthesis.readiness =
      "FAILED" as never;
    expect(() =>
      ProductConsumerResponseSchema.parse(failedReadiness),
    ).toThrow();

    const fourth = structuredClone(noIntelligenceResponse()) as Record<
      string,
      unknown
    >;
    (fourth.processorRuntime as Record<string, unknown>).fourth_processor = {};
    expect(() => ProductConsumerResponseSchema.parse(fourth)).toThrow();

    const rawEvidence = structuredClone(noIntelligenceResponse()) as Record<
      string,
      unknown
    >;
    (rawEvidence.intelligence as Record<string, unknown>).evidencePayload = {
      secret: true,
    };
    expect(() => ProductConsumerResponseSchema.parse(rawEvidence)).toThrow();
  });
});
