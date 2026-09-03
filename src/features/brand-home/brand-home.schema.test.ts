import { describe, expect, it } from "vitest";

import { BRAND_HOME_SECTION_IDS } from "./brand-home.contract";
import { BrandHomeResponseSchema } from "./brand-home.schema";

const now = "2026-09-03T06:00:00.000Z";
const item = {
  id: "home:v1:CAMPAIGN_LIVE_MOMENTUM:CAMPAIGN:campaign-1",
  kind: "CAMPAIGN_MOMENTUM" as const,
  reasonCode: "CAMPAIGN_LIVE_MOMENTUM",
  priorityTier: "MEANINGFUL_MOMENTUM" as const,
  title: "Campaign is live",
  summary: "The Campaign is making progress.",
  entityRefs: [{ type: "CAMPAIGN" as const, id: "campaign-1" }],
  navigation: {
    destinationId: "CAMPAIGNS" as const,
    entityRef: { type: "CAMPAIGN" as const, id: "campaign-1" },
  },
  freshness: {
    state: "CURRENT" as const,
    observedAt: now,
    changedAt: "2026-09-03T05:00:00.000Z",
    dueAt: null,
  },
  sourceDomains: ["CAMPAIGN" as const],
  limitations: [],
};

function response() {
  return {
    contractVersion: "1.0",
    generatedAt: now,
    status: "READY",
    brand: { id: "brand-1", displayName: "Example Brand" },
    sections: BRAND_HOME_SECTION_IDS.map((id) => ({
      id,
      state: id === "CURRENT_MOMENTUM" ? "READY" : "EMPTY",
      items: id === "CURRENT_MOMENTUM" ? [item] : [],
    })),
    sourceStates: [
      {
        sourceDomain: "CAMPAIGN",
        state: "READY",
        truncated: false,
        limitations: [],
      },
    ],
    truncated: false,
    limitations: [],
  };
}

describe("Brand Home 1.0 response contract", () => {
  it("accepts the strict contract with exactly four ordered sections", () => {
    const parsed = BrandHomeResponseSchema.parse(response());
    expect(parsed.contractVersion).toBe("1.0");
    expect(parsed.sections.map((section) => section.id)).toEqual(
      BRAND_HOME_SECTION_IDS,
    );
  });

  it("rejects reordered sections and model-authored URLs", () => {
    const reordered = response();
    reordered.sections = [...reordered.sections].reverse();
    expect(() => BrandHomeResponseSchema.parse(reordered)).toThrow();
    expect(() =>
      BrandHomeResponseSchema.parse({
        ...response(),
        sections: response().sections.map((section) => ({
          ...section,
          items: section.items.map((value) => ({
            ...value,
            navigation: { ...value.navigation, url: "/invented" },
          })),
        })),
      }),
    ).toThrow();
  });

  it("enforces non-mutating recommendations", () => {
    const candidate = response();
    candidate.sections[3].items[0] = {
      ...item,
      recommendation: {
        text: "Review this Campaign.",
        basisRefs: ["campaign:campaign-1:state"],
        nonMutating: false,
      },
    } as never;
    expect(() => BrandHomeResponseSchema.parse(candidate)).toThrow();
  });
});
