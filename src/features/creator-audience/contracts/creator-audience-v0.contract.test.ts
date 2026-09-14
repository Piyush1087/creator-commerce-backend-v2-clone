import { describe, expect, it } from "vitest";

import {
  CREATOR_AUDIENCE_ROUTE,
  CREATOR_AUDIENCE_SETTINGS_BOUNDARY,
  CreatorAudienceConsumerSchema,
  finalizeAudienceHighlights,
  ownerScopeKey,
} from "./creator-audience-v0.contract";

describe("Creator Audience V0 executable contract freeze", () => {
  it("keeps Brand and Creator owner scopes disjoint", () => {
    expect(ownerScopeKey({ kind: "BRAND", brandProfileId: "brand-1" })).toBe(
      "BRAND:brand-1",
    );
    expect(
      ownerScopeKey({
        kind: "CREATOR",
        creatorProfileId: "creator-1",
        creatorWorkspaceId: "workspace-1",
      }),
    ).toBe("CREATOR:creator-1:workspace-1");
  });

  it("freezes the authenticated route and Settings non-mutation boundary", () => {
    expect(CREATOR_AUDIENCE_ROUTE).toBe("/api/v1/creator/insights/audience");
    expect(CREATOR_AUDIENCE_SETTINGS_BOUNDARY).toEqual({
      projectsStateOnly: true,
      requiresCredentialDecryptionInConsumer: false,
      ownsConnect: false,
      ownsReconnect: false,
      ownsDisconnect: false,
      ownsRefresh: false,
      exposesDeleteEndpoint: false,
    });
  });

  it("rejects percentage output without denominator authority", () => {
    const result = CreatorAudienceConsumerSchema.safeParse({
      contractVersion: "creator_audience_v0.1",
      generatedAt: "2026-09-14T00:00:00.000Z",
      status: "PARTIAL",
      context: { role: "ASSISTANT" },
      source: "INSTAGRAM",
      sourceStatus: "CONNECTED",
      snapshotBasis: {
        period: "lifetime",
        timeframe: "this_month",
        capturedAt: "2026-09-14T00:00:00.000Z",
      },
      defaultCohort: "FOLLOWERS",
      highlights: [],
      cohorts: [
        {
          id: "FOLLOWERS",
          availability: "PARTIAL",
          size: 0,
          dimensions: [
            {
              id: "AGE",
              state: "AVAILABLE",
              denominatorValid: false,
              buckets: [{ key: "25-34", count: 3, percentage: 100 }],
              limitations: [],
            },
          ],
          limitations: [],
        },
      ],
      freshness: { state: "CURRENT", staleAfterHours: 192 },
      processingState: "IDLE",
      currentPreserved: false,
      limitations: [],
      settingsRecoveryRoute: "/creator/settings/instagram",
    });
    expect(result.success).toBe(false);
  });

  it("finalizes at most three deterministic evidence-backed highlights", () => {
    expect(
      finalizeAudienceHighlights([
        {
          id: "minor",
          text: "minor",
          evidence: ["e0"],
          absolutePercentagePointDelta: 4.9,
        },
        {
          id: "b",
          text: "B",
          evidence: ["e2", "e2"],
          absolutePercentagePointDelta: 10,
        },
        {
          id: "a",
          text: "A",
          evidence: ["e1"],
          absolutePercentagePointDelta: 10,
        },
        {
          id: "c",
          text: "C",
          evidence: ["e3"],
          absolutePercentagePointDelta: 7,
        },
        {
          id: "d",
          text: "D",
          evidence: ["e4"],
          absolutePercentagePointDelta: 6,
        },
      ]),
    ).toEqual([
      { id: "a", text: "A", evidence: ["e1"] },
      { id: "b", text: "B", evidence: ["e2"] },
      { id: "c", text: "C", evidence: ["e3"] },
    ]);
  });
});
