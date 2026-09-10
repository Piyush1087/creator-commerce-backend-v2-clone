import { describe, expect, it } from "vitest";

import { CreatorHomeResponseSchema } from "./creator-home.schema";

function fixture() {
  const observedAt = "2026-09-07T00:00:00.000Z";
  return {
    contractVersion: "1.0",
    generatedAt: observedAt,
    status: "READY",
    creator: {
      id: "creator",
      workspaceId: "workspace",
      displayName: "Creator",
      workspaceDisplayName: "Studio",
      role: "OWNER",
    },
    kpis: [
      "AVAILABLE_CAMPAIGNS",
      "APPLICATIONS_IN_PROGRESS",
      "ACTIVE_COLLABORATIONS",
      "UNREAD_UPDATES",
    ].map((id) => ({
      id,
      state: "READY",
      value: 0,
      freshness: "CURRENT",
      observedAt,
    })),
    quickActions: [
      ["BROWSE_CAMPAIGNS", "Browse campaigns", "CREATOR_CAMPAIGNS"],
      ["MY_APPLICATIONS", "My applications", "CREATOR_APPLICATIONS"],
      ["COLLABORATIONS", "Collaborations", "CREATOR_COLLABORATIONS"],
      ["SETTINGS", "Settings", "CREATOR_SETTINGS"],
    ].map(([id, label, destinationId]) => ({
      id,
      label,
      action: {
        state: "AVAILABLE",
        destination: { destinationId },
        reasonCode: null,
      },
    })),
    sections: [
      "NEEDS_YOUR_ATTENTION",
      "YOUR_WORK",
      "CAMPAIGNS_AVAILABLE",
      "RECENT_ACTIVITY",
    ].map((id) => ({ id, state: "EMPTY", items: [] })),
    sourceStates: [
      "SETTINGS",
      "OPPORTUNITIES",
      "APPLICATIONS",
      "COLLABORATIONS",
      "NOTIFICATIONS",
    ].map((sourceDomain) => ({
      sourceDomain,
      state: "READY",
      freshness: sourceDomain === "SETTINGS" ? "UNKNOWN" : "CURRENT",
      observedAt,
      truncated: false,
      limitations: [],
    })),
    truncated: false,
    limitations: [],
  };
}

describe("Creator Home V1 contract", () => {
  it("accepts the frozen ordered shape and rejects unknown fields", () => {
    expect(CreatorHomeResponseSchema.safeParse(fixture()).success).toBe(true);
    expect(
      CreatorHomeResponseSchema.safeParse({
        ...fixture(),
        email: "not-allowed@example.test",
      }).success,
    ).toBe(false);
  });

  it("requires unavailable KPI values to be null", () => {
    const value = fixture();
    value.kpis[0] = { ...value.kpis[0], state: "UNAVAILABLE", value: 0 };
    expect(CreatorHomeResponseSchema.safeParse(value).success).toBe(false);
    value.kpis[0] = { ...value.kpis[0], value: null };
    expect(CreatorHomeResponseSchema.safeParse(value).success).toBe(true);
  });
});
