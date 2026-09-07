import { describe, expect, it } from "vitest";

import { IntelligenceConsumerResultSchema } from "./intelligence-consumer.schema";

describe("Intelligence consumer envelope schema", () => {
  const baseObject = {
    objectId: "brand_description",
    objectState: "CURRENT" as const,
    readiness: "READY" as const,
    resultReadiness: "READY" as const,
    freshness: "CURRENT" as const,
    changedAt: "2026-09-03T04:00:00.000Z",
    authority: "confirmed" as const,
  };

  it.each([
    "EXPLICIT_NULL",
    "INTENTIONALLY_ABSENT",
    "NO_CURRENT",
    "NOT_EVALUATED",
    "NOT_OWNED",
  ] as const)(
    "preserves the %s current kind without fabricating a value",
    (kind) => {
      const parsed = IntelligenceConsumerResultSchema.parse({
        contractVersion: "1.0",
        engineId: "brand_intelligence",
        subject: { type: "BRAND", id: "brand-1" },
        objects: [
          {
            ...baseObject,
            ...(kind === "NO_CURRENT"
              ? {
                  objectState: "NO_CURRENT" as const,
                  readiness: "NOT_READY" as const,
                  resultReadiness: "NOT_READY" as const,
                  freshness: "UNKNOWN" as const,
                  changedAt: null,
                }
              : {}),
            current: { kind },
          },
        ],
        capabilityAvailability: { status: "AVAILABLE" },
        domainPayloadVersion: "1.0",
        domainPayload: { brandSpecific: true },
      });

      expect(parsed.objects[0].current).toEqual({ kind });
      expect(parsed.domainPayload).toEqual({ brandSpecific: true });
    },
  );

  it("keeps VALUE content in the domain payload and only a stable reference in metadata", () => {
    const result = {
      contractVersion: "1.0",
      engineId: "product_intelligence",
      subject: { type: "OFFERING", id: "offering-1" },
      objects: [
        {
          ...baseObject,
          objectId: "offering_factual_profile",
          current: {
            kind: "VALUE",
            resultRef:
              "domainPayload.intelligence.factualProfile.current.value",
          },
          readiness: "PARTIAL",
          freshness: "STALE",
          candidate: {
            status: "CONFLICT",
            count: 2,
            currentPreserved: true,
            summaryAvailable: true,
          },
          runtimeActivity: "REFRESHING",
        },
      ],
      capabilityAvailability: { status: "AVAILABLE" },
      domainPayloadVersion: "1.0",
      domainPayload: {
        intelligence: {
          factualProfile: { current: { kind: "VALUE", value: "exact" } },
        },
      },
    };

    const parsed = IntelligenceConsumerResultSchema.parse(result);
    expect(parsed.objects[0].current).not.toHaveProperty("value");
    expect(parsed.domainPayload).toEqual(result.domainPayload);
  });

  it("rejects attempts to flatten a domain value into common metadata", () => {
    expect(() =>
      IntelligenceConsumerResultSchema.parse({
        contractVersion: "1.0",
        engineId: "brand_intelligence",
        subject: { type: "BRAND", id: "brand-1" },
        objects: [
          {
            ...baseObject,
            current: {
              kind: "VALUE",
              resultRef: "domainPayload.brandIdentity.description",
              value: "must not be duplicated",
            },
          },
        ],
        capabilityAvailability: { status: "AVAILABLE" },
        domainPayloadVersion: "1.0",
        domainPayload: { brandIdentity: { description: "authoritative" } },
      }),
    ).toThrow();
  });
});
