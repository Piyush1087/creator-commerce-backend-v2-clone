import { describe, expect, it } from "vitest";

import { BrandHomeDuplicateSuppressor } from "./brand-home-duplicate-suppressor.service";
import { BrandHomePrioritizer } from "./brand-home-prioritizer.service";
import type { BrandHomeCandidate } from "./brand-home.types";

const prioritizer = new BrandHomePrioritizer();
const suppressor = new BrandHomeDuplicateSuppressor(prioritizer);
const now = "2026-09-03T06:00:00.000Z";

function candidate(
  id: string,
  options: Partial<BrandHomeCandidate> = {},
): BrandHomeCandidate {
  return {
    id,
    sectionId: "CURRENT_MOMENTUM",
    deduplicationKey: id,
    kind: "CAMPAIGN_MOMENTUM",
    reasonCode: "CAMPAIGN_LIVE_MOMENTUM",
    priorityTier: "MEANINGFUL_MOMENTUM",
    title: id,
    summary: id,
    entityRefs: [{ type: "CAMPAIGN", id: "campaign-1" }],
    navigation: {
      destinationId: "CAMPAIGNS",
      entityRef: { type: "CAMPAIGN", id: "campaign-1" },
    },
    freshness: {
      state: "CURRENT",
      observedAt: now,
      changedAt: "2026-09-03T04:00:00.000Z",
      dueAt: null,
    },
    sourceDomains: ["CAMPAIGN"],
    limitations: [],
    ...options,
  };
}

describe("Brand Home priority and semantic duplicate suppression", () => {
  it("sorts by tier, attention deadline, changedAt, and stable ID", () => {
    const items = [
      candidate("z", {
        sectionId: "NEEDS_ATTENTION",
        priorityTier: "MATERIAL_SETUP_CAPABILITY_BLOCKER",
      }),
      candidate("b", {
        sectionId: "NEEDS_ATTENTION",
        priorityTier: "DEADLINE_SLA_TIME_SENSITIVE",
        freshness: {
          state: "CURRENT",
          observedAt: now,
          changedAt: "2026-09-03T05:00:00.000Z",
          dueAt: "2026-09-03T08:00:00.000Z",
        },
      }),
      candidate("a", {
        sectionId: "NEEDS_ATTENTION",
        priorityTier: "DEADLINE_SLA_TIME_SENSITIVE",
        freshness: {
          state: "CURRENT",
          observedAt: now,
          changedAt: "2026-09-03T05:00:00.000Z",
          dueAt: "2026-09-03T07:00:00.000Z",
        },
      }),
    ];
    expect(
      prioritizer.sort("NEEDS_ATTENTION", items).map((item) => item.id),
    ).toEqual(["a", "b", "z"]);
  });

  it("uses changedAt descending and stable ID outside attention", () => {
    expect(
      prioritizer
        .sort("CURRENT_MOMENTUM", [
          candidate("b"),
          candidate("c", {
            freshness: {
              state: "CURRENT",
              observedAt: now,
              changedAt: "2026-09-03T05:00:00.000Z",
              dueAt: null,
            },
          }),
          candidate("a"),
        ])
        .map((item) => item.id),
    ).toEqual(["c", "a", "b"]);
  });

  it("suppresses Collaboration momentum when attention exists", () => {
    const ref = { type: "COLLABORATION" as const, id: "collaboration-1" };
    const attention = candidate("attention", {
      sectionId: "NEEDS_ATTENTION",
      kind: "COLLABORATION_ATTENTION",
      entityRefs: [ref],
    });
    const momentum = candidate("momentum", {
      kind: "COLLABORATION_MOMENTUM",
      entityRefs: [ref],
    });
    expect(suppressor.suppress([momentum, attention])).toEqual([attention]);
  });

  it("suppresses duplicate learned Offering action but preserves unrelated same-entity items", () => {
    const ref = { type: "OFFERING" as const, id: "offering-1" };
    const opportunity = candidate("opportunity", {
      sectionId: "OPPORTUNITIES_NEXT_ACTIONS",
      kind: "OFFERING_OPPORTUNITY",
      entityRefs: [ref],
    });
    const learned = candidate("learned", {
      sectionId: "CREATOR_SHOP_HAS_LEARNED",
      kind: "PRODUCT_INTELLIGENCE_LEARNED",
      entityRefs: [ref],
    });
    const unrelated = candidate("unrelated", {
      sectionId: "NEEDS_ATTENTION",
      kind: "WORKSPACE_SETUP",
      entityRefs: [ref],
    });
    expect(suppressor.suppress([learned, opportunity, unrelated])).toEqual([
      opportunity,
      unrelated,
    ]);
  });
});
